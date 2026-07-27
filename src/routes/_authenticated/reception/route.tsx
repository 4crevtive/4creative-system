import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AreaGate } from "@/components/area-gate";
import { LayoutDashboard, Calendar, Users, Wallet, Package, ConciergeBell } from "lucide-react";
import { assertAreaAccess } from "@/lib/access.functions";

const receptionNav = [
  { to: "/reception", label: "تقويم اليوم", icon: LayoutDashboard },
  { to: "/reception/bookings", label: "الحجوزات والمواعيد", icon: Calendar },
  { to: "/reception/crm", label: "العملاء", icon: Users },
  { to: "/reception/cashier", label: "الكاشير", icon: Wallet },
  { to: "/reception/packages", label: "الباقات والأسعار", icon: Package },
];

export const Route = createFileRoute("/_authenticated/reception")({
  beforeLoad: async () => {
    const _acc = await assertAreaAccess({ data: { area: "reception" } }); if (!_acc.ok) throw redirect({ to: "/auth" });
  },
  component: ReceptionLayout,
});

function ReceptionLayout() {
  return (
    <AreaGate area="reception">
      <AppShell nav={receptionNav} companyLabel="الاستقبال" companyIcon={ConciergeBell} area="studio">
        <Outlet />
      </AppShell>
    </AreaGate>
  );
}