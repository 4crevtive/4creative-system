import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Film, Scissors, Palette, Code2, Megaphone, ArrowLeft, Search, Clock, AlertTriangle, CheckCircle2, Flame, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { NewTaskDialog } from "@/components/production/new-task-dialog";
import type { ProdTask } from "@/components/production/task-card";
import { TaskDetailView, type TaskSeed } from "@/components/production/task-detail-view";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "pending",      label: "في الانتظار",   tone: "slate",   dot: "bg-slate-400" },
  { key: "started",      label: "تم البدء",      tone: "sky",     dot: "bg-sky-500" },
  { key: "progress_50",  label: "50%",           tone: "indigo",  dot: "bg-indigo-500" },
  { key: "in_review",    label: "قيد المراجعة",  tone: "amber",   dot: "bg-amber-500" },
  { key: "submitted",    label: "تم التسليم",    tone: "violet",  dot: "bg-violet-500" },
  { key: "approved",     label: "معتمد",         tone: "emerald", dot: "bg-emerald-500" },
] as const;

const COLUMN_HEADER_BG: Record<string, string> = {
  slate:   "bg-slate-50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800",
  sky:     "bg-sky-50 dark:bg-sky-900/20 border-sky-200/70 dark:border-sky-800/60",
  indigo:  "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200/70 dark:border-indigo-800/60",
  amber:   "bg-amber-50 dark:bg-amber-900/20 border-amber-200/70 dark:border-amber-800/60",
  violet:  "bg-violet-50 dark:bg-violet-900/20 border-violet-200/70 dark:border-violet-800/60",
  emerald: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/70 dark:border-emerald-800/60",
};

const TYPE_ICONS: Record<string, typeof Film> = {
  shooting: Film, editing: Scissors, design: Palette, programming: Code2, marketing: Megaphone,
};

const TYPE_LABELS: Record<string, string> = {
  shooting: "تصوير", editing: "مونتاج", design: "ديزاين", programming: "برمجة", marketing: "ماركتنج",
};

const TYPE_TONE: Record<string, string> = {
  shooting:    "text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200/70",
  editing:     "text-violet-600 bg-violet-50 dark:bg-violet-950/30 border-violet-200/70",
  design:      "text-pink-600 bg-pink-50 dark:bg-pink-950/30 border-pink-200/70",
  programming: "text-sky-600 bg-sky-50 dark:bg-sky-950/30 border-sky-200/70",
  marketing:   "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200/70",
};

function formatDue(d?: string | null) {
  if (!d) return null;
  const due = new Date(d);
  const diff = Math.round((due.getTime() - Date.now()) / 86400000);
  const label = due.toLocaleDateString("ar-EG", { day: "2-digit", month: "short" });
  const state = diff < 0 ? "overdue" : diff <= 2 ? "soon" : "ok";
  return { label, state, diff };
}

export type TaskType = "shooting" | "editing" | "design" | "programming" | "marketing";

export function TasksKanban({
  title,
  description,
  filterType,
}: {
  title: string;
  description?: string;
  filterType?: TaskType;
}) {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<TaskSeed | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");
  const { data: tasks } = useQuery({
    queryKey: ["tasks", filterType ?? "all"],
    queryFn: async () => {
      let q = supabase.from("tasks")
        .select("*, contact:contacts(full_name)")
        .order("created_at", { ascending: false });
      if (filterType) q = q.eq("type", filterType);
      return (await q).data ?? [];
    },
  });

  async function moveTask(id: string, currentStatus: string, to: string) {
    const now = new Date().toISOString();
    const { data: u } = await supabase.auth.getUser();
    const patch = {
      status: to as never,
      ...(to === "started" && currentStatus === "pending" ? { started_at: now } : {}),
      ...(to === "submitted" ? { submitted_at: now } : {}),
      ...(to === "approved" ? { approved_at: now, approved_by: u.user?.id } : {}),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("tasks").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("task_status_history").insert({
      task_id: id, from_status: currentStatus as never, to_status: to as never,
    });
    toast.success("تم تحديث حالة المهمة");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (tasks ?? []).filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (!s) return true;
      const hay = `${t.title ?? ""} ${(t as { contact?: { full_name?: string } }).contact?.full_name ?? ""} ${t.project_name ?? ""} ${t.client_name ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [tasks, search, typeFilter]);

  const stats = useMemo(() => {
    const all = tasks ?? [];
    const active = all.filter((t) => !["approved", "submitted"].includes(t.status)).length;
    const done = all.filter((t) => t.status === "approved").length;
    const overdue = all.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now() && !["approved", "submitted"].includes(t.status)).length;
    return { total: all.length, active, done, overdue };
  }, [tasks]);

  const typeOptions: { value: TaskType | "all"; label: string }[] = [
    { value: "all",       label: "كل الأنواع" },
    { value: "shooting",  label: "تصوير" },
    { value: "editing",   label: "مونتاج" },
    { value: "design",    label: "ديزاين" },
    { value: "programming", label: "برمجة" },
    { value: "marketing", label: "ماركتنج" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
        <NewTaskDialog
          defaultType={filterType ?? "editing"}
          lockedType={!!filterType}
          onCreated={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
        />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Clock} tone="slate"   label="المجموع" value={stats.total} />
        <StatTile icon={Flame} tone="indigo"  label="نشطة"    value={stats.active} />
        <StatTile icon={AlertTriangle} tone="rose" label="متأخرة" value={stats.overdue} />
        <StatTile icon={CheckCircle2} tone="emerald" label="معتمدة" value={stats.done} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border bg-card/50 backdrop-blur-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في التاسكات..."
            className="pr-9 h-9 rounded-lg border-0 bg-muted/40 focus-visible:ring-1"
          />
        </div>
        {!filterType && (
          <div className="flex items-center gap-1 flex-wrap">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={cn(
                  "px-3 h-8 rounded-lg text-xs font-medium transition-colors border",
                  typeFilter === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-muted/60"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const items = filtered.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-2xl border bg-muted/20 min-h-[360px] flex flex-col">
              <div className={cn("flex items-center justify-between gap-2 px-3 py-2.5 rounded-t-2xl border-b", COLUMN_HEADER_BG[col.tone])}>
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  <div className="font-semibold text-[13px]">{col.label}</div>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground bg-background/70 rounded-md px-1.5 py-0.5 min-w-[22px] text-center">
                  {items.length}
                </span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {items.map((t) => {
                  const Icon = TYPE_ICONS[t.type] ?? Film;
                  const nextIdx = COLUMNS.findIndex((c) => c.key === t.status) + 1;
                  const next = COLUMNS[nextIdx];
                  const due = formatDue(t.due_at);
                  const isHighPriority = (t.priority ?? 0) >= 4;
                  const contact = (t as { contact?: { full_name?: string } }).contact?.full_name;
                  return (
                    <Card
                      key={t.id}
                      onClick={() => setSelectedTask(t as TaskSeed)}
                      className={cn(
                        "group relative p-3 rounded-xl cursor-pointer border transition-all",
                        "hover:shadow-md hover:-translate-y-0.5",
                        due?.state === "overdue" && "border-r-2 border-r-rose-500"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border", TYPE_TONE[t.type])}>
                          <Icon className="h-3 w-3" />
                          {TYPE_LABELS[t.type] ?? t.type}
                        </span>
                        {isHighPriority && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-600">
                            <Flame className="h-3 w-3" /> عاجل
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-sm font-semibold leading-snug line-clamp-2">{t.title}</div>
                      {(contact || t.project_name || t.client_name) && (
                        <div className="text-[11px] text-muted-foreground mt-1 truncate">
                          {contact ?? t.client_name ?? t.project_name}
                        </div>
                      )}
                      {t.started_at && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10.5px] text-emerald-600 dark:text-emerald-400">
                          <PlayCircle className="h-3 w-3" />
                          بدء {new Date(t.started_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60">
                        {due ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10.5px] font-medium",
                            due.state === "overdue" ? "text-rose-600" : due.state === "soon" ? "text-amber-600" : "text-muted-foreground"
                          )}>
                            <Clock className="h-3 w-3" />
                            {due.state === "overdue" ? `متأخرة ${Math.abs(due.diff)}ي` : due.label}
                          </span>
                        ) : <span className="text-[10.5px] text-muted-foreground/60">بدون موعد</span>}
                        {next && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-6 px-2 text-[10.5px] opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); moveTask(t.id, t.status, next.key); }}
                          >
                            {next.label}
                            <ArrowLeft className="h-3 w-3 mr-1" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
                {items.length === 0 && (
                  <div className="border border-dashed border-border/70 rounded-lg py-8 text-center text-[11px] text-muted-foreground/70">
                    لا يوجد
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto" dir="rtl">
          {selectedTask && <TaskDetailView id={selectedTask.id} initialTask={selectedTask} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatTile({ icon: Icon, tone, label, value }: { icon: typeof Clock; tone: "slate"|"indigo"|"rose"|"emerald"; label: string; value: number }) {
  const map = {
    slate:   "from-slate-50 to-slate-100/60 dark:from-slate-900/40 dark:to-slate-900/20 text-slate-700 dark:text-slate-200",
    indigo:  "from-indigo-50 to-indigo-100/60 dark:from-indigo-950/40 dark:to-indigo-950/20 text-indigo-700 dark:text-indigo-200",
    rose:    "from-rose-50 to-rose-100/60 dark:from-rose-950/40 dark:to-rose-950/20 text-rose-700 dark:text-rose-200",
    emerald: "from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-950/20 text-emerald-700 dark:text-emerald-200",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3 bg-gradient-to-br", map)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}
