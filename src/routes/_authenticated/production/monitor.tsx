import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, AlertTriangle, Film, Image as ImageIcon, Camera, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useAllowedAreas } from "@/lib/use-allowed-areas";

export const Route = createFileRoute("/_authenticated/production/monitor")({
  head: () => ({ meta: [{ title: "المراقبة المباشرة — 4Creative" }] }),
  component: MonitorPage,
});

type MonitorTask = {
  id: string;
  title: string;
  type: "shooting" | "editing" | "design" | "programming" | "marketing";
  status: string;
  priority: number;
  due_at: string | null;
  started_at: string | null;
  client_name: string | null;
  project_name: string | null;
  assignee_id: string | null;
  assignee?: { display_name: string | null; email: string } | null;
};

const COLUMNS: { key: string[]; label: string; tone: string }[] = [
  { key: ["pending"], label: "في الانتظار", tone: "bg-muted text-muted-foreground border-border" },
  { key: ["accepted"], label: "تم القبول", tone: "bg-sky-500/10 text-sky-700 border-sky-300/50" },
  { key: ["started", "shooting_started"], label: "قيد التنفيذ", tone: "bg-blue-500/10 text-blue-700 border-blue-300/50" },
  { key: ["progress_50"], label: "50% منجز", tone: "bg-amber-500/10 text-amber-700 border-amber-300/50" },
  { key: ["in_review", "shooting_done", "uploaded"], label: "مراجعة داخلية", tone: "bg-purple-500/10 text-purple-700 border-purple-300/50" },
  { key: ["submitted"], label: "بانتظار الاعتماد", tone: "bg-orange-500/10 text-orange-700 border-orange-300/50" },
  { key: ["approved", "completed"], label: "مكتمل", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-300/50" },
];

const TYPE_AR: Record<string, string> = { shooting: "تصوير", editing: "مونتاج", design: "ديزاين", programming: "برمجة", marketing: "ماركيتنج" };
function TypeIcon({ t }: { t: string }) {
  const Cmp = t === "shooting" ? Camera : t === "design" ? ImageIcon : Film;
  return <Cmp className="h-3.5 w-3.5" />;
}

// Tiny in-browser chime via WebAudio (no asset needed)
function playChime() {
  try {
    const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [880, 1175, 1568]; // A5, D6, G6
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = freq;
      const start = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      o.start(start); o.stop(start + 0.25);
    });
    setTimeout(() => { void ctx.close(); }, 1200);
  } catch { /* ignore */ }
}

function MonitorPage() {
  const qc = useQueryClient();
  const allowed = useAllowedAreas();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [soundOn, setSoundOn] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!allowed.isLoading && !allowed.isAdmin) {
      toast.error("هذه الصفحة للإدارة فقط");
      navigate({ to: "/production", replace: true });
    }
  }, [allowed, navigate]);

  const { data: tasks, isFetching, refetch } = useQuery({
    queryKey: ["monitor-tasks"],
    enabled: allowed.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, type, status, priority, due_at, started_at, client_name, project_name, assignee_id, assignee:profiles!tasks_assignee_id_fkey(display_name, email)")
        .not("status", "in", "(archived,rejected)")
        .order("priority", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as MonitorTask[];
    },
  });

  // Realtime subscription — refresh whenever any task changes, and chime on new submissions
  useEffect(() => {
    if (!allowed.isAdmin) return;
    const channel = supabase
      .channel("monitor-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["monitor-tasks"] });
        const newRow = payload.new as { id?: string; status?: string; title?: string } | null;
        const oldRow = payload.old as { status?: string } | null;
        if (newRow?.status === "submitted" && oldRow?.status !== "submitted" && soundOn) {
          playChime();
          toast.success(`تسليم جديد: ${newRow.title ?? ""}`, { description: "بانتظار الاعتماد" });
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc, allowed.isAdmin, soundOn]);

  // Track first-load submitted ids so we don't chime for existing rows on mount
  useEffect(() => {
    if (!tasks || initializedRef.current) return;
    for (const t of tasks) if (t.status === "submitted") seenIdsRef.current.add(t.id);
    initializedRef.current = true;
  }, [tasks]);

  const filtered = useMemo(() => {
    let arr = tasks ?? [];
    if (typeFilter !== "all") arr = arr.filter((t) => t.type === typeFilter);
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter((t) =>
      t.title?.toLowerCase().includes(q) ||
      (t.client_name ?? "").toLowerCase().includes(q) ||
      (t.project_name ?? "").toLowerCase().includes(q) ||
      (t.assignee?.display_name ?? "").toLowerCase().includes(q),
    );
    return arr;
  }, [tasks, search, typeFilter]);

  const byCol = useMemo(() => {
    const map: Record<string, MonitorTask[]> = {};
    for (const col of COLUMNS) map[col.label] = [];
    for (const t of filtered) {
      const col = COLUMNS.find((c) => c.key.includes(t.status));
      if (col) map[col.label].push(t);
    }
    return map;
  }, [filtered]);

  if (!allowed.isAdmin) return null;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">المراقبة المباشرة</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            تحديث فوري لكل التاسكات
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Input placeholder="بحث (عنوان / عميل / موظف)" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="editing">مونتاج</SelectItem>
              <SelectItem value="design">ديزاين</SelectItem>
              <SelectItem value="shooting">تصوير</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => refetch()} className="h-9 w-9 inline-flex items-center justify-center rounded-md border hover:bg-muted">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setSoundOn((s) => !s)} title={soundOn ? "إيقاف الصوت" : "تشغيل الصوت"}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border hover:bg-muted">
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {COLUMNS.map((col) => {
            const items = byCol[col.label] ?? [];
            return (
              <div key={col.label} className="w-72 shrink-0">
                <div className={`flex items-center justify-between rounded-t-md px-3 py-2 border ${col.tone}`}>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <div className="bg-muted/30 border border-t-0 rounded-b-md p-2 space-y-2 min-h-[60vh]">
                  {items.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground py-8">لا توجد عناصر</p>
                  ) : (
                    items.map((t) => (
                      <Link key={t.id} to="/production/task/$id" params={{ id: t.id }} className="block">
                        <MonitorCard task={t} />
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonitorCard({ task }: { task: MonitorTask }) {
  const overdue = task.due_at && isPast(new Date(task.due_at)) && !["approved", "completed", "submitted"].includes(task.status);
  const priorityTone =
    task.priority === 1 ? "bg-rose-500/15 text-rose-700 border-rose-300/50"
    : task.priority === 2 ? "bg-orange-500/15 text-orange-700 border-orange-300/50"
    : task.priority === 3 ? "bg-blue-500/10 text-blue-700 border-blue-300/50"
    : "bg-muted text-muted-foreground border-border";
  const priorityAr = task.priority === 1 ? "عاجل جداً" : task.priority === 2 ? "عاجل" : task.priority === 3 ? "عادي" : "منخفض";

  return (
    <Card className={`p-3 space-y-2 hover:shadow-md transition-shadow ${overdue ? "border-rose-400/60" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1 text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-[10px] shrink-0">
          <TypeIcon t={task.type} /> {TYPE_AR[task.type]}
        </div>
        <h3 className="text-sm font-semibold leading-snug flex-1 line-clamp-2">{task.title}</h3>
      </div>
      {(task.project_name || task.client_name) && (
        <p className="text-xs text-muted-foreground truncate">
          {task.project_name}{task.project_name && task.client_name ? " • " : ""}{task.client_name}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{task.assignee?.display_name ?? task.assignee?.email ?? "غير مسند"}</span>
        <Badge variant="outline" className={`text-[10px] ${priorityTone}`}>{priorityAr}</Badge>
      </div>
      {task.due_at && (
        <div className={`flex items-center gap-1 text-[11px] ${overdue ? "text-rose-600 font-semibold" : "text-muted-foreground"}`}>
          {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {overdue ? "متأخر — " : ""}
          {format(new Date(task.due_at), "d MMM HH:mm", { locale: ar })}
        </div>
      )}
      {task.started_at && !task.due_at && (
        <div className="text-[11px] text-muted-foreground">بدأ {formatDistanceToNow(new Date(task.started_at), { addSuffix: true, locale: ar })}</div>
      )}
    </Card>
  );
}