import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Megaphone, Users, ListTodo, Wallet, Clock, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/_hub/dashboard")({
  head: () => ({ meta: [{ title: "اللوحة الإدارية — 4Creative" }] }),
  component: HubDashboard,
});

function HubDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["hub-stats"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [contacts, tasks, movements, profiles] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id, status"),
        supabase.from("cash_movements").select("amount, direction").eq("business_date", today.toISOString().slice(0, 10)),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      const cashIn = (movements.data ?? []).filter((m) => m.direction === "in").reduce((s, m) => s + Number(m.amount), 0);
      const cashOut = (movements.data ?? []).filter((m) => m.direction === "out").reduce((s, m) => s + Number(m.amount), 0);
      const activeTasks = (tasks.data ?? []).filter((t) => !["approved", "archived", "rejected"].includes(t.status)).length;
      return {
        contacts: contacts.count ?? 0,
        activeTasks,
        cashNet: cashIn - cashOut,
        staff: profiles.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">اللوحة الإدارية الرئيسية</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE، d MMMM yyyy", { locale: ar })}</p>
        </div>
        <AttendanceCard />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="عملاء" value={stats?.contacts ?? 0} icon={Users} />
        <StatCard label="مهام نشطة" value={stats?.activeTasks ?? 0} icon={ListTodo} />
        <StatCard label="صافي الخزنة اليوم" value={`${(stats?.cashNet ?? 0).toLocaleString()} ج`} icon={Wallet} />
        <StatCard label="موظفين نشطين" value={stats?.staff ?? 0} icon={Users} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">اختر مساحة العمل</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CompanyCard
            to="/studio"
            title="الاستوديو والتصوير"
            description="الحجوزات، التساكات، المونتاج، الديزاين، حسابات الاستوديو"
            icon={Camera}
            tint="from-violet-500 to-fuchsia-500"
          />
          <CompanyCard
            to="/agency"
            title="الماركتنج والبرمجة"
            description="المونتاج، الديزاين، التصوير الإعلاني، البرمجة، تساكات الكاتجوري"
            icon={Megaphone}
            tint="from-blue-500 to-cyan-500"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Users }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums mt-2">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function CompanyCard({ to, title, description, icon: Icon, tint }: {
  to: "/studio" | "/agency"; title: string; description: string; icon: typeof Camera; tint: string;
}) {
  return (
    <Link to={to} className="group">
      <Card className="p-6 relative overflow-hidden h-full hover:shadow-[var(--shadow-elegant)] transition-all hover:-translate-y-0.5">
        <div className={`absolute -top-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-br ${tint} opacity-15 blur-2xl`} />
        <div className="relative flex items-start gap-4">
          <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${tint} grid place-items-center text-white shadow-lg shrink-0`}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
            <div className="mt-3 flex items-center text-sm text-primary font-medium group-hover:gap-2 transition-all">
              <span>الدخول إلى المساحة</span>
              <ArrowLeft className="h-4 w-4 mr-2" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function AttendanceCard() {
  const [openLog, setOpenLog] = useState<{ id: string; check_in: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("attendance_logs")
      .select("id, check_in, check_out")
      .eq("user_id", u.user.id).eq("work_date", today).is("check_out", null)
      .order("check_in", { ascending: false }).limit(1).maybeSingle();
    setOpenLog(data ?? null);
  }

  async function checkIn() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { error } = await supabase.from("attendance_logs").insert({ user_id: u.user.id });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تسجيل الحضور");
    refresh();
  }

  async function checkOut() {
    if (!openLog) return;
    setLoading(true);
    const { error } = await supabase.from("attendance_logs").update({ check_out: new Date().toISOString() }).eq("id", openLog.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تسجيل الانصراف");
    refresh();
  }

  return (
    <Card className="p-4 flex items-center gap-3" style={{ background: "var(--gradient-brand)", color: "white" }}>
      <Clock className="h-5 w-5" />
      <div>
        <div className="text-xs opacity-90">{openLog ? "أنت في العمل" : "لم تسجل حضورك بعد"}</div>
        {openLog && <div className="text-sm font-semibold tabular-nums">منذ {format(new Date(openLog.check_in), "HH:mm")}</div>}
      </div>
      <Button size="sm" variant="secondary" disabled={loading} className="mr-2"
        onClick={openLog ? checkOut : checkIn}>
        {openLog ? "انصراف" : "حضور"}
      </Button>
      <Badge variant="secondary" className="bg-white/20 text-white border-0">{format(new Date(), "HH:mm")}</Badge>
    </Card>
  );
}