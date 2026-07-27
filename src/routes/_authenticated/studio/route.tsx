import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AreaGate } from "@/components/area-gate";
import { assertAreaAccess } from "@/lib/access.functions";
import {
  LayoutDashboard, Calendar, Users, Wallet, Scissors, Palette, Camera, Code2, Megaphone, BarChart3,
} from "lucide-react";

const studioNav = [
  { to: "/studio", label: "لوحة الاستوديو", icon: LayoutDashboard },
  { to: "/studio/bookings", label: "المواعيد والحجوزات", icon: Calendar },
  { to: "/studio/crm", label: "العملاء والمدرسين", icon: Users },
  { to: "/studio/programming", label: "تساكات البرمجة", icon: Code2 },
  { to: "/studio/montage", label: "تساكات المونتاج", icon: Scissors },
  { to: "/studio/design", label: "تساكات الديزاين", icon: Palette },
  { to: "/studio/photography", label: "تساكات التصوير", icon: Camera },
  { to: "/studio/marketing", label: "تساكات الماركتنج", icon: Megaphone },
  { to: "/studio/kpis", label: "حساب الـ KPIs", icon: BarChart3 },
  { to: "/studio/accounts", label: "الحسابات والخزنة", icon: Wallet },
];

export const Route = createFileRoute("/_authenticated/studio")({
  beforeLoad: async () => {
    const _acc = await assertAreaAccess({ data: { area: "studio" } }); if (!_acc.ok) throw redirect({ to: "/auth" });
  },
  component: () => (
    <AreaGate area="studio">
      <AppShell nav={studioNav} companyLabel="الاستوديو والتصوير" companyIcon={Camera} area="studio">
        <Outlet />
      </AppShell>
    </AreaGate>
  ),
});