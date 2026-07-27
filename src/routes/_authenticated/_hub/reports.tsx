import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Wallet, ListTodo, CalendarCheck, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_hub/reports")({
  head: () => ({ meta: [{ title: "التقارير — 4Creative" }] }),
  component: ReportsPage,
});

type Range = "today" | "week" | "month" | "quarter" | "year";

function startOf(range: Range) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (range === "today") return d;
  if (range === "week") { d.setDate(d.getDate() - 7); return d; }
  if (range === "month") { d.setDate(d.getDate() - 30); return d; }
  if (range === "quarter") { d.setMonth(d.getMonth() - 3); return d; }
  d.setFullYear(d.getFullYear() - 1); return d;
}

function ReportsPage() {
  const [range, setRange] = useState<Range>("month");
  const start = useMemo(() => startOf(range), [range]);
  const startISO = start.toISOString();
  const startDate = start.toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", range],
    queryFn: async () => {
      const [movs, tasks, bookings, paid] = await Promise.all([
        supabase.from("cash_movements").select("amount, direction, business_date").gte("business_date", startDate),
        supabase.from("tasks").select("id, status, created_at").gte("created_at", startISO),
        supabase.from("bookings").select("id, status, starts_at").gte("starts_at", startISO),
        supabase.from("payments").select("amount, paid_at").gte("paid_at", startISO),
      ]);
      const cashIn = (movs.data ?? []).filter((m) => m.direction === "in").reduce((s, m) => s + Number(m.amount), 0);
      const cashOut = (movs.data ?? []).filter((m) => m.direction === "out").reduce((s, m) => s + Number(m.amount), 0);
      const tasksByStatus = new Map<string, number>();
      (tasks.data ?? []).forEach((t) => tasksByStatus.set(t.status, (tasksByStatus.get(t.status) ?? 0) + 1));
      const bookingsByStatus = new Map<string, number>();
      (bookings.data ?? []).forEach((b) => bookingsByStatus.set(b.status, (bookingsByStatus.get(b.status) ?? 0) + 1));
      const revenue = (paid.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      return {
        cashIn, cashOut, cashNet: cashIn - cashOut,
        tasksTotal: tasks.data?.length ?? 0,
        tasksByStatus: Array.from(tasksByStatus.entries()),
        bookingsTotal: bookings.data?.length ?? 0,
        bookingsByStatus: Array.from(bookingsByStatus.entries()),
        revenue,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">التقارير والتحليلات</h1>
          <p className="text-muted-foreground mt-1">نظرة شاملة على الأداء المالي والتشغيلي</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["today","week","month","quarter","year"] as Range[]).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
              {r === "today" ? "اليوم" : r === "week" ? "آخر 7 أيام" : r === "month" ? "آخر 30 يوم" : r === "quarter" ? "ربع سنة" : "سنة"}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="إيرادات مدفوعة" value={`${(data?.revenue ?? 0).toLocaleString()} ج`} icon={Wallet} tone="positive" />
            <Stat label="داخل الخزنة" value={`${(data?.cashIn ?? 0).toLocaleString()} ج`} icon={TrendingUp} tone="positive" />
            <Stat label="خارج الخزنة" value={`${(data?.cashOut ?? 0).toLocaleString()} ج`} icon={TrendingDown} tone="negative" />
            <Stat label="صافي الخزنة" value={`${(data?.cashNet ?? 0).toLocaleString()} ج`} icon={BarChart3} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2"><ListTodo className="h-5 w-5 text-primary" /> التاسكات</h3>
                <Badge variant="secondary">{data?.tasksTotal ?? 0}</Badge>
              </div>
              <BreakdownList items={data?.tasksByStatus ?? []} />
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary" /> الحجوزات</h3>
                <Badge variant="secondary">{data?.bookingsTotal ?? 0}</Badge>
              </div>
              <BreakdownList items={data?.bookingsByStatus ?? []} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: typeof Wallet; tone?: "positive" | "negative";
}) {
  const color = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-foreground";
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold tabular-nums mt-2 ${color}`}>{value}</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة", pending: "بانتظار البدء", in_progress: "قيد التنفيذ",
  half_done: "50%", review: "قيد المراجعة", submitted: "تم التسليم",
  approved: "معتمد", rejected: "مرفوض", archived: "مؤرشف",
  reserved: "محجوز", checked_in: "تم الحضور", in_session: "في الجلسة",
  completed: "مكتمل", cancelled: "ملغي", no_show: "لم يحضر",
};

function BreakdownList({ items }: { items: [string, number][] }) {
  if (items.length === 0) return <div className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات</div>;
  const total = items.reduce((s, [, c]) => s + c, 0);
  return (
    <div className="space-y-2">
      {items.sort((a, b) => b[1] - a[1]).map(([s, c]) => (
        <div key={s} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>{STATUS_LABELS[s] ?? s}</span>
            <span className="tabular-nums text-muted-foreground">{c}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(c / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}