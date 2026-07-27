import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfDay, endOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { Camera, Smartphone, Calendar, Users, Wallet, ConciergeBell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reception/")({
  head: () => ({ meta: [{ title: "تقويم اليوم — الاستقبال — 4Creative" }] }),
  component: ReceptionToday,
});

function ReceptionToday() {
  const today = new Date();
  const start = startOfDay(today).toISOString();
  const end = endOfDay(today).toISOString();

  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await supabase.from("rooms").select("*").order("code")).data ?? [],
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings-today", start],
    queryFn: async () => (await supabase.from("bookings")
      .select("*, contact:contacts(full_name), room:rooms(code, name_ar)")
      .gte("starts_at", start).lt("starts_at", end)
      .order("starts_at")).data ?? [],
  });

  const { data: contactsCount } = useQuery({
    queryKey: ["contacts-count"],
    queryFn: async () => (await supabase.from("contacts").select("*", { count: "exact", head: true })).count ?? 0,
  });

  const todayBookings = bookings ?? [];
  const upcoming = todayBookings.filter((b) => new Date(b.starts_at) > today);
  const ongoing = todayBookings.filter((b) => new Date(b.starts_at) <= today && new Date(b.ends_at) > today);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
            <ConciergeBell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">أهلاً بك في الاستقبال</h1>
            <p className="text-muted-foreground mt-1">{format(today, "EEEE، d MMMM yyyy", { locale: ar })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="حجوزات اليوم" value={todayBookings.length} icon={Calendar} />
        <StatCard label="جلسة جارية الآن" value={ongoing.length} icon={Camera} tone="success" />
        <StatCard label="قادمة اليوم" value={upcoming.length} icon={Smartphone} tone="primary" />
        <StatCard label="إجمالي العملاء" value={contactsCount ?? 0} icon={Users} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/reception/bookings"><Calendar className="h-4 w-4 ml-1" /> إنشاء حجز جديد</Link></Button>
        <Button asChild variant="outline"><Link to="/reception/crm"><Users className="h-4 w-4 ml-1" /> إضافة عميل</Link></Button>
        <Button asChild variant="outline"><Link to="/reception/cashier"><Wallet className="h-4 w-4 ml-1" /> تسجيل دفعة</Link></Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(rooms ?? []).map((room) => {
          const list = todayBookings.filter((b) => b.room_id === room.id);
          return (
            <Card key={room.id} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{room.name_ar}</h3>
                <Badge variant="secondary">{list.length}</Badge>
              </div>
              {list.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">لا حجوزات اليوم</div>
              ) : (
                <div className="space-y-2">
                  {list.map((b) => {
                    const contact = (b as { contact?: { full_name?: string } }).contact;
                    const isNow = new Date(b.starts_at) <= today && new Date(b.ends_at) > today;
                    return (
                      <div key={b.id} className={`p-3 rounded-lg border ${isNow ? "border-primary bg-primary/5" : "bg-muted/30"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{contact?.full_name ?? "—"}</div>
                          {isNow && <Badge>الآن</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums mt-1">
                          {format(new Date(b.starts_at), "HH:mm")} → {format(new Date(b.ends_at), "HH:mm")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: "success" | "primary" }) {
  const toneCls = tone === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
    : tone === "primary" ? "bg-primary/5 border-primary/20 text-primary" : "";
  return (
    <Card className={`p-5 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs opacity-80">{label}</p>
          <p className="text-3xl font-bold tabular-nums mt-1">{value}</p>
        </div>
        <Icon className="h-8 w-8 opacity-60" />
      </div>
    </Card>
  );
}