import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import { arSA } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { projectExpenseSchema, validateForm } from "@/lib/validation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight, Briefcase, Wallet, TrendingDown, TrendingUp, Users, ListTodo,
  Calendar, Upload, Download, Trash2, Plus, MoreHorizontal, Activity as ActivityIcon,
  CheckCircle2, Clock, AlertTriangle, FileText, Image as ImageIcon, Film, Layers,
  Sparkles, User as UserIcon, DollarSign, Target, Flag, Timer, CalendarDays,
  StickyNote, MessageSquare, Bell, Settings as SettingsIcon,
} from "lucide-react";
import { MilestonesSection, RisksSection, TimeTrackingSection, CalendarSection } from "./project-phase2";
import { NotesSection, ChatSection, NotificationsSection, SettingsSection } from "./project-modules-ext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TaskDetailView, type TaskSeed } from "@/components/production/task-detail-view";

/* ────────────────────────────────────────────────────────────
   Constants / helpers
   ──────────────────────────────────────────────────────────── */

const PROJECT_TYPES = [
  { value: "marketing",   label: "ماركتنج",  tint: "from-amber-500 to-orange-500" },
  { value: "programming", label: "برمجة",    tint: "from-sky-500 to-indigo-500" },
  { value: "mixed",       label: "مختلط",    tint: "from-violet-500 to-fuchsia-500" },
] as const;

const PROJECT_STATUS = [
  { value: "planned",     label: "مخطط",       dot: "bg-slate-400",   soft: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",     progress: 5   },
  { value: "in_progress", label: "قيد التنفيذ", dot: "bg-sky-500",     soft: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",                    progress: 45  },
  { value: "on_hold",     label: "متوقف",       dot: "bg-amber-500",   soft: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",       progress: 30  },
  { value: "delivered",   label: "تم التسليم",  dot: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900", progress: 100 },
  { value: "cancelled",   label: "ملغي",        dot: "bg-rose-500",    soft: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900",             progress: 0   },
] as const;

const EXPENSE_KINDS = [
  { value: "freelance", label: "فريلانس", color: "#8b5cf6" },
  { value: "tools",     label: "أدوات",   color: "#0ea5e9" },
  { value: "ads",       label: "إعلانات", color: "#f59e0b" },
  { value: "salary",    label: "مرتبات",  color: "#10b981" },
  { value: "other",     label: "أخرى",    color: "#94a3b8" },
] as const;

const TASK_STATUS = [
  { key: "pending",     label: "في الانتظار",  dot: "bg-slate-400"   },
  { key: "started",     label: "تم البدء",     dot: "bg-sky-500"     },
  { key: "progress_50", label: "50%",          dot: "bg-indigo-500"  },
  { key: "in_review",   label: "قيد المراجعة", dot: "bg-amber-500"   },
  { key: "submitted",   label: "تم التسليم",   dot: "bg-violet-500"  },
  { key: "approved",    label: "معتمد",        dot: "bg-emerald-500" },
] as const;

const labelOf = <T extends { value: string; label: string }>(arr: readonly T[], v: string) =>
  arr.find((x) => x.value === v)?.label ?? v;

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("en-US")} ج`;
const fmtDate  = (d?: string | null) => d ? new Date(d).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const initials = (s?: string) => (s ?? "؟").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

/* ────────────────────────────────────────────────────────────
   Root component
   ──────────────────────────────────────────────────────────── */

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["agency_project_full", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("agency_projects")
        .select("*, client:agency_clients(id, name, contact_name, email, phone)")
        .eq("id", projectId).maybeSingle();
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["ws_members", projectId],
    queryFn: async () => (await supabase.from("project_members")
      .select("*, freelancer:freelancers(full_name, specialty, phone, email), profile:profiles!project_members_user_id_fkey(display_name, email)")
      .eq("project_id", projectId)).data ?? [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["ws_expenses", projectId],
    queryFn: async () => (await supabase.from("project_expenses")
      .select("*, freelancer:freelancers(full_name)")
      .eq("project_id", projectId)
      .order("expense_date", { ascending: false })).data ?? [],
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["ws_tasks", project?.name],
    enabled: !!project?.name,
    queryFn: async () => (await supabase.from("tasks")
      .select("id, title, status, type, priority, due_at, assignee_id, project_name")
      .eq("project_name", project!.name)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const status = PROJECT_STATUS.find((s) => s.value === project?.status);
  const type   = PROJECT_TYPES.find((s) => s.value === project?.type);

  const budget    = Number(project?.budget ?? 0);
  const spent     = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const remaining = budget - spent;
  const spendPct  = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const profit    = remaining;
  const margin    = budget > 0 ? (profit / budget) * 100 : 0;
  const daysLeft  = project?.due_date ? differenceInCalendarDays(new Date(project.due_date), new Date()) : null;
  const totalTasks= tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "approved" || t.status === "submitted").length;
  const taskPct   = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
  const progressPct = totalTasks > 0 ? taskPct : (status?.progress ?? 0);

  const health: { label: string; tone: string; icon: typeof CheckCircle2 } = useMemo(() => {
    if (project?.status === "cancelled") return { label: "ملغي",     tone: "text-rose-600",    icon: AlertTriangle };
    if (project?.status === "delivered") return { label: "مكتمل",    tone: "text-emerald-600", icon: CheckCircle2 };
    if (remaining < 0)                    return { label: "تجاوز ميزانية", tone: "text-rose-600", icon: AlertTriangle };
    if (daysLeft !== null && daysLeft < 0) return { label: "متأخر",   tone: "text-rose-600",    icon: AlertTriangle };
    if (daysLeft !== null && daysLeft <= 7 && progressPct < 70) return { label: "بحاجة انتباه", tone: "text-amber-600", icon: AlertTriangle };
    return { label: "على المسار", tone: "text-emerald-600", icon: CheckCircle2 };
  }, [project?.status, remaining, daysLeft, progressPct]);

  const updateStatus = useMutation({
    mutationFn: async (v: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("agency_projects").update({ status: v as any }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      qc.invalidateQueries({ queryKey: ["agency_project_full", projectId] });
      qc.invalidateQueries({ queryKey: ["agency_projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <WorkspaceSkeleton />;
  if (!project) {
    return (
      <div className="min-h-[50vh] grid place-items-center" dir="rtl">
        <div className="text-center space-y-3">
          <div className="text-lg font-semibold">المشروع غير موجود</div>
          <Button asChild variant="outline"><Link to="/agency/projects"><ArrowRight className="h-4 w-4 ml-1" /> العودة للمشاريع</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/agency" className="hover:text-foreground transition-colors">الوكالة</Link>
        <span className="opacity-40">/</span>
        <Link to="/agency/projects" className="hover:text-foreground transition-colors">المشاريع</Link>
        <span className="opacity-40">/</span>
        <span className="text-foreground font-medium truncate">{project.name}</span>
      </nav>

      {/* Header card */}
      <Card className="relative overflow-hidden rounded-2xl border-0 shadow-[var(--shadow-elegant,0_8px_30px_rgba(0,0,0,0.06))] animate-fade-in">
        <div className={cn("absolute inset-0 opacity-90 bg-gradient-to-br", type?.tint ?? "from-indigo-500 to-violet-500")} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="relative p-5 md:p-6 text-white">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
            <div className="min-w-0 flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <Briefcase className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold truncate">{project.name}</h1>
                <div className="flex items-center gap-2 text-xs md:text-sm text-white/85 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1"><span className={cn("h-1.5 w-1.5 rounded-full", status?.dot)} />{status?.label}</span>
                  <span className="opacity-50">·</span>
                  <span>{type?.label}</span>
                  {project.client?.name && (<><span className="opacity-50">·</span><span className="truncate">{project.client.name}</span></>)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={project.status} onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className="h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button asChild variant="secondary" size="sm" className="h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm">
                <Link to="/agency/projects"><ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs mb-1.5 text-white/85">
              <span>التقدّم</span>
              <span className="tabular-nums font-semibold">{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <MetaChip icon={Calendar}  label="البدء"    value={fmtDate(project.start_date)} />
            <MetaChip icon={Target}    label="التسليم"  value={fmtDate(project.due_date)} />
            <MetaChip icon={Users}     label="الفريق"   value={`${members.length} عضو`} />
            <MetaChip icon={health.icon} label="الحالة الصحية" value={health.label} valueClass="!text-white" />
          </div>
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Wallet}       label="الميزانية"  value={fmtMoney(budget)}     tone="indigo" />
        <Kpi icon={TrendingDown} label="المصروف"    value={fmtMoney(spent)}      tone="rose"  hint={`${Math.round(spendPct)}%`} />
        <Kpi icon={TrendingUp}   label="المتبقي"    value={fmtMoney(remaining)}  tone={remaining >= 0 ? "emerald" : "rose"} />
        <Kpi icon={DollarSign}   label="هامش الربح" value={`${Math.round(margin)}%`} tone="amber" />
        <Kpi icon={ListTodo}     label="المهام"     value={`${doneTasks}/${totalTasks}`} tone="sky" />
        <Kpi icon={Clock}        label="أيام متبقية" value={daysLeft === null ? "—" : `${daysLeft}`} tone={daysLeft !== null && daysLeft < 0 ? "rose" : "violet"} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="sticky top-0 z-10 -mx-2 px-2 py-1 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <TabsList className="rounded-xl bg-muted/60 p-1 h-10 overflow-x-auto flex w-full md:w-auto">
            <TabsTrigger value="overview"  className="rounded-lg gap-1.5"><Sparkles     className="h-3.5 w-3.5" /> نظرة عامة</TabsTrigger>
            <TabsTrigger value="tasks"     className="rounded-lg gap-1.5"><ListTodo     className="h-3.5 w-3.5" /> المهام</TabsTrigger>
            <TabsTrigger value="finance"   className="rounded-lg gap-1.5"><Wallet       className="h-3.5 w-3.5" /> المالية</TabsTrigger>
            <TabsTrigger value="income"    className="rounded-lg gap-1.5"><DollarSign   className="h-3.5 w-3.5" /> الدخل</TabsTrigger>

            <TabsTrigger value="team"      className="rounded-lg gap-1.5"><Users        className="h-3.5 w-3.5" /> الفريق</TabsTrigger>
            <TabsTrigger value="files"     className="rounded-lg gap-1.5"><Upload       className="h-3.5 w-3.5" /> الملفات</TabsTrigger>
            <TabsTrigger value="milestones" className="rounded-lg gap-1.5"><Flag         className="h-3.5 w-3.5" /> المراحل</TabsTrigger>
            <TabsTrigger value="time"      className="rounded-lg gap-1.5"><Timer        className="h-3.5 w-3.5" /> الوقت</TabsTrigger>
            <TabsTrigger value="risks"     className="rounded-lg gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> المخاطر</TabsTrigger>
            <TabsTrigger value="calendar"  className="rounded-lg gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> التقويم</TabsTrigger>
            <TabsTrigger value="activity"  className="rounded-lg gap-1.5"><ActivityIcon className="h-3.5 w-3.5" /> النشاط</TabsTrigger>
            <TabsTrigger value="notes"     className="rounded-lg gap-1.5"><StickyNote   className="h-3.5 w-3.5" /> ملاحظات</TabsTrigger>
            <TabsTrigger value="chat"      className="rounded-lg gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> شات</TabsTrigger>
            <TabsTrigger value="notifs"    className="rounded-lg gap-1.5"><Bell         className="h-3.5 w-3.5" /> إشعارات</TabsTrigger>
            <TabsTrigger value="settings"  className="rounded-lg gap-1.5"><SettingsIcon className="h-3.5 w-3.5" /> إعدادات</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="animate-fade-in">
          <OverviewSection project={project} members={members} expenses={expenses} tasks={tasks} spent={spent} budget={budget} />
        </TabsContent>
        <TabsContent value="tasks" className="animate-fade-in">
          <TasksSection tasks={tasks} />
        </TabsContent>
        <TabsContent value="finance" className="animate-fade-in">
          <FinanceSection projectId={projectId} expenses={expenses} budget={budget} spent={spent} />
        </TabsContent>
        <TabsContent value="team" className="animate-fade-in">
          <TeamSection projectId={projectId} members={members} />
        </TabsContent>
        <TabsContent value="files" className="animate-fade-in">
          <FilesSection projectId={projectId} />
        </TabsContent>
        <TabsContent value="milestones" className="animate-fade-in">
          <MilestonesSection projectId={projectId} />
        </TabsContent>
        <TabsContent value="time" className="animate-fade-in">
          <TimeTrackingSection projectId={projectId} />
        </TabsContent>
        <TabsContent value="risks" className="animate-fade-in">
          <RisksSection projectId={projectId} />
        </TabsContent>
        <TabsContent value="calendar" className="animate-fade-in">
          <CalendarSection projectId={projectId} />
        </TabsContent>
        <TabsContent value="activity" className="animate-fade-in">
          <ActivitySection project={project} members={members} expenses={expenses} />
        </TabsContent>
        <TabsContent value="notes" className="animate-fade-in">
          <NotesSection projectId={projectId} />
        </TabsContent>
        <TabsContent value="chat" className="animate-fade-in">
          <ChatSection projectId={projectId} />
        </TabsContent>
        <TabsContent value="notifs" className="animate-fade-in">
          <NotificationsSection projectId={projectId} />
        </TabsContent>
        <TabsContent value="settings" className="animate-fade-in">
          <SettingsSection projectId={projectId} project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Header pieces
   ──────────────────────────────────────────────────────────── */

function MetaChip({ icon: Icon, label, value, valueClass }: { icon: typeof Calendar; label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/70">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn("text-sm font-semibold mt-0.5 truncate", valueClass)}>{value}</div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }: {
  icon: typeof Wallet; label: string; value: string; hint?: string;
  tone: "indigo" | "rose" | "emerald" | "amber" | "sky" | "violet";
}) {
  const map = {
    indigo:  "text-indigo-600 dark:text-indigo-300  bg-indigo-500/10  ring-indigo-500/20",
    rose:    "text-rose-600 dark:text-rose-300      bg-rose-500/10    ring-rose-500/20",
    emerald: "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
    amber:   "text-amber-600 dark:text-amber-300    bg-amber-500/10   ring-amber-500/20",
    sky:     "text-sky-600 dark:text-sky-300        bg-sky-500/10     ring-sky-500/20",
    violet:  "text-violet-600 dark:text-violet-300  bg-violet-500/10  ring-violet-500/20",
  }[tone];
  return (
    <Card className="p-3.5 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-center justify-between">
        <span className={cn("h-8 w-8 grid place-items-center rounded-lg ring-1", map)}>
          <Icon className="h-4 w-4" />
        </span>
        {hint && <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{hint}</span>}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums truncate">{value}</div>
    </Card>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4" dir="rtl">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Overview section
   ──────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MemberRow = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExpenseRow = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskRow = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectRow = any;

function OverviewSection({ project, members, expenses, tasks, spent, budget }: {
  project: ProjectRow; members: MemberRow[]; expenses: ExpenseRow[]; tasks: TaskRow[]; spent: number; budget: number;
}) {
  const spendPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  // Cash-flow series: last 30 days cumulative spend
  const series = useMemo(() => {
    const days = 30;
    const now = new Date();
    const buckets = Array.from({ length: days }).map((_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - (days - 1 - i));
      return { key: d.toISOString().slice(0, 10), day: d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit" }), spend: 0 };
    });
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    expenses.forEach((e) => { const i = idx.get((e.expense_date ?? "").slice(0, 10)); if (i !== undefined) buckets[i].spend += Number(e.amount || 0); });
    let acc = 0;
    return buckets.map((b) => ({ day: b.day, spend: (acc += b.spend) }));
  }, [expenses]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 rounded-2xl lg:col-span-2 border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">التدفق النقدي</h3>
            <p className="text-xs text-muted-foreground">إجمالي الصرف المتراكم خلال 30 يوم</p>
          </div>
          <Badge variant="secondary" className="rounded-md">{fmtMoney(spent)}</Badge>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(Number(v))} />
              <Area type="monotone" dataKey="spend" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradSpend)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">استهلاك الميزانية</span>
            <span className="tabular-nums font-semibold">{Math.round(spendPct)}%</span>
          </div>
          <Progress value={spendPct} className="h-2" />
        </div>
      </Card>

      <Card className="p-4 rounded-2xl border">
        <h3 className="font-semibold mb-3">العميل</h3>
        {project.client ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11"><AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-sm">{initials(project.client.name)}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <div className="font-medium truncate">{project.client.name}</div>
                {project.client.contact_name && <div className="text-xs text-muted-foreground truncate">{project.client.contact_name}</div>}
              </div>
            </div>
            <div className="space-y-1 text-xs">
              {project.client.phone && <div className="text-muted-foreground">📞 {project.client.phone}</div>}
              {project.client.email && <div className="text-muted-foreground truncate">✉ {project.client.email}</div>}
            </div>
          </div>
        ) : <div className="text-sm text-muted-foreground">لا يوجد عميل مرتبط</div>}

        <div className="mt-4 pt-4 border-t space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">فريق سريع</h4>
          {members.slice(0, 4).map((m) => {
            const name = m.kind === "staff" ? (m.profile?.display_name ?? m.profile?.email ?? "موظف") : (m.freelancer?.full_name ?? "فريلانسر");
            return (
              <div key={m.id} className="flex items-center gap-2">
                <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback></Avatar>
                <div className="min-w-0 text-xs">
                  <div className="truncate font-medium">{name}</div>
                  <div className="text-muted-foreground truncate">{m.role ?? (m.kind === "staff" ? "موظف" : "فريلانسر")}</div>
                </div>
              </div>
            );
          })}
          {members.length === 0 && <div className="text-xs text-muted-foreground">لا يوجد أعضاء بعد</div>}
        </div>
      </Card>

      <OverviewTasksCard tasks={tasks} />

      <Card className="p-4 rounded-2xl border">
        <h3 className="font-semibold mb-3">أحدث المصاريف</h3>
        <div className="space-y-2">
          {expenses.slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{e.title}</div>
                <div className="text-[11px] text-muted-foreground">{fmtDate(e.expense_date)}</div>
              </div>
              <div className="tabular-nums font-semibold text-rose-600 shrink-0">−{fmtMoney(Number(e.amount))}</div>
            </div>
          ))}
          {expenses.length === 0 && <EmptyBox text="لا مصاريف بعد" />}
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Tasks section (Kanban + list)
   ──────────────────────────────────────────────────────────── */

function TasksSection({ tasks }: { tasks: TaskRow[] }) {
  return <TasksSectionImpl tasks={tasks} />;
}

function OverviewTasksCard({ tasks }: { tasks: TaskRow[] }) {
  const [openTask, setOpenTask] = useState<TaskSeed | null>(null);
  return (
    <Card className="p-4 rounded-2xl border lg:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">أحدث المهام</h3>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {tasks.slice(0, 6).map((t) => {
          const st = TASK_STATUS.find((s) => s.key === t.status);
          return (
            <button
              key={t.id}
              onClick={() => setOpenTask(t as unknown as TaskSeed)}
              className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-right"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("h-2 w-2 rounded-full shrink-0", st?.dot)} />
                <span className="text-sm truncate">{t.title}</span>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">{st?.label}</span>
            </button>
          );
        })}
        {tasks.length === 0 && <EmptyBox text="لا توجد مهام مرتبطة" />}
      </div>
      <Sheet open={!!openTask} onOpenChange={(o) => !o && setOpenTask(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
          {openTask && <TaskDetailView id={openTask.id} initialTask={openTask} />}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function TasksSectionImpl({ tasks }: { tasks: TaskRow[] }) {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [openTask, setOpenTask] = useState<TaskSeed | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border p-0.5 bg-muted/40">
          <button onClick={() => setView("kanban")} className={cn("h-8 px-3 text-xs rounded-md transition-colors", view === "kanban" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>Kanban</button>
          <button onClick={() => setView("list")}   className={cn("h-8 px-3 text-xs rounded-md transition-colors", view === "list"   ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>List</button>
        </div>
        <div className="text-xs text-muted-foreground">{tasks.length} مهمة</div>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {TASK_STATUS.map((col) => {
            const items = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="rounded-xl border bg-muted/20 min-h-[220px] flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                    <span className="text-xs font-semibold">{col.label}</span>
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground bg-background/70 rounded px-1.5">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setOpenTask(t as unknown as TaskSeed)}
                      className="p-2.5 rounded-lg border bg-card text-xs hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer"
                    >
                      <div className="font-medium line-clamp-2">{t.title}</div>
                      {t.due_at && <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{fmtDate(t.due_at)}</div>}
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-[10px] text-muted-foreground/60 text-center py-4">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-xl overflow-hidden divide-y">
          {tasks.map((t) => {
            const st = TASK_STATUS.find((s) => s.key === t.status);
            return (
              <div
                key={t.id}
                onClick={() => setOpenTask(t as unknown as TaskSeed)}
                className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", st?.dot)} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">{st?.label} · {t.type}</div>
                  </div>
                </div>
                {t.due_at && <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(t.due_at)}</span>}
              </div>
            );
          })}
          {tasks.length === 0 && <div className="p-8"><EmptyBox text="لا توجد مهام مرتبطة بهذا المشروع" /></div>}
        </Card>
      )}

      <Card className="p-3 rounded-xl border-dashed border-2 text-center bg-muted/20">
        <p className="text-xs text-muted-foreground">لإنشاء مهمة جديدة مرتبطة بهذا المشروع، افتح <Link to="/agency/tasks" className="underline text-primary">صفحة المهام</Link> واستخدم اسم المشروع نفسه.</p>
      </Card>

      <Sheet open={!!openTask} onOpenChange={(o) => !o && setOpenTask(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
          {openTask && <TaskDetailView id={openTask.id} initialTask={openTask} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Finance section
   ──────────────────────────────────────────────────────────── */

function FinanceSection({ projectId, expenses, budget, spent }: {
  projectId: string; expenses: ExpenseRow[]; budget: number; spent: number;
}) {
  const remaining = budget - spent;
  const spendPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  const byKind = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.kind, (map.get(e.kind) ?? 0) + Number(e.amount || 0)));
    return EXPENSE_KINDS.map((k) => ({ name: k.label, value: map.get(k.value) ?? 0, color: k.color })).filter((x) => x.value > 0);
  }, [expenses]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const key = (e.expense_date ?? "").slice(0, 7);
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ month: k, amount: v }));
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 rounded-2xl border lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">المصاريف الشهرية</h3>
              <p className="text-xs text-muted-foreground">توزيع الصرف حسب الشهر</p>
            </div>
            <AddExpenseDialog projectId={projectId} />
          </div>
          <div className="h-56">
            {monthly.length === 0 ? (
              <EmptyBox text="لا توجد بيانات كافية لعرض الرسم" />
            ) : (
              <ResponsiveContainer>
                <BarChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(Number(v))} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border">
          <h3 className="font-semibold mb-3">تصنيف المصاريف</h3>
          <div className="h-40">
            {byKind.length === 0 ? (
              <EmptyBox text="لا يوجد" />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byKind} innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                    {byKind.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 space-y-1">
            {byKind.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                <span className="tabular-nums font-medium">{fmtMoney(s.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4 rounded-2xl border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">تفاصيل المصاريف</h3>
            <div className="text-xs text-muted-foreground mt-0.5">
              الميزانية: <span className="tabular-nums">{fmtMoney(budget)}</span> · المصروف: <span className="tabular-nums text-rose-600">{fmtMoney(spent)}</span> · المتبقي: <span className={cn("tabular-nums font-semibold", remaining >= 0 ? "text-emerald-600" : "text-rose-600")}>{fmtMoney(remaining)}</span>
            </div>
          </div>
        </div>
        <div className="mb-3">
          <Progress value={spendPct} className="h-2" />
        </div>
        <div className="divide-y">
          {expenses.map((e) => (
            <ExpenseRowView key={e.id} e={e} projectId={projectId} />
          ))}
          {expenses.length === 0 && <EmptyBox text="لا مصاريف مسجلة" />}
        </div>
      </Card>
    </div>
  );
}

function ExpenseRowView({ e, projectId }: { e: ExpenseRow; projectId: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_expenses").delete().eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["ws_expenses", projectId] });
      qc.invalidateQueries({ queryKey: ["agency_expenses_all"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const k = EXPENSE_KINDS.find((x) => x.value === e.kind);
  return (
    <div className="py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${k?.color}22`, color: k?.color }}>
          <Wallet className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{e.title}</div>
          <div className="text-[11px] text-muted-foreground">{fmtDate(e.expense_date)} · {k?.label}{e.freelancer?.full_name ? ` · ${e.freelancer.full_name}` : ""}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold tabular-nums text-rose-600">−{fmtMoney(Number(e.amount))}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-rose-600" onClick={() => del.mutate()}><Trash2 className="h-3.5 w-3.5 ml-1" /> حذف</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function AddExpenseDialog({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", kind: "other", expense_date: new Date().toISOString().slice(0, 10), notes: "" });
  const add = useMutation({
    mutationFn: async () => {
      const v = validateForm(projectExpenseSchema, {
        title: form.title,
        amount: form.amount,
        spent_at: form.expense_date,
        notes: form.notes,
      });
      if (!v.ok) throw new Error(v.message);
      const amt = parseFloat(form.amount);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("project_expenses").insert({
        project_id: projectId, title: form.title, amount: amt,
        kind: form.kind as any, expense_date: form.expense_date, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إضافة المصروف");
      setOpen(false);
      setForm({ title: "", amount: "", kind: "other", expense_date: new Date().toISOString().slice(0, 10), notes: "" });
      qc.invalidateQueries({ queryKey: ["ws_expenses", projectId] });
      qc.invalidateQueries({ queryKey: ["agency_expenses_all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 rounded-lg"><Plus className="h-3.5 w-3.5 ml-1" /> مصروف</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>مصروف جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>البند</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً: اشتراك أداة..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>المبلغ</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>التاريخ</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
          </div>
          <div>
            <Label>النوع</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXPENSE_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>ملاحظات</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => add.mutate()} disabled={add.isPending}>إضافة</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────
   Team section
   ──────────────────────────────────────────────────────────── */

function TeamSection({ projectId, members }: { projectId: string; members: MemberRow[] }) {
  const qc = useQueryClient();

  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers"],
    queryFn: async () => (await supabase.from("freelancers").select("id, full_name, specialty").order("full_name")).data ?? [],
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["profiles_lite_agency"],
    queryFn: async () => (await supabase.from("profiles").select("id, display_name, email").order("display_name")).data ?? [],
  });

  const [form, setForm] = useState({ kind: "freelancer" as "freelancer" | "staff", who: "", role: "", amount: "" });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.who) throw new Error("اختر عضو");
      const payload: Record<string, unknown> = {
        project_id: projectId, kind: form.kind, role: form.role || null, agreed_amount: parseFloat(form.amount) || 0,
      };
      if (form.kind === "staff") payload.user_id = form.who;
      else payload.freelancer_id = form.who;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("project_members").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الإضافة");
      setForm({ kind: form.kind, who: "", role: "", amount: "" });
      qc.invalidateQueries({ queryKey: ["ws_members", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["ws_members", projectId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalAgreed = members.reduce((s, m) => s + Number(m.agreed_amount || 0), 0);
  const totalPaid   = members.reduce((s, m) => s + Number(m.paid_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi icon={Users}    label="عدد الأعضاء"   value={`${members.length}`}       tone="indigo" />
        <Kpi icon={Wallet}   label="إجمالي الأجور" value={fmtMoney(totalAgreed)}     tone="amber" />
        <Kpi icon={CheckCircle2} label="مدفوع" value={fmtMoney(totalPaid)}           tone="emerald" />
      </div>

      <Card className="p-4 rounded-2xl border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">أعضاء الفريق</h3>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {members.map((m) => {
            const name = m.kind === "staff" ? (m.profile?.display_name ?? m.profile?.email ?? "موظف") : (m.freelancer?.full_name ?? "فريلانسر");
            return (
              <div key={m.id} className="p-3 rounded-xl border bg-card flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-9 w-9"><AvatarFallback className={cn("text-xs text-white", m.kind === "staff" ? "bg-gradient-to-br from-indigo-500 to-blue-500" : "bg-gradient-to-br from-violet-500 to-fuchsia-500")}>{initials(name)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {m.kind === "staff" ? "موظف دائم" : `فريلانسر${m.freelancer?.specialty ? ` · ${m.freelancer.specialty}` : ""}`}
                      {m.role ? ` · ${m.role}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-semibold tabular-nums">{fmtMoney(Number(m.agreed_amount))}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {m.payment_status === "paid" ? "مدفوع" : m.payment_status === "partial" ? "جزئي" : "غير مدفوع"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(m.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                </div>
              </div>
            );
          })}
          {members.length === 0 && <div className="md:col-span-2"><EmptyBox text="لم يُعيَّن أحد بعد" /></div>}
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <div>
            <Label className="text-[11px] text-muted-foreground">النوع</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as "freelancer" | "staff", who: "" })}>
              <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="freelancer">فريلانسر</SelectItem>
                <SelectItem value="staff">موظف دائم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px] text-muted-foreground">العضو</Label>
            <Select value={form.who} onValueChange={(v) => setForm({ ...form, who: v })}>
              <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                {form.kind === "freelancer"
                  ? freelancers.map((f) => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)
                  : staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.display_name ?? s.email ?? s.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">الدور</Label>
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-9 rounded-lg" placeholder="مطور، مصمم..." />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">الأجر</Label>
            <div className="flex gap-1">
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-9 rounded-lg" placeholder="0" />
              <Button size="sm" className="h-9 shrink-0" onClick={() => add.mutate()} disabled={add.isPending}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Files section
   ──────────────────────────────────────────────────────────── */

type ProjectFile = { name: string; id: string; created_at: string; metadata?: { size?: number; mimetype?: string } | null };

function FilesSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const prefix = `agency-projects/${projectId}`;

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["ws_files", projectId],
    queryFn: async () => {
      const { data } = await supabase.storage.from("task-files").list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      return (data ?? []) as ProjectFile[];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${prefix}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("task-files").upload(path, file);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم رفع الملف"); qc.invalidateQueries({ queryKey: ["ws_files", projectId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.storage.from("task-files").remove([`${prefix}/${name}`]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["ws_files", projectId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(name: string) {
    const { data, error } = await supabase.storage.from("task-files").createSignedUrl(`${prefix}/${name}`, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  function iconFor(mime?: string) {
    if (!mime) return FileText;
    if (mime.startsWith("image/")) return ImageIcon;
    if (mime.startsWith("video/")) return Film;
    if (mime.includes("pdf") || mime.includes("document") || mime.includes("word")) return FileText;
    return Layers;
  }

  return (
    <Card className="p-4 rounded-2xl border">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">الملفات والمرفقات</h3>
          <p className="text-xs text-muted-foreground">صور، PDF، فيديو، ومستندات المشروع</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
          <span className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Upload className="h-4 w-4" /> رفع ملف
          </span>
        </label>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : files.length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center bg-muted/20">
          <Upload className="h-6 w-6 mx-auto text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">اسحب الملفات هنا أو اضغط "رفع ملف"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {files.map((f) => {
            const Icon = iconFor(f.metadata?.mimetype);
            const size = f.metadata?.size ? `${(f.metadata.size / 1024).toFixed(0)} KB` : "";
            const clean = f.name.replace(/^\d+-/, "");
            return (
              <div key={f.id ?? f.name} className="group relative p-3 rounded-xl border bg-card hover:shadow-md transition-all">
                <div className="h-16 rounded-lg bg-muted/40 grid place-items-center mb-2">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-xs font-medium truncate" title={clean}>{clean}</div>
                <div className="text-[10px] text-muted-foreground">{size}</div>
                <div className="absolute inset-x-2 bottom-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => download(f.name)}><Download className="h-3 w-3" /></Button>
                  <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => remove.mutate(f.name)}><Trash2 className="h-3 w-3 text-rose-500" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   Activity section
   ──────────────────────────────────────────────────────────── */

type ActivityItem = { id: string; icon: typeof ActivityIcon; title: string; sub?: string; date: string; tone: string };

function ActivitySection({ project, members, expenses }: { project: ProjectRow; members: MemberRow[]; expenses: ExpenseRow[] }) {
  const items: ActivityItem[] = useMemo(() => {
    const arr: ActivityItem[] = [];
    arr.push({ id: `p-${project.id}`, icon: Briefcase, title: "تم إنشاء المشروع", sub: project.name, date: project.created_at, tone: "text-indigo-600 bg-indigo-500/10" });
    if (project.updated_at !== project.created_at) {
      arr.push({ id: `pu-${project.id}`, icon: Sparkles, title: "تم تحديث المشروع", date: project.updated_at, tone: "text-violet-600 bg-violet-500/10" });
    }
    members.forEach((m) => {
      const name = m.kind === "staff" ? (m.profile?.display_name ?? m.profile?.email ?? "موظف") : (m.freelancer?.full_name ?? "فريلانسر");
      arr.push({ id: `m-${m.id}`, icon: UserIcon, title: `انضم ${name}`, sub: m.role ?? undefined, date: (m as unknown as { created_at: string }).created_at, tone: "text-emerald-600 bg-emerald-500/10" });
    });
    expenses.forEach((e) => {
      arr.push({ id: `e-${e.id}`, icon: Wallet, title: `مصروف: ${e.title}`, sub: fmtMoney(Number(e.amount)), date: e.created_at ?? e.expense_date, tone: "text-rose-600 bg-rose-500/10" });
    });
    return arr.filter((x) => !!x.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [project, members, expenses]);

  return (
    <Card className="p-4 rounded-2xl border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">سجل النشاط</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {items.length === 0 ? <EmptyBox text="لا يوجد نشاط بعد" /> : (
        <ol className="relative border-r-2 border-dashed border-border pr-5 space-y-4">
          {items.map((it) => (
            <li key={it.id} className="relative">
              <span className={cn("absolute -right-[27px] top-0 h-6 w-6 rounded-full grid place-items-center ring-4 ring-background", it.tone)}>
                <it.icon className="h-3 w-3" />
              </span>
              <div className="text-sm font-medium">{it.title}</div>
              {it.sub && <div className="text-xs text-muted-foreground">{it.sub}</div>}
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {(() => {
                  try { return formatDistanceToNow(new Date(it.date), { addSuffix: true, locale: arSA }); }
                  catch { return fmtDate(it.date); }
                })()}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────── */

function EmptyBox({ text }: { text: string }) {
  return <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-lg">{text}</div>;
}