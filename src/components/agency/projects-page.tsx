import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { differenceInCalendarDays, format, subDays, startOfDay } from "date-fns";
import { arSA } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { agencyClientSchema, freelancerSchema, validateForm } from "@/lib/validation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import {
  Briefcase, Users, UserCircle2, Wallet, PlusCircle, Star, Phone, Mail,
  FileSpreadsheet, TrendingUp, TrendingDown, Search, LayoutGrid, List as ListIcon,
  Sparkles, Activity as ActivityIcon, Calendar as CalendarIcon, CheckCircle2,
  AlertTriangle, ArrowUpRight, Filter, Download, MoreHorizontal, Target,
  CircleDot, Clock, ChevronLeft, ChevronRight, Flag, Palette, Code2, Layers,
  Rocket, PauseCircle, XCircle, Building2, FileText, Tag, Info, CheckCheck,
  Repeat, Infinity as InfinityIcon, RefreshCw, Zap,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────── */

const PROJECT_TYPES = [
  { value: "marketing",   label: "ماركتنج",  tint: "from-amber-500 to-orange-500",  chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: "programming", label: "برمجة",    tint: "from-sky-500 to-indigo-500",     chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" },
  { value: "mixed",       label: "مختلط",    tint: "from-violet-500 to-fuchsia-500", chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
] as const;

const PROJECT_STATUS = [
  { value: "planned",     label: "مخطط",       dot: "bg-slate-400",   chip: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",       progress: 5,   color: "#94a3b8" },
  { value: "in_progress", label: "قيد التنفيذ", dot: "bg-sky-500",     chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",              progress: 45,  color: "#0ea5e9" },
  { value: "on_hold",     label: "متوقف",       dot: "bg-amber-500",   chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",     progress: 30,  color: "#f59e0b" },
  { value: "delivered",   label: "تم التسليم",  dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", progress: 100, color: "#10b981" },
  { value: "cancelled",   label: "ملغي",        dot: "bg-rose-500",    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",           progress: 0,   color: "#ef4444" },
] as const;

const SPECIALTIES = [
  { value: "programming", label: "برمجة" },
  { value: "design",      label: "ديزاين" },
  { value: "montage",     label: "مونتاج" },
  { value: "writing",     label: "كتابة" },
  { value: "ads",         label: "إعلانات" },
  { value: "photography", label: "تصوير" },
  { value: "other",       label: "أخرى" },
] as const;

const RATE_KINDS = [
  { value: "hourly",      label: "بالساعة" },
  { value: "fixed",       label: "مبلغ ثابت" },
  { value: "per_project", label: "على المشروع" },
] as const;

const EXPENSE_KINDS = [
  { value: "freelance", label: "فريلانس", color: "#8b5cf6" },
  { value: "tools",     label: "أدوات",   color: "#0ea5e9" },
  { value: "ads",       label: "إعلانات", color: "#f59e0b" },
  { value: "salary",    label: "مرتبات",  color: "#10b981" },
  { value: "other",     label: "أخرى",    color: "#94a3b8" },
] as const;

const PRIORITIES = [
  { value: "low",      label: "منخفضة",  chip: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",     bar: "bg-slate-400",    ring: "ring-slate-500/30" },
  { value: "medium",   label: "متوسطة",  chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",              bar: "bg-sky-500",      ring: "ring-sky-500/30" },
  { value: "high",     label: "عالية",   chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",     bar: "bg-amber-500",    ring: "ring-amber-500/30" },
  { value: "critical", label: "حرجة",    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",          bar: "bg-rose-500",     ring: "ring-rose-500/30" },
] as const;

const ENGAGEMENT_MODELS = [
  {
    value: "one_time",
    label: "مشروع لحظي (Freelance)",
    short: "لحظي",
    desc: "تسليم واحد بميزانية وتاريخ نهاية محدّدين، ثم يُؤرشف",
    examples: "موقع، هوية، حملة، تطبيق",
    icon: Zap,
    tint: "from-violet-500 to-fuchsia-500",
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  {
    value: "retainer",
    label: "عقد مستمر (Retainer)",
    short: "مستمر",
    desc: "عمل شهري متكرر بفوترة دورية، يستقبل مهام وفواتير باستمرار",
    examples: "سوشيال، SEO، صيانة، أداء إعلاني",
    icon: Repeat,
    tint: "from-emerald-500 to-teal-500",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
] as const;

const BILLING_CYCLES = [
  { value: "monthly",   label: "شهري",       months: 1 },
  { value: "quarterly", label: "ربع سنوي",   months: 3 },
  { value: "yearly",    label: "سنوي",       months: 12 },
] as const;

const labelOf = <T extends { value: string; label: string }>(arr: readonly T[], v: string) =>
  arr.find((x) => x.value === v)?.label ?? v;

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("en-US")} ج`;
const initials = (s?: string | null) =>
  (s ?? "؟").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

/* ────────────────────────────────────────────────────────────
   Data hooks
   ──────────────────────────────────────────────────────────── */

function useProjects() {
  return useQuery({
    queryKey: ["agency_projects"],
    queryFn: async () => (await supabase.from("agency_projects")
      .select("*, client:agency_clients(name)")
      .order("created_at", { ascending: false })).data ?? [],
  });
}
function useClients() {
  return useQuery({
    queryKey: ["agency_clients"],
    queryFn: async () => (await supabase.from("agency_clients").select("*").order("name")).data ?? [],
  });
}
function useFreelancers() {
  return useQuery({
    queryKey: ["freelancers", "agency"],
    queryFn: async () =>
      (
        await supabase
          .from("freelancers")
          .select("*")
          .or("scope.eq.agency,scope.eq.both")
          .order("full_name")
      ).data ?? [],
  });
}
function useAllExpenses() {
  return useQuery({
    queryKey: ["agency_expenses_all"],
    queryFn: async () => (await supabase.from("project_expenses")
      .select("*, project:agency_projects(name), freelancer:freelancers(full_name)")
      .order("expense_date", { ascending: false })).data ?? [],
  });
}
function useAllMembers() {
  return useQuery({
    queryKey: ["agency_members_all"],
    queryFn: async () => (await supabase.from("project_members")
      .select("project_id, kind, freelancer:freelancers(full_name)")).data ?? [],
  });
}

/* ────────────────────────────────────────────────────────────
   Root
   ──────────────────────────────────────────────────────────── */

export function AgencyProjectsPage() {
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: freelancers = [] } = useFreelancers();
  const { data: expenses = [] } = useAllExpenses();

  const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
  const totalSpent  = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const activeCount = projects.filter((p) => ["planned", "in_progress"].includes(p.status)).length;
  const doneCount   = projects.filter((p) => p.status === "delivered").length;
  const remaining   = totalBudget - totalSpent;
  const spendPct    = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const activeFreelancers = freelancers.filter((f) => f.is_active).length;
  const overdue = projects.filter((p) => {
    if (!p.due_date || ["delivered", "cancelled"].includes(p.status)) return false;
    return differenceInCalendarDays(new Date(p.due_date), new Date()) < 0;
  }).length;

  const exportPortfolio = () => {
    const rows = projects.map((p) => ({
      "المشروع": p.name,
      "العميل": (p as { client?: { name?: string } }).client?.name ?? "—",
      "النوع":  labelOf(PROJECT_TYPES, p.type),
      "الحالة": labelOf(PROJECT_STATUS, p.status),
      "الميزانية": Number(p.budget || 0),
      "المصروف": expenses.filter((e) => e.project_id === p.id).reduce((s, e) => s + Number(e.amount || 0), 0),
      "تاريخ البدء": p.start_date ?? "",
      "تاريخ التسليم": p.due_date ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projects");
    XLSX.writeFile(wb, `agency-portfolio-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("تم التصدير");
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Hero header — refined */}
      <Card className="relative overflow-hidden rounded-3xl border-0 shadow-[0_20px_60px_-20px_rgba(99,102,241,0.35)] animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-800" />
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative p-6 md:p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="min-w-0">
              <nav className="flex items-center gap-1.5 text-[11px] text-white/70 mb-2">
                <span>الوكالة</span>
                <ChevronLeft className="h-3 w-3 opacity-60" />
                <span className="font-medium text-white">لوحة تحكم المشاريع</span>
              </nav>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">لوحة تحكم مشاريع الوكالة</h1>
              <p className="text-purple-100/90 text-sm mt-1.5">
                لديك <span className="font-bold text-white">{activeCount}</span> مشروعًا نشطًا و
                <span className="font-bold text-white"> {activeFreelancers}</span> فريلانسر
                {overdue > 0 ? <> · <span className="text-rose-200 font-semibold">{overdue} متأخر</span></> : <> · تقدم ممتاز!</>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm" variant="outline"
                onClick={exportPortfolio}
                className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md gap-1.5"
              >
                <Download className="h-4 w-4" /> تصدير التقارير
              </Button>
              <NewProjectDialog trigger={
                <Button size="sm" className="h-10 px-5 rounded-xl bg-white text-violet-700 hover:bg-purple-50 gap-1.5 shadow-lg font-bold">
                  <PlusCircle className="h-4 w-4" /> مشروع جديد
                </Button>
              } />
            </div>
          </div>
        </div>
      </Card>

      {/* Modern KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <ModernKpi
          icon={Briefcase} tone="violet"
          label="مشاريع نشطة" value={String(activeCount)}
          delta={{ text: `${projects.length} إجمالي`, tone: "neutral" }}
        />
        <ModernKpi
          icon={Wallet} tone="emerald"
          label="إجمالي الميزانية" value={fmtMoney(totalBudget)}
          delta={{ text: `${projects.length} مشروع`, tone: "up" }}
        />
        <ModernKpi
          icon={TrendingDown} tone="amber"
          label="إجمالي المصروف" value={fmtMoney(totalSpent)}
          delta={{ text: `${spendPct}% مستهلك`, tone: spendPct > 80 ? "down" : "neutral" }}
        />
        <ModernKpi
          icon={UserCircle2} tone="blue"
          label="فريلانسرز نشطين" value={String(activeFreelancers)}
          delta={{ text: `${freelancers.length} إجمالي`, tone: "up" }}
        />
      </div>

      {/* Underline tabs — enterprise style */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="sticky top-0 z-20 -mx-2 px-2 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <TabsList className="h-auto bg-transparent p-0 gap-6 md:gap-8 w-full md:w-auto overflow-x-auto flex justify-start rounded-none">
            <UnderlineTab value="overview"    icon={Sparkles}    label="نظرة عامة" />
            <UnderlineTab value="projects"    icon={Briefcase}   label="المشاريع" count={projects.length} />
            <UnderlineTab value="clients"     icon={UserCircle2} label="العملاء" count={clients.length} />
            <UnderlineTab value="freelancers" icon={Users}       label="الفريلانسرز" count={freelancers.length} />
            <UnderlineTab value="expenses"    icon={Wallet}      label="الميزانية" count={expenses.length} />
          </TabsList>
        </div>

        <TabsContent value="overview"    className="animate-fade-in"><OverviewTab /></TabsContent>
        <TabsContent value="projects"    className="animate-fade-in"><ProjectsTab /></TabsContent>
        <TabsContent value="clients"     className="animate-fade-in"><ClientsTab /></TabsContent>
        <TabsContent value="freelancers" className="animate-fade-in"><FreelancersTab /></TabsContent>
        <TabsContent value="expenses"    className="animate-fade-in"><ExpensesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function UnderlineTab({ value, icon: Icon, label, count }: { value: string; icon: typeof Briefcase; label: string; count?: number }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative pb-3 pt-3 px-1 rounded-none bg-transparent shadow-none",
        "text-sm font-medium text-muted-foreground data-[state=active]:text-primary data-[state=active]:font-bold",
        "border-b-2 border-transparent data-[state=active]:border-primary",
        "hover:text-foreground transition-colors gap-1.5"
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
      {typeof count === "number" && (
        <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{count}</span>
      )}
    </TabsTrigger>
  );
}

function ModernKpi({ icon: Icon, tone, label, value, delta }: {
  icon: typeof Wallet;
  tone: "violet" | "emerald" | "amber" | "blue" | "rose";
  label: string;
  value: string;
  delta?: { text: string; tone: "up" | "down" | "neutral" };
}) {
  const toneMap: Record<string, string> = {
    violet:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    rose:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  const deltaMap: Record<string, string> = {
    up:      "text-emerald-600 bg-emerald-500/10",
    down:    "text-rose-600 bg-rose-500/10",
    neutral: "text-muted-foreground bg-muted",
  };
  return (
    <Card className="group relative p-4 md:p-5 rounded-2xl border bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("h-10 w-10 rounded-xl grid place-items-center", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        {delta && (
          <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", deltaMap[delta.tone])}>
            {delta.text}
          </span>
        )}
      </div>
      <p className="text-xs md:text-sm text-muted-foreground mb-1">{label}</p>
      <h3 className="text-xl md:text-2xl font-bold tabular-nums text-foreground">{value}</h3>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   OVERVIEW
   ──────────────────────────────────────────────────────────── */

function OverviewTab() {
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: expenses = [] } = useAllExpenses();
  const { data: members = [] } = useAllMembers();

  const statusData = useMemo(() => PROJECT_STATUS.map((s) => ({
    name: s.label, value: projects.filter((p) => p.status === s.value).length, color: s.color,
  })).filter((x) => x.value > 0), [projects]);

  // 30-day cash flow
  const cashData = useMemo(() => {
    const days: { key: string; label: string; amount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      days.push({ key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM", { locale: arSA }), amount: 0 });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    for (const e of expenses) {
      if (!e.expense_date) continue;
      const d = map.get(e.expense_date.slice(0, 10));
      if (d) d.amount += Number(e.amount || 0);
    }
    return days;
  }, [expenses]);

  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    for (const p of projects) {
      const cid = p.client_id;
      if (!cid) continue;
      const client = clients.find((c) => c.id === cid);
      if (!client) continue;
      const cur = map.get(cid) ?? { name: client.name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(p.budget || 0);
      map.set(cid, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [projects, clients]);

  const budget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
  const spent  = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const spentByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.project_id, (m.get(e.project_id) ?? 0) + Number(e.amount || 0));
    return m;
  }, [expenses]);

  const membersByProject = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const mem of members) {
      const arr = m.get(mem.project_id) ?? [];
      const name = mem.freelancer?.full_name ?? "عضو";
      arr.push(name);
      m.set(mem.project_id, arr);
    }
    return m;
  }, [members]);

  const activityItems = useMemo(() => {
    type Item = { id: string; when: string; who: string; what: string; project?: string; tone: "violet" | "emerald" | "amber" | "sky" | "rose" };
    const items: Item[] = [];
    for (const p of projects.slice(0, 6)) {
      items.push({
        id: `p-${p.id}`, when: p.created_at, who: "النظام",
        what: "أنشأ مشروعًا جديدًا", project: p.name, tone: "violet",
      });
    }
    for (const e of expenses.slice(0, 8)) {
      const proj = projects.find((pp) => pp.id === e.project_id);
      items.push({
        id: `e-${e.id}`, when: e.created_at ?? e.expense_date, who: e.freelancer?.full_name ?? "مصروف",
        what: `أضاف مصروف بقيمة ${fmtMoney(Number(e.amount || 0))}`,
        project: proj?.name, tone: "amber",
      });
    }
    return items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()).slice(0, 6);
  }, [projects, expenses]);

  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
    [projects]
  );

  return (
    <div className="space-y-4">
      {/* Chart + Activity — v2 direction */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 md:p-6 rounded-2xl border bg-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground"><ActivityIcon className="h-4 w-4 text-primary" /> أداء المشاريع · تدفق المصاريف</h3>
              <p className="text-xs text-muted-foreground mt-0.5">إجمالي المصاريف اليومية عبر كل المشاريع</p>
            </div>
            <Badge variant="outline" className="text-xs font-bold tabular-nums">{fmtMoney(spent)}</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cashG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => fmtMoney(v)} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cashG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 md:p-6 rounded-2xl border bg-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">آخر الأنشطة</h3>
            <Link to="/agency/projects" className="text-xs font-bold text-primary hover:underline">الكل</Link>
          </div>
          {activityItems.length === 0 ? (
            <EmptyLine text="لا يوجد نشاط بعد" />
          ) : (
            <div className="space-y-4">
              {activityItems.map((a) => (
                <ActivityRow key={a.id} item={a} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Status distribution + Top clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 md:p-6 rounded-2xl border bg-card">
          <h3 className="text-base font-bold flex items-center gap-2 mb-4 text-foreground"><Briefcase className="h-4 w-4 text-primary" /> توزيع حالات المشاريع</h3>
          {statusData.length === 0 ? (
            <EmptyLine text="لا توجد مشاريع بعد" />
          ) : (
            <div className="grid grid-cols-[160px_1fr] gap-4 items-center">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={2}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> <span className="font-medium">{d.name}</span></div>
                    <span className="tabular-nums font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 md:p-6 rounded-2xl border bg-card">
          <h3 className="text-base font-bold flex items-center gap-2 mb-4 text-foreground"><Star className="h-4 w-4 text-amber-500" /> أفضل العملاء</h3>
          {topClients.length === 0 ? <EmptyLine text="لا يوجد عملاء" /> : (
            <ol className="space-y-2">
              {topClients.map((c, i) => (
                <li key={c.name} className="flex items-center gap-3 p-2.5 rounded-xl border bg-background/40 hover:bg-muted/40 transition-colors">
                  <div className={cn(
                    "h-9 w-9 rounded-xl grid place-items-center text-xs font-bold shrink-0",
                    i === 0 ? "bg-amber-500/15 text-amber-600" : i === 1 ? "bg-slate-400/15 text-slate-500" : i === 2 ? "bg-orange-500/15 text-orange-600" : "bg-muted text-muted-foreground"
                  )}>#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.count} مشروع</div>
                  </div>
                  <div className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(c.total)}</div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Recent projects — Modern Data Table (v2 direction) */}
      <Card className="rounded-2xl border bg-card overflow-hidden">
        <div className="p-5 md:p-6 border-b flex items-center justify-between bg-muted/20 gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-foreground">المشاريع الحالية</h3>
            <p className="text-xs text-muted-foreground mt-0.5">آخر {recentProjects.length} مشاريع مضافة</p>
          </div>
          <Link to="/agency/projects" className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1">
            عرض الكل <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <div className="p-8"><EmptyLine text="لا توجد مشاريع بعد" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="text-muted-foreground text-[10px] uppercase tracking-wider bg-muted/20">
                  <th className="px-5 py-3 font-bold">المشروع</th>
                  <th className="px-5 py-3 font-bold">الحالة</th>
                  <th className="px-5 py-3 font-bold">الفريق</th>
                  <th className="px-5 py-3 font-bold">التقدم</th>
                  <th className="px-5 py-3 font-bold">الميزانية</th>
                  <th className="px-5 py-3 font-bold">التسليم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentProjects.map((p) => {
                  const st = PROJECT_STATUS.find((s) => s.value === p.status);
                  const tp = PROJECT_TYPES.find((t) => t.value === p.type);
                  const projSpent = spentByProject.get(p.id) ?? 0;
                  const projBudget = Number(p.budget || 0);
                  const pct = projBudget > 0 ? Math.min(100, (projSpent / projBudget) * 100) : (st?.progress ?? 0);
                  const team = membersByProject.get(p.id) ?? [];
                  const overdueRow = p.due_date && !["delivered", "cancelled"].includes(p.status)
                    ? differenceInCalendarDays(new Date(p.due_date), new Date()) < 0 : false;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link to="/agency/projects/$id" params={{ id: p.id }} className="flex items-center gap-3 min-w-0">
                          <div className={cn("h-9 w-9 rounded-xl grid place-items-center text-white text-xs font-bold shrink-0 bg-gradient-to-br", tp?.tint)}>
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {(p as { client?: { name?: string } }).client?.name ?? "بدون عميل"} · {tp?.label}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md border", st?.chip)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", st?.dot)} /> {st?.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {team.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center -space-x-2 space-x-reverse">
                            {team.slice(0, 3).map((n, i) => (
                              <Avatar key={i} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-[9px] bg-gradient-to-br from-violet-500 to-indigo-500 text-white">{initials(n)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {team.length > 3 && (
                              <div className="h-6 w-6 rounded-full border-2 border-background bg-muted grid place-items-center text-[9px] font-bold text-muted-foreground">
                                +{team.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="w-28">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all",
                              pct >= 100 ? "bg-emerald-500" : pct >= 80 ? "bg-amber-500" : "bg-primary"
                            )} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{Math.round(pct)}%</div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-bold tabular-nums">{fmtMoney(projBudget)}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">مصروف {fmtMoney(projSpent)}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className={cn("inline-flex items-center gap-1 text-xs font-medium", overdueRow ? "text-rose-600" : "text-muted-foreground")}>
                          {overdueRow ? <AlertTriangle className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
                          {p.due_date ? format(new Date(p.due_date), "d MMM yyyy", { locale: arSA }) : "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ActivityRow({ item }: {
  item: { who: string; what: string; project?: string; when: string; tone: "violet" | "emerald" | "amber" | "sky" | "rose" };
}) {
  const toneMap: Record<string, string> = {
    violet:  "from-violet-400 to-indigo-400",
    emerald: "from-emerald-400 to-teal-400",
    amber:   "from-amber-400 to-orange-400",
    sky:     "from-sky-400 to-blue-400",
    rose:    "from-rose-400 to-pink-400",
  };
  return (
    <div className="flex gap-3 animate-fade-in">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className={cn("text-[10px] text-white bg-gradient-to-br", toneMap[item.tone])}>
          {initials(item.who)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-bold text-foreground">{item.who}</span>
          <span className="text-muted-foreground"> {item.what}</span>
          {item.project && <span className="font-medium text-primary"> · {item.project}</span>}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {(() => {
            try { return format(new Date(item.when), "d MMM · HH:mm", { locale: arSA }); }
            catch { return "—"; }
          })()}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PROJECTS
   ──────────────────────────────────────────────────────────── */

function ProjectsTab() {
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: expenses = [] } = useAllExpenses();
  const { data: members = [] } = useAllMembers();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "budget" | "deadline">("recent");
  const [view, setView] = useState<"grid" | "list">("grid");

  const spentByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.project_id, (m.get(e.project_id) ?? 0) + Number(e.amount || 0));
    return m;
  }, [expenses]);

  const membersByProject = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const mm of members) {
      const name = mm.kind === "staff"
        ? ((mm as { profile?: { display_name?: string; email?: string } }).profile?.display_name
          ?? (mm as { profile?: { email?: string } }).profile?.email ?? "؟")
        : ((mm as { freelancer?: { full_name?: string } }).freelancer?.full_name ?? "؟");
      const arr = m.get(mm.project_id) ?? [];
      arr.push(name);
      m.set(mm.project_id, arr);
    }
    return m;
  }, [members]);

  const filtered = useMemo(() => {
    let out = projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter   !== "all" && p.type   !== typeFilter) return false;
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    switch (sort) {
      case "name":     out = [...out].sort((a, b) => a.name.localeCompare(b.name, "ar")); break;
      case "budget":   out = [...out].sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0)); break;
      case "deadline": out = [...out].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")); break;
      default: break;
    }
    return out;
  }, [projects, statusFilter, typeFilter, clientFilter, search, sort]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3 rounded-2xl border-border/60">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 items-center">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث عن مشروع…" className="h-10 rounded-lg pr-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 rounded-lg min-w-[130px]"><Filter className="h-3.5 w-3.5 ml-1" /><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {PROJECT_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10 rounded-lg min-w-[120px]"><SelectValue placeholder="النوع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {PROJECT_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-10 rounded-lg min-w-[140px]"><SelectValue placeholder="العميل" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العملاء</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="h-10 rounded-lg min-w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">الأحدث</SelectItem>
              <SelectItem value="name">الاسم</SelectItem>
              <SelectItem value="budget">الميزانية</SelectItem>
              <SelectItem value="deadline">الموعد النهائي</SelectItem>
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-lg border p-0.5">
            <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} className="h-9 w-9 p-0 rounded-md" onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} className="h-9 w-9 p-0 rounded-md" onClick={() => setView("list")}><ListIcon className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filtered.length}</span> من {projects.length} مشروع
        </div>
        <NewProjectDialog />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title="لا توجد مشاريع مطابقة" hint="جرّب تعديل الفلاتر أو ابدأ مشروعاً جديداً." />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} spent={spentByProject.get(p.id) ?? 0} teamNames={membersByProject.get(p.id) ?? []} />
          ))}
        </div>
      ) : (
        <ProjectListView projects={filtered} spentMap={spentByProject} membersMap={membersByProject} />
      )}
    </div>
  );
}

type ProjectRow = Awaited<ReturnType<typeof supabase.from>> extends never ? never : any;

function ProjectCard({ project: p, spent, teamNames }: { project: any; spent: number; teamNames: string[] }) {
  const st = PROJECT_STATUS.find((s) => s.value === p.status);
  const tp = PROJECT_TYPES.find((t) => t.value === p.type);
  const budget = Number(p.budget || 0);
  const remaining = budget - spent;
  const spendPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const daysLeft = p.due_date ? differenceInCalendarDays(new Date(p.due_date), new Date()) : null;
  const health = (() => {
    if (p.status === "cancelled") return { label: "ملغي", tone: "text-rose-600 dark:text-rose-400", icon: AlertTriangle };
    if (p.status === "delivered") return { label: "مكتمل", tone: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 };
    if (remaining < 0) return { label: "تجاوز ميزانية", tone: "text-rose-600 dark:text-rose-400", icon: AlertTriangle };
    if (daysLeft !== null && daysLeft < 0) return { label: "متأخر", tone: "text-rose-600 dark:text-rose-400", icon: AlertTriangle };
    if (daysLeft !== null && daysLeft <= 7) return { label: "قريب", tone: "text-amber-600 dark:text-amber-400", icon: AlertTriangle };
    return { label: "على المسار", tone: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 };
  })();
  const HealthIcon = health.icon;

  return (
    <Link to="/agency/projects/$id" params={{ id: p.id }}>
      <Card className="group relative overflow-hidden p-4 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border-border/60">
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90", tp?.tint)} />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-start gap-3">
            <div className={cn("h-11 w-11 rounded-xl grid place-items-center text-white bg-gradient-to-br shrink-0 shadow-md", tp?.tint)}>
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {(p as { client?: { name?: string } }).client?.name ?? "بدون عميل"} · {tp?.label}
              </div>
            </div>
          </div>
          <div className={cn("text-[10px] px-2 py-0.5 rounded-md border inline-flex items-center gap-1 shrink-0", st?.chip)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", st?.dot)} /> {st?.label}
          </div>
        </div>

        {/* Budget bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>استهلاك الميزانية</span>
            <span className="tabular-nums">{Math.round(spendPct)}%</span>
          </div>
          <Progress value={spendPct} className={cn("h-1.5", spendPct > 100 && "[&>div]:bg-rose-500")} />
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="tabular-nums font-semibold">{fmtMoney(spent)}</span>
            <span className="text-muted-foreground tabular-nums">من {fmtMoney(budget)}</span>
          </div>
        </div>

        {/* Footer meta */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {teamNames.slice(0, 4).map((n, i) => (
              <Avatar key={i} className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-[9px] bg-muted">{initials(n)}</AvatarFallback>
              </Avatar>
            ))}
            {teamNames.length > 4 && (
              <div className="h-6 w-6 rounded-full border-2 border-background bg-muted grid place-items-center text-[9px] font-semibold">
                +{teamNames.length - 4}
              </div>
            )}
            {teamNames.length === 0 && <span className="text-[11px] text-muted-foreground">لا فريق</span>}
          </div>
          <div className={cn("flex items-center gap-1 text-[11px]", health.tone)}>
            <HealthIcon className="h-3.5 w-3.5" />
            <span className="font-medium">{health.label}</span>
            {daysLeft !== null && daysLeft >= 0 && p.status !== "delivered" && (
              <span className="text-muted-foreground">· {daysLeft}ي</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ProjectListView({ projects, spentMap, membersMap }: {
  projects: any[]; spentMap: Map<string, number>; membersMap: Map<string, string[]>;
}) {
  return (
    <Card className="rounded-2xl overflow-hidden border-border/60">
      <div className="hidden md:grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 text-[11px] font-medium text-muted-foreground border-b bg-muted/30">
        <div>المشروع</div><div>الحالة</div><div>الميزانية</div><div>الاستهلاك</div><div>الفريق</div><div>الموعد</div>
      </div>
      <ul className="divide-y">
        {projects.map((p) => {
          const st = PROJECT_STATUS.find((s) => s.value === p.status);
          const tp = PROJECT_TYPES.find((t) => t.value === p.type);
          const budget = Number(p.budget || 0);
          const spent = spentMap.get(p.id) ?? 0;
          const spendPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
          const teamNames = membersMap.get(p.id) ?? [];
          return (
            <li key={p.id}>
              <Link to="/agency/projects/$id" params={{ id: p.id }}
                className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/40 transition-colors">
                <div className="min-w-0 flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-lg grid place-items-center text-white bg-gradient-to-br shrink-0", tp?.tint)}>
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{(p as { client?: { name?: string } }).client?.name ?? "بدون عميل"} · {tp?.label}</div>
                  </div>
                </div>
                <div><span className={cn("text-[10px] px-2 py-0.5 rounded-md border inline-flex items-center gap-1", st?.chip)}><span className={cn("h-1.5 w-1.5 rounded-full", st?.dot)} /> {st?.label}</span></div>
                <div className="tabular-nums text-sm font-semibold">{fmtMoney(budget)}</div>
                <div className="min-w-0">
                  <Progress value={spendPct} className={cn("h-1.5", spendPct > 100 && "[&>div]:bg-rose-500")} />
                  <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{fmtMoney(spent)} ({Math.round(spendPct)}%)</div>
                </div>
                <div className="flex -space-x-2 rtl:space-x-reverse">
                  {teamNames.slice(0, 3).map((n, i) => (
                    <Avatar key={i} className="h-6 w-6 border-2 border-background"><AvatarFallback className="text-[9px] bg-muted">{initials(n)}</AvatarFallback></Avatar>
                  ))}
                  {teamNames.length > 3 && <div className="h-6 w-6 rounded-full border-2 border-background bg-muted grid place-items-center text-[9px]">+{teamNames.length - 3}</div>}
                  {teamNames.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  <CalendarIcon className="h-3 w-3 inline ml-0.5" /> {p.due_date ?? "—"}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   CLIENTS
   ──────────────────────────────────────────────────────────── */

function ClientsTab() {
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const [q, setQ] = useState("");
  const filtered = clients.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <Card className="p-3 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث عن عميل…" className="h-10 rounded-lg pr-9" />
          </div>
          <NewClientDialog />
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => {
          const cprojects = projects.filter((p) => p.client_id === c.id);
          const total = cprojects.reduce((s, p) => s + Number(p.budget || 0), 0);
          return (
            <Card key={c.id} className="p-4 rounded-2xl hover:shadow-md transition-shadow border-border/60">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 grid place-items-center text-indigo-600 dark:text-indigo-300 font-bold shrink-0">
                  {initials(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold truncate">{c.name}</div>
                    {!c.is_active && <Badge variant="outline" className="text-[10px]">غير نشط</Badge>}
                  </div>
                  {c.contact_name && <div className="text-xs text-muted-foreground truncate">{c.contact_name}</div>}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {c.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-1.5"><Mail  className="h-3 w-3" />{c.email}</div>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/40">
                  <div className="text-muted-foreground">المشاريع</div>
                  <div className="font-bold text-lg tabular-nums mt-0.5">{cprojects.length}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/0">
                  <div className="text-muted-foreground">إجمالي القيمة</div>
                  <div className="font-bold text-sm tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-400">{fmtMoney(total)}</div>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full"><EmptyState icon={UserCircle2} title="لا يوجد عملاء" hint="ابدأ بإضافة أول عميل." /></div>}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   FREELANCERS
   ──────────────────────────────────────────────────────────── */

function FreelancersTab() {
  const { data: freelancers = [] } = useFreelancers();
  const [specialty, setSpecialty] = useState<string>("all");
  const [q, setQ] = useState("");
  const filtered = freelancers.filter((f) => (specialty === "all" || f.specialty === specialty) && (!q || f.full_name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="space-y-4">
      <Card className="p-3 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم…" className="h-10 rounded-lg pr-9" />
          </div>
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger className="h-10 w-44 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التخصصات</SelectItem>
              {SPECIALTIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <NewFreelancerDialog />
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((f) => (
          <Card key={f.id} className="p-4 rounded-2xl hover:shadow-md transition-shadow border-border/60">
            <div className="flex items-start gap-3">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 text-violet-700 dark:text-violet-300 font-bold">{initials(f.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{f.full_name}</div>
                  {f.rating && (<div className="flex items-center gap-0.5 text-amber-500 text-xs shrink-0"><Star className="h-3 w-3 fill-current" /> {f.rating}</div>)}
                </div>
                <Badge variant="outline" className="text-[10px] mt-1">{labelOf(SPECIALTIES, f.specialty)}</Badge>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {f.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{f.phone}</div>}
              {f.email && <div className="flex items-center gap-1.5"><Mail  className="h-3 w-3" />{f.email}</div>}
            </div>
            <div className="mt-3 p-2.5 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/0 text-xs">
              <div className="text-muted-foreground">التسعير</div>
              <div className="font-bold tabular-nums mt-0.5 text-amber-700 dark:text-amber-400">
                {f.rate_amount ? `${Number(f.rate_amount).toLocaleString()} ج` : "—"}
                <span className="text-[10px] font-normal text-muted-foreground mr-1">/ {labelOf(RATE_KINDS, f.rate_kind)}</span>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-full"><EmptyState icon={Users} title="لا يوجد فريلانسرز" hint="ابدأ بإضافة أول فريلانسر." /></div>}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   EXPENSES
   ──────────────────────────────────────────────────────────── */

function ExpensesTab() {
  const { data: expenses = [] } = useAllExpenses();
  const { data: projects = [] } = useProjects();
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const filtered = expenses.filter((e) => {
    if (projectFilter !== "all" && e.project_id !== projectFilter) return false;
    if (kindFilter    !== "all" && e.kind !== kindFilter) return false;
    if (q && !e.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);

  function exportExcel() {
    const rows = filtered.map((e) => ({
      "التاريخ": e.expense_date,
      "المشروع": (e as { project?: { name?: string } }).project?.name ?? "",
      "البند": e.title,
      "النوع": labelOf(EXPENSE_KINDS, e.kind),
      "المبلغ": Number(e.amount),
      "الفريلانسر": (e as { freelancer?: { full_name?: string } }).freelancer?.full_name ?? "",
      "ملاحظات": e.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المصاريف");
    XLSX.writeFile(wb, "مصاريف-الوكالة.xlsx");
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="h-10 rounded-lg pr-9" />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="المشروع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المشاريع</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="النوع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {EXPENSE_KINDS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-sm whitespace-nowrap">إجمالي: <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">{fmtMoney(total)}</span></div>
          <Button onClick={exportExcel} variant="outline" className="h-10 rounded-lg gap-1"><Download className="h-4 w-4" /> Excel</Button>
        </div>
      </Card>

      <Card className="rounded-2xl overflow-hidden border-border/60">
        {filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="لا توجد مصاريف" hint="جرّب تعديل الفلاتر." />
        ) : (
          <ul className="divide-y">
            {filtered.map((e) => {
              const kind = EXPENSE_KINDS.find((k) => k.value === e.kind);
              return (
                <li key={e.id} className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-lg grid place-items-center shrink-0" style={{ background: `${kind?.color}20`, color: kind?.color }}>
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {e.expense_date} · {(e as { project?: { name?: string } }).project?.name ?? "—"} · {kind?.label}
                    </div>
                  </div>
                  <div className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400 shrink-0">−{Number(e.amount).toLocaleString()} ج</div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Dialogs (create)
   ──────────────────────────────────────────────────────────── */

function NewProjectDialog({ trigger }: { trigger?: React.ReactNode } = {}) {
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const emptyForm = {
    name: "", client_id: "", type: "marketing", status: "planned",
    priority: "medium", budget: "", currency: "EGP",
    start_date: "", due_date: "",
    description: "", goal: "", tags: "",
    // Engagement
    engagement_model: "one_time" as "one_time" | "retainer",
    billing_cycle: "monthly" as "monthly" | "quarterly" | "yearly",
    monthly_retainer: "",
    contract_start_date: "",
    contract_end_date: "",
    auto_renew: true,
    next_invoice_date: "",
  };
  const [form, setForm] = useState(emptyForm);

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const durationDays = useMemo(() => {
    if (!form.start_date || !form.due_date) return null;
    const d = differenceInCalendarDays(new Date(form.due_date), new Date(form.start_date));
    return Number.isFinite(d) ? d : null;
  }, [form.start_date, form.due_date]);

  const budgetNum = parseFloat(form.budget) || 0;
  const dailyBurn = durationDays && durationDays > 0 ? budgetNum / durationDays : 0;
  const isRetainer = form.engagement_model === "retainer";
  const retainerNum = parseFloat(form.monthly_retainer) || 0;
  const cycle = BILLING_CYCLES.find((c) => c.value === form.billing_cycle)!;
  const annualRetainer = retainerNum * 12;

  const nameValid = form.name.trim().length >= 3;
  const datesValid = !form.start_date || !form.due_date || new Date(form.due_date) >= new Date(form.start_date);
  const contractDatesValid = !form.contract_start_date || !form.contract_end_date || new Date(form.contract_end_date) >= new Date(form.contract_start_date);
  const retainerStep1Valid = !!form.contract_start_date && retainerNum > 0 && contractDatesValid;
  const canNext =
    step === 0 ? nameValid :
    step === 1 ? (isRetainer ? retainerStep1Valid : datesValid) :
    true;

  const reset = () => { setForm(emptyForm); setStep(0); };

  const create = useMutation({
    mutationFn: async () => {
      if (!nameValid) throw new Error("اسم المشروع لازم يكون 3 أحرف على الأقل");
      if (!isRetainer && !datesValid) throw new Error("الموعد النهائي لا يمكن أن يسبق تاريخ البدء");
      if (isRetainer && !form.contract_start_date) throw new Error("حدّد تاريخ بداية العقد");
      const meta = [
        form.goal && `🎯 الهدف: ${form.goal}`,
        form.priority && `⚑ الأولوية: ${labelOf(PRIORITIES, form.priority)}`,
        form.tags && `🏷 الوسوم: ${form.tags}`,
      ].filter(Boolean).join("\n");
      const desc = [form.description, meta].filter(Boolean).join("\n\n") || null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        name: form.name.trim(),
        client_id: form.client_id || null,
        type: form.type, status: form.status,
        engagement_model: form.engagement_model,
        budget: isRetainer ? 0 : budgetNum,
        start_date: (isRetainer ? form.contract_start_date : form.start_date) || null,
        due_date: isRetainer ? (form.contract_end_date || null) : (form.due_date || null),
        billing_cycle: isRetainer ? form.billing_cycle : null,
        monthly_retainer: isRetainer ? retainerNum : 0,
        contract_start_date: isRetainer ? (form.contract_start_date || null) : null,
        contract_end_date: isRetainer ? (form.contract_end_date || null) : null,
        auto_renew: isRetainer ? form.auto_renew : false,
        next_invoice_date: isRetainer
          ? (form.next_invoice_date || form.contract_start_date || null)
          : null,
        description: desc,
      };
      const { error } = await supabase.from("agency_projects").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إنشاء المشروع بنجاح 🎉");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["agency_projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedType = PROJECT_TYPES.find((t) => t.value === form.type)!;
  const selectedStatus = PROJECT_STATUS.find((s) => s.value === form.status)!;
  const selectedClient = clients.find((c) => c.id === form.client_id);
  const selectedPriority = PRIORITIES.find((p) => p.value === form.priority)!;

  const steps = [
    { title: "الأساسيات", desc: "اسم المشروع، العميل، والنوع", icon: Info },
    { title: "الجدولة والميزانية", desc: "التواريخ والتكلفة والأولوية", icon: CalendarIcon },
    { title: "التفاصيل والمراجعة", desc: "الوصف والأهداف ثم المراجعة", icon: CheckCheck },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button className="rounded-lg gap-1"><PlusCircle className="h-4 w-4" /> مشروع جديد</Button>}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-3xl p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="relative bg-gradient-to-l from-violet-600 via-fuchsia-600 to-indigo-600 text-white px-6 pt-6 pb-8">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_10%,white,transparent_40%),radial-gradient(circle_at_80%_90%,white,transparent_35%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogHeader className="p-0 space-y-0.5">
                  <DialogTitle className="text-xl font-bold text-white">إنشاء مشروع جديد</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-white/80 mt-1">ابنِ مشروعًا احترافيًا بكل التفاصيل — يمكنك تعديل كل شيء لاحقًا.</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white/10 text-white border-white/30 backdrop-blur">
              خطوة {step + 1} من {steps.length}
            </Badge>
          </div>

          {/* Stepper */}
          <div className="relative mt-6 grid grid-cols-3 gap-2">
            {steps.map((s, i) => {
              const Ic = s.icon;
              const active = i === step;
              const done = i < step;
              return (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  className={cn(
                    "text-right rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-all border",
                    active ? "bg-white text-slate-900 border-white shadow-lg" :
                    done ? "bg-white/15 text-white border-white/30" :
                    "bg-white/5 text-white/70 border-white/10"
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                    active ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white" :
                    done ? "bg-white/20" : "bg-white/10"
                  )}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Ic className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{s.title}</div>
                    <div className={cn("text-[10.5px] truncate", active ? "text-slate-500" : "text-white/60")}>{s.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[62vh] overflow-y-auto bg-gradient-to-b from-background to-muted/20">
          {step === 0 && (
            <div className="space-y-5 animate-in fade-in-50 slide-in-from-right-2 duration-300">
              {/* Engagement model — the most important decision */}
              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5 text-emerald-500" /> نموذج العمل <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {ENGAGEMENT_MODELS.map((m) => {
                    const active = form.engagement_model === m.value;
                    const Ic = m.icon;
                    return (
                      <button
                        key={m.value} type="button"
                        onClick={() => setField("engagement_model", m.value)}
                        className={cn(
                          "text-right rounded-xl border p-3.5 transition-all relative overflow-hidden",
                          active
                            ? "border-transparent ring-2 shadow-md " +
                              (m.value === "retainer" ? "ring-emerald-500/40 bg-emerald-500/5" : "ring-violet-500/40 bg-violet-500/5")
                            : "border-border hover:border-foreground/20 hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center text-white bg-gradient-to-br shrink-0", m.tint)}>
                            <Ic className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-bold">{m.label}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</div>
                            <div className="text-[10.5px] text-muted-foreground/80 mt-1">أمثلة: {m.examples}</div>
                          </div>
                          {active && <CheckCircle2 className={cn("h-4 w-4 shrink-0", m.value === "retainer" ? "text-emerald-500" : "text-violet-500")} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-violet-500" /> اسم المشروع <span className="text-rose-500">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={isRetainer ? "مثال: إدارة سوشيال ميديا شهرية — شركة X" : "مثال: حملة إطلاق تطبيق شركة X"}
                  className="mt-1.5 h-11 rounded-lg text-[15px]"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[11px] text-muted-foreground">اختر اسماً واضحاً ومختصراً (3+ أحرف)</p>
                  <span className={cn("text-[11px] font-medium", form.name.length > 60 ? "text-rose-500" : "text-muted-foreground")}>{form.name.length}/80</span>
                </div>
              </div>

              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-sky-500" /> العميل</Label>
                <Select value={form.client_id} onValueChange={(v) => setField("client_id", v)}>
                  <SelectTrigger className="mt-1.5 h-11 rounded-lg"><SelectValue placeholder="اختر عميلًا من القائمة…" /></SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">لا يوجد عملاء بعد</div>}
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-violet-500/10 text-violet-600">{initials(c.name)}</AvatarFallback></Avatar>
                          <span>{c.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-fuchsia-500" /> نوع المشروع</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {PROJECT_TYPES.map((t) => {
                    const Ic = t.value === "marketing" ? Palette : t.value === "programming" ? Code2 : Layers;
                    const active = form.type === t.value;
                    return (
                      <button
                        key={t.value} type="button" onClick={() => setField("type", t.value)}
                        className={cn(
                          "rounded-xl border p-3 text-right transition-all group",
                          active ? "border-violet-500 bg-violet-500/5 shadow-sm ring-2 ring-violet-500/20"
                                 : "border-border hover:border-violet-500/40 hover:bg-muted/40"
                        )}
                      >
                        <div className={cn("h-9 w-9 rounded-lg mb-2 flex items-center justify-center bg-gradient-to-br text-white", t.tint)}>
                          <Ic className="h-4 w-4" />
                        </div>
                        <div className="text-sm font-semibold">{t.label}</div>
                        <div className="text-[10.5px] text-muted-foreground mt-0.5">
                          {t.value === "marketing" ? "حملات، محتوى، إعلانات" : t.value === "programming" ? "تطوير برمجي متكامل" : "خدمات مركّبة"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5"><CircleDot className="h-3.5 w-3.5 text-emerald-500" /> حالة البدء</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {PROJECT_STATUS.map((s) => {
                    const active = form.status === s.value;
                    const Ic = s.value === "planned" ? Clock : s.value === "in_progress" ? Rocket : s.value === "on_hold" ? PauseCircle : s.value === "delivered" ? CheckCircle2 : XCircle;
                    return (
                      <button key={s.value} type="button" onClick={() => setField("status", s.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-[12.5px] font-medium flex items-center gap-1.5 transition-all",
                          active ? cn("border-transparent shadow-sm", s.chip) : "bg-background hover:bg-muted/60"
                        )}
                      >
                        <Ic className="h-3.5 w-3.5" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-in fade-in-50 slide-in-from-right-2 duration-300">
              {/* Mode banner */}
              <div className={cn(
                "rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 text-[12px]",
                isRetainer ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                           : "bg-violet-500/5 border-violet-500/20 text-violet-700 dark:text-violet-400"
              )}>
                {isRetainer ? <Repeat className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                <span className="font-medium">
                  {isRetainer
                    ? "عقد مستمر — سيتم إنشاء فواتير دورية حسب دورة الفوترة المحددة."
                    : "مشروع لحظي — بميزانية إجمالية وتاريخ تسليم واحد."}
                </span>
              </div>

              {!isRetainer && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[13px] font-semibold flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5 text-sky-500" /> تاريخ البدء</Label>
                      <Input type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} className="mt-1.5 h-11 rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-rose-500" /> الموعد النهائي</Label>
                      <Input type="date" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)} min={form.start_date || undefined} className="mt-1.5 h-11 rounded-lg" />
                    </div>
                  </div>

                  {durationDays !== null && (
                    <div className={cn(
                      "rounded-xl border p-3 flex items-center justify-between text-[12.5px]",
                      datesValid ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
                    )}>
                      <div className="flex items-center gap-2">
                        <Clock className={cn("h-4 w-4", datesValid ? "text-emerald-600" : "text-rose-600")} />
                        <span className="font-medium">
                          {datesValid ? `مدة المشروع: ${Math.max(0, durationDays)} يوم (${Math.max(0, Math.ceil(durationDays / 7))} أسبوع)`
                                      : "الموعد النهائي يسبق تاريخ البدء"}
                        </span>
                      </div>
                      {datesValid && durationDays > 0 && (
                        <span className="text-muted-foreground">~ {Math.max(1, Math.round(durationDays / 30))} شهر</span>
                      )}
                    </div>
                  )}

                  <div>
                    <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-emerald-500" /> الميزانية الإجمالية</Label>
                    <div className="mt-1.5 flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="number" inputMode="numeric" min={0}
                          value={form.budget}
                          onChange={(e) => setField("budget", e.target.value)}
                          placeholder="0"
                          className="h-11 rounded-lg pr-14 text-[15px] font-semibold"
                        />
                        <span className="absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">{form.currency}</span>
                      </div>
                      <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
                        <SelectTrigger className="h-11 w-28 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EGP">جنيه EGP</SelectItem>
                          <SelectItem value="USD">دولار USD</SelectItem>
                          <SelectItem value="SAR">ريال SAR</SelectItem>
                          <SelectItem value="AED">درهم AED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[5000, 10000, 25000, 50000, 100000, 250000].map((v) => (
                        <button key={v} type="button" onClick={() => setField("budget", String(v))}
                          className="px-2.5 py-1 rounded-md text-[11px] bg-muted/60 hover:bg-violet-500/10 hover:text-violet-600 border border-transparent hover:border-violet-500/30 transition">
                          {v.toLocaleString("en-US")}
                        </button>
                      ))}
                    </div>
                    {budgetNum > 0 && dailyBurn > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        ≈ متوسط استهلاك يومي <span className="font-semibold text-foreground">{fmtMoney(dailyBurn)}</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              {isRetainer && (
                <>
                  <div>
                    <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-emerald-500" /> القيمة الشهرية للعقد <span className="text-rose-500">*</span></Label>
                    <div className="mt-1.5 flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="number" inputMode="numeric" min={0}
                          value={form.monthly_retainer}
                          onChange={(e) => setField("monthly_retainer", e.target.value)}
                          placeholder="0"
                          className="h-11 rounded-lg pr-14 text-[15px] font-semibold"
                        />
                        <span className="absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">{form.currency}/شهر</span>
                      </div>
                      <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
                        <SelectTrigger className="h-11 w-28 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EGP">جنيه EGP</SelectItem>
                          <SelectItem value="USD">دولار USD</SelectItem>
                          <SelectItem value="SAR">ريال SAR</SelectItem>
                          <SelectItem value="AED">درهم AED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[3000, 5000, 10000, 15000, 25000, 50000].map((v) => (
                        <button key={v} type="button" onClick={() => setField("monthly_retainer", String(v))}
                          className="px-2.5 py-1 rounded-md text-[11px] bg-muted/60 hover:bg-emerald-500/10 hover:text-emerald-600 border border-transparent hover:border-emerald-500/30 transition">
                          {v.toLocaleString("en-US")}
                        </button>
                      ))}
                    </div>
                    {retainerNum > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2 text-center">
                          <div className="text-[10px] text-muted-foreground">فاتورة كل دورة</div>
                          <div className="text-[12.5px] font-bold text-emerald-600">{fmtMoney(retainerNum * cycle.months)}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2 text-center">
                          <div className="text-[10px] text-muted-foreground">دخل شهري</div>
                          <div className="text-[12.5px] font-bold text-emerald-600">{fmtMoney(retainerNum)}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2 text-center">
                          <div className="text-[10px] text-muted-foreground">دخل سنوي متوقع</div>
                          <div className="text-[12.5px] font-bold text-emerald-600">{fmtMoney(annualRetainer)}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-[13px] font-semibold flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 text-teal-500" /> دورة الفوترة</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {BILLING_CYCLES.map((c) => {
                        const active = form.billing_cycle === c.value;
                        return (
                          <button key={c.value} type="button" onClick={() => setField("billing_cycle", c.value)}
                            className={cn(
                              "rounded-lg border p-2.5 text-center transition",
                              active ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-sm"
                                     : "hover:bg-muted/60"
                            )}
                          >
                            <div className="text-[13px] font-semibold">{c.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">كل {c.months} شهر</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[13px] font-semibold flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5 text-sky-500" /> بداية العقد <span className="text-rose-500">*</span></Label>
                      <Input type="date" value={form.contract_start_date} onChange={(e) => setField("contract_start_date", e.target.value)} className="mt-1.5 h-11 rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-[13px] font-semibold flex items-center gap-1.5">
                        <InfinityIcon className="h-3.5 w-3.5 text-fuchsia-500" /> نهاية العقد
                        <span className="text-[10px] text-muted-foreground font-normal">(اختياري — اتركه فارغًا للاستمرار)</span>
                      </Label>
                      <Input type="date" value={form.contract_end_date} onChange={(e) => setField("contract_end_date", e.target.value)} min={form.contract_start_date || undefined} className="mt-1.5 h-11 rounded-lg" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[13px] font-semibold flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5 text-amber-500" /> تاريخ أول فاتورة</Label>
                    <Input
                      type="date"
                      value={form.next_invoice_date}
                      onChange={(e) => setField("next_invoice_date", e.target.value)}
                      min={form.contract_start_date || undefined}
                      placeholder={form.contract_start_date}
                      className="mt-1.5 h-11 rounded-lg"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">إذا تُرك فارغًا، سيبدأ من تاريخ بداية العقد.</p>
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:bg-muted/40 transition">
                    <input
                      type="checkbox"
                      checked={form.auto_renew}
                      onChange={(e) => setField("auto_renew", e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
                    />
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 text-emerald-500" /> تجديد تلقائي
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        عند انتهاء العقد، يتم تمديده تلقائيًا لدورة جديدة حتى إلغاؤه يدويًا.
                      </div>
                    </div>
                  </label>
                </>
              )}

              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Flag className="h-3.5 w-3.5 text-amber-500" /> الأولوية</Label>
                <div className="grid grid-cols-4 gap-2 mt-1.5">
                  {PRIORITIES.map((p) => {
                    const active = form.priority === p.value;
                    return (
                      <button key={p.value} type="button" onClick={() => setField("priority", p.value)}
                        className={cn(
                          "rounded-lg border p-2.5 text-center transition",
                          active ? cn("shadow-sm ring-2", p.ring, p.chip, "border-transparent") : "hover:bg-muted/60"
                        )}
                      >
                        <div className={cn("h-1.5 w-full rounded-full mb-1.5", p.bar)} />
                        <div className="text-[12px] font-semibold">{p.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in fade-in-50 slide-in-from-right-2 duration-300">
              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-violet-500" /> الهدف الرئيسي</Label>
                <Input
                  value={form.goal}
                  onChange={(e) => setField("goal", e.target.value)}
                  placeholder="مثال: زيادة التحويلات بنسبة 30% خلال الربع القادم"
                  className="mt-1.5 h-11 rounded-lg"
                />
              </div>

              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-500" /> وصف المشروع</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={4}
                  placeholder="اشرح نطاق العمل، المخرجات المتوقعة، وأي متطلبات خاصة…"
                  className="mt-1.5 rounded-lg resize-none"
                />
                <div className="text-[11px] text-muted-foreground mt-1 text-left">{form.description.length}/500</div>
              </div>

              <div>
                <Label className="text-[13px] font-semibold flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-fuchsia-500" /> الوسوم</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setField("tags", e.target.value)}
                  placeholder="افصل بينها بفاصلة — مثال: عاجل, VIP, Q4"
                  className="mt-1.5 h-11 rounded-lg"
                />
                {form.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                      <Badge key={t} variant="outline" className="bg-violet-500/5 text-violet-600 border-violet-500/30">#{t}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview card */}
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <div className="text-[13px] font-semibold">معاينة المشروع</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0", selectedType.tint)}>
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{form.name || "اسم المشروع"}</div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      {selectedClient?.name ?? "بدون عميل"} • {selectedType.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className={selectedStatus.chip}>{selectedStatus.label}</Badge>
                      <Badge variant="outline" className={selectedPriority.chip}>{selectedPriority.label}</Badge>
                      <Badge variant="outline" className={cn(
                        isRetainer ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                   : "bg-violet-500/10 text-violet-600 border-violet-500/20"
                      )}>
                        {isRetainer ? <><Repeat className="h-3 w-3 ml-1 inline" /> {cycle.label}</> : <><Zap className="h-3 w-3 ml-1 inline" /> لحظي</>}
                      </Badge>
                      {!isRetainer && form.start_date && <Badge variant="outline" className="bg-muted/60">من {format(new Date(form.start_date), "d MMM", { locale: arSA })}</Badge>}
                      {!isRetainer && form.due_date && <Badge variant="outline" className="bg-muted/60">إلى {format(new Date(form.due_date), "d MMM", { locale: arSA })}</Badge>}
                      {isRetainer && form.contract_start_date && <Badge variant="outline" className="bg-muted/60">بداية {format(new Date(form.contract_start_date), "d MMM yyyy", { locale: arSA })}</Badge>}
                      {isRetainer && (form.contract_end_date
                        ? <Badge variant="outline" className="bg-muted/60">إلى {format(new Date(form.contract_end_date), "d MMM yyyy", { locale: arSA })}</Badge>
                        : <Badge variant="outline" className="bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20"><InfinityIcon className="h-3 w-3 ml-1 inline" /> مستمر</Badge>)}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-[10px] text-muted-foreground">{isRetainer ? "شهريًا" : "الميزانية"}</div>
                    <div className="font-bold text-emerald-600">{fmtMoney(isRetainer ? retainerNum : budgetNum)}</div>
                    {isRetainer && retainerNum > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">سنويًا ~ {fmtMoney(annualRetainer)}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-8 bg-gradient-to-r from-violet-500 to-fuchsia-500" :
                i < step ? "w-4 bg-violet-400" : "w-4 bg-muted-foreground/20"
              )} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="gap-1">
                <ChevronRight className="h-4 w-4" /> السابق
              </Button>
            )}
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>إلغاء</Button>
            {step < steps.length - 1 ? (
              <Button
                onClick={() => canNext && setStep((s) => s + 1)}
                disabled={!canNext}
                className="gap-1 bg-gradient-to-l from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
              >
                التالي <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || !nameValid}
                className="gap-1.5 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              >
                <CheckCheck className="h-4 w-4" /> {create.isPending ? "جارٍ الإنشاء…" : "إنشاء المشروع"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewClientDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact_name: "", email: "", phone: "", notes: "" });
  const create = useMutation({
    mutationFn: async () => {
      const v = validateForm(agencyClientSchema, {
        name: form.name,
        contact_person: form.contact_name,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
      });
      if (!v.ok) throw new Error(v.message);
      const { error } = await supabase.from("agency_clients").insert({
        name: form.name, contact_name: form.contact_name || null,
        email: form.email || null, phone: form.phone || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      setOpen(false); setForm({ name: "", contact_name: "", email: "", phone: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["agency_clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="rounded-lg gap-1"><PlusCircle className="h-4 w-4" /> عميل جديد</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>عميل جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم العميل *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>جهة الاتصال</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>التليفون</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>الإيميل</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>إضافة</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewFreelancerDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", specialty: "programming", scope: "agency", rate_kind: "per_project", rate_amount: "", phone: "", email: "", rating: "", notes: "" });
  const create = useMutation({
    mutationFn: async () => {
      const v = validateForm(freelancerSchema, {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        specialty: form.specialty,
        hourly_rate: form.rate_amount,
        notes: form.notes,
      });
      if (!v.ok) throw new Error(v.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        full_name: form.full_name, specialty: form.specialty, scope: form.scope, rate_kind: form.rate_kind,
        rate_amount: form.rate_amount ? parseFloat(form.rate_amount) : null,
        phone: form.phone || null, email: form.email || null,
        rating: form.rating ? parseInt(form.rating) : null, notes: form.notes || null,
      };
      const { error } = await supabase.from("freelancers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      setOpen(false);
      setForm({ full_name: "", specialty: "programming", scope: "agency", rate_kind: "per_project", rate_amount: "", phone: "", email: "", rating: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["freelancers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="rounded-lg gap-1"><PlusCircle className="h-4 w-4" /> فريلانسر جديد</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>فريلانسر جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>الاسم *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>التخصص</Label>
              <Select value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SPECIALTIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>النطاق</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">أجنسي فقط</SelectItem>
                  <SelectItem value="both">أجنسي + استوديو</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>طريقة التسعير</Label>
              <Select value={form.rate_kind} onValueChange={(v) => setForm({ ...form, rate_kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RATE_KINDS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>السعر (ج)</Label><Input type="number" value={form.rate_amount} onChange={(e) => setForm({ ...form, rate_amount: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>التليفون</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>الإيميل</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><Label>التقييم (1–5)</Label><Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></div>
          <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>إضافة</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────
   Shared UI atoms
   ──────────────────────────────────────────────────────────── */

const KPI_TONES: Record<string, string> = {
  indigo:  "from-indigo-500/10 to-indigo-500/0 text-indigo-600 dark:text-indigo-300",
  emerald: "from-emerald-500/10 to-emerald-500/0 text-emerald-600 dark:text-emerald-300",
  rose:    "from-rose-500/10 to-rose-500/0 text-rose-600 dark:text-rose-300",
  amber:   "from-amber-500/10 to-amber-500/0 text-amber-600 dark:text-amber-300",
  sky:     "from-sky-500/10 to-sky-500/0 text-sky-600 dark:text-sky-300",
};

function PremiumKpi({ icon: Icon, tone, label, value, hint }: {
  icon: typeof Wallet; tone: keyof typeof KPI_TONES; label: string; value: string; hint?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden p-4 rounded-2xl border-border/60 bg-gradient-to-br", KPI_TONES[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="h-8 w-8 rounded-lg grid place-items-center bg-background/60 backdrop-blur-sm">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Briefcase; title: string; hint?: string }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="font-medium">{title}</div>
      {hint && <div className="text-sm text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-lg">{text}</div>;
}