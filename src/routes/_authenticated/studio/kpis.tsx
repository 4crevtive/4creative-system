import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, CheckCircle2, Clock, ListTodo, Trophy } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  shooting: "تصوير", editing: "مونتاج", design: "ديزاين", programming: "برمجة", marketing: "ماركتنج",
};

export const Route = createFileRoute("/_authenticated/studio/kpis")({
  head: () => ({ meta: [{ title: "حساب الـ KPIs — 4Creative" }] }),
  component: KpisPage,
});

function KpisPage() {
  const [range, setRange] = useState<"week" | "month" | "quarter" | "year">("month");
  const since = (() => {
    const d = new Date();
    if (range === "week") d.setDate(d.getDate() - 7);
    else if (range === "month") d.setMonth(d.getMonth() - 1);
    else if (range === "quarter") d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d.toISOString();
  })();

  const { data: tasks } = useQuery({
    queryKey: ["kpi-tasks", range],
    queryFn: async () =>
      (await supabase.from("tasks").select("id,type,status,assignee_id,approved_at,created_at,due_at,submitted_at").gte("created_at", since)).data ?? [],
  });
  const { data: profiles } = useQuery({
    queryKey: ["kpi-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id,display_name,email")).data ?? [],
  });

  const list = tasks ?? [];
  const total = list.length;
  const completed = list.filter((t) => t.status === "approved").length;
  const inProgress = list.filter((t) => ["started", "progress_50", "in_review"].includes(t.status)).length;
  const overdue = list.filter((t) => t.due_at && new Date(t.due_at) < new Date() && t.status !== "approved").length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  // Per-employee leaderboard
  const byUser = new Map<string, { total: number; done: number; onTime: number }>();
  for (const t of list) {
    if (!t.assignee_id) continue;
    const s = byUser.get(t.assignee_id) ?? { total: 0, done: 0, onTime: 0 };
    s.total += 1;
    if (t.status === "approved") {
      s.done += 1;
      if (!t.due_at || (t.submitted_at && new Date(t.submitted_at) <= new Date(t.due_at))) s.onTime += 1;
    }
    byUser.set(t.assignee_id, s);
  }
  const leaderboard = [...byUser.entries()]
    .map(([uid, s]) => {
      const p = (profiles ?? []).find((x) => x.id === uid);
      const score = s.total ? Math.round(((s.done * 0.7 + s.onTime * 0.3) / s.total) * 100) : 0;
      return { uid, name: p?.display_name || p?.email || "—", ...s, score };
    })
    .sort((a, b) => b.score - a.score);

  // Per-type breakdown
  const byType = new Map<string, number>();
  for (const t of list) byType.set(t.type, (byType.get(t.type) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">حساب الـ KPIs</h1>
            <p className="text-muted-foreground mt-1">مؤشرات الأداء للفريق</p>
          </div>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">آخر أسبوع</SelectItem>
            <SelectItem value="month">آخر شهر</SelectItem>
            <SelectItem value="quarter">آخر 3 أشهر</SelectItem>
            <SelectItem value="year">آخر سنة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="إجمالي المهام" value={total} icon={ListTodo} tint="from-blue-500 to-cyan-500" />
        <KpiCard label="مكتملة" value={completed} icon={CheckCircle2} tint="from-emerald-500 to-teal-500" />
        <KpiCard label="قيد التنفيذ" value={inProgress} icon={Clock} tint="from-amber-500 to-orange-500" />
        <KpiCard label="نسبة الإنجاز" value={`${completionRate}%`} icon={Trophy} tint="from-violet-500 to-fuchsia-500" />
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">المهام حسب النوع</h3>
        <div className="space-y-3">
          {[...byType.entries()].map(([type, count]) => (
            <div key={type}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{TYPE_LABELS[type] ?? type}</span>
                <span className="text-muted-foreground tabular-nums">{count} / {total}</span>
              </div>
              <Progress value={total ? (count / total) * 100 : 0} />
            </div>
          ))}
          {byType.size === 0 && <div className="text-center text-sm text-muted-foreground py-6">لا توجد مهام في هذه الفترة</div>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">ترتيب الموظفين</h3>
          {overdue > 0 && <Badge variant="destructive">{overdue} مهمة متأخرة</Badge>}
        </div>
        {leaderboard.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">لا توجد بيانات</div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((row, i) => (
              <div key={row.uid} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="h-9 w-9 rounded-full grid place-items-center bg-muted text-sm font-bold">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{row.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {row.done}/{row.total} منجزة · {row.onTime} في الموعد
                  </div>
                  <Progress value={row.score} className="mt-2" />
                </div>
                <div className="text-2xl font-bold tabular-nums text-primary">{row.score}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tint }: { label: string; value: number | string; icon: typeof BarChart3; tint: string }) {
  return (
    <Card className="p-5">
      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${tint} grid place-items-center text-white shadow-md mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold tabular-nums mt-1">{value}</div>
    </Card>
  );
}