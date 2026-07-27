import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Clock, AlertTriangle, CheckCircle2, Timer, TrendingUp } from "lucide-react";
import { useAllowedAreas } from "@/lib/use-allowed-areas";
import { subDays, isAfter } from "date-fns";

export const Route = createFileRoute("/_authenticated/production/performance")({
  head: () => ({ meta: [{ title: "أداء الفريق — 4Creative" }] }),
  component: PerformancePage,
});

type Row = {
  id: string;
  type: string;
  status: string;
  priority: number;
  due_at: string | null;
  created_at: string;
  approved_at: string | null;
  submitted_at: string | null;
  started_at: string | null;
  assignee_id: string | null;
};

const TYPES = [
  { value: "all", label: "الكل" },
  { value: "editing", label: "مونتاج" },
  { value: "design", label: "ديزاين" },
  { value: "shooting", label: "تصوير" },
  { value: "programming", label: "برمجة" },
  { value: "marketing", label: "ماركيتنج" },
];

const RANGES = [
  { value: "7", label: "آخر 7 أيام" },
  { value: "30", label: "آخر 30 يوم" },
  { value: "90", label: "آخر 90 يوم" },
  { value: "365", label: "آخر سنة" },
];

function PerformancePage() {
  const allowed = useAllowedAreas();
  const [type, setType] = useState("all");
  const [range, setRange] = useState("30");

  const since = useMemo(() => subDays(new Date(), parseInt(range)).toISOString(), [range]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["performance-tasks", type, since],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id,type,status,priority,due_at,created_at,approved_at,submitted_at,started_at,assignee_id")
        .gte("created_at", since);
      if (type !== "all") q = q.eq("type", type as any);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Row[]) ?? [];
    },
    enabled: allowed.isAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["performance-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,username,email");
      if (error) throw error;
      return data ?? [];
    },
    enabled: allowed.isAdmin,
  });

  const stats = useMemo(() => {
    const now = new Date();
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) =>
      ["accepted", "started", "shooting_started", "progress_50", "in_review", "shooting_done", "uploaded", "submitted"].includes(t.status),
    ).length;
    const overdue = tasks.filter(
      (t) => t.due_at && t.status !== "completed" && isAfter(now, new Date(t.due_at)),
    ).length;
    const onTime = tasks.filter((t) => {
      const done = t.approved_at || t.submitted_at;
      return t.status === "completed" && t.due_at && done && !isAfter(new Date(done), new Date(t.due_at));
    }).length;
    const completedWithDue = tasks.filter((t) => t.status === "completed" && t.due_at).length;
    const onTimePct = completedWithDue > 0 ? Math.round((onTime / completedWithDue) * 100) : 0;

    const durations = tasks
      .filter((t) => t.status === "completed" && t.started_at && (t.approved_at || t.submitted_at))
      .map((t) => (new Date((t.approved_at || t.submitted_at)!).getTime() - new Date(t.started_at!).getTime()) / (1000 * 60 * 60));
    const avgHours = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    return { total, completed, inProgress, overdue, onTimePct, avgHours };
  }, [tasks]);

  const leaderboard = useMemo(() => {
    const byUser = new Map<string, { completed: number; overdue: number; total: number; onTime: number; withDue: number }>();
    const now = new Date();
    for (const t of tasks) {
      if (!t.assignee_id) continue;
      const r = byUser.get(t.assignee_id) ?? { completed: 0, overdue: 0, total: 0, onTime: 0, withDue: 0 };
      r.total++;
      if (t.status === "completed") {
        r.completed++;
        const done = t.approved_at || t.submitted_at;
        if (t.due_at) {
          r.withDue++;
          if (done && !isAfter(new Date(done), new Date(t.due_at))) r.onTime++;
        }
      } else if (t.due_at && isAfter(now, new Date(t.due_at))) {
        r.overdue++;
      }
      byUser.set(t.assignee_id, r);
    }
    const arr = Array.from(byUser.entries()).map(([id, v]) => {
      const p = profiles.find((x) => x.id === id);
      return {
        id,
        name: p?.display_name || p?.username || p?.email || "—",
        ...v,
        onTimePct: v.withDue > 0 ? Math.round((v.onTime / v.withDue) * 100) : 0,
      };
    });
    arr.sort((a, b) => b.completed - a.completed || b.onTimePct - a.onTimePct);
    return arr;
  }, [tasks, profiles]);

  if (!allowed.isAdmin) {
    return <div className="p-6 text-muted-foreground">هذه الصفحة للإدارة فقط.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">أداء الفريق</h1>
          <p className="text-sm text-muted-foreground">إحصائيات الإنتاج وترتيب الموظفين</p>
        </div>
        <div className="flex gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={TrendingUp} label="إجمالي" value={stats.total} tone="text-foreground" />
        <StatCard icon={CheckCircle2} label="مكتمل" value={stats.completed} tone="text-emerald-600" />
        <StatCard icon={Timer} label="قيد التنفيذ" value={stats.inProgress} tone="text-blue-600" />
        <StatCard icon={AlertTriangle} label="متأخر" value={stats.overdue} tone="text-red-600" />
        <StatCard icon={Clock} label="في الموعد %" value={`${stats.onTimePct}%`} tone="text-emerald-600" />
        <StatCard icon={Timer} label="متوسط الإنجاز" value={`${stats.avgHours}س`} tone="text-purple-600" />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">ترتيب الموظفين</h2>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات في الفترة المحددة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right border-b text-muted-foreground">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">الموظف</th>
                  <th className="py-2 px-3">المجموع</th>
                  <th className="py-2 px-3">مكتمل</th>
                  <th className="py-2 px-3">متأخر</th>
                  <th className="py-2 px-3">في الموعد %</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3">
                      {i === 0 ? <Trophy className="h-4 w-4 text-amber-500 inline" /> : i + 1}
                    </td>
                    <td className="py-2 px-3 font-medium">{r.name}</td>
                    <td className="py-2 px-3">{r.total}</td>
                    <td className="py-2 px-3"><Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">{r.completed}</Badge></td>
                    <td className="py-2 px-3">{r.overdue > 0 ? <Badge variant="destructive">{r.overdue}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="py-2 px-3">
                      <span className={r.onTimePct >= 80 ? "text-emerald-600 font-semibold" : r.onTimePct >= 50 ? "text-amber-600" : "text-red-600"}>
                        {r.onTimePct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">التاسكات المتأخرة الحالية</h2>
        <LateTasks tasks={tasks} profiles={profiles} />
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${tone}`}>{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${tone}`} />
      </div>
    </Card>
  );
}

function LateTasks({ tasks, profiles }: { tasks: Row[]; profiles: any[] }) {
  const now = new Date();
  const late = tasks
    .filter((t) => t.due_at && t.status !== "completed" && isAfter(now, new Date(t.due_at)))
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    .slice(0, 10);

  if (late.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">لا توجد تاسكات متأخرة 🎉</p>;

  return (
    <div className="space-y-2">
      {late.map((t) => {
        const p = profiles.find((x) => x.id === t.assignee_id);
        const hours = Math.round((now.getTime() - new Date(t.due_at!).getTime()) / (1000 * 60 * 60));
        return (
          <Link key={t.id} to="/production/task/$id" params={{ id: t.id }} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/30 transition">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">{t.type}</p>
                <p className="text-xs text-muted-foreground">{p?.display_name || p?.username || "—"}</p>
              </div>
            </div>
            <Badge variant="destructive">متأخر {hours}س</Badge>
          </Link>
        );
      })}
    </div>
  );
}