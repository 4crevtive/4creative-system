import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AreaGate } from "@/components/area-gate";
import { assertAreaAccess } from "@/lib/access.functions";
import {
  LayoutDashboard, Wallet, Scissors, Palette, Camera, ListTodo, Code2, Megaphone, Briefcase, Users,
} from "lucide-react";

const agencyNav = [
  { to: "/agency", label: "لوحة الوكالة", icon: LayoutDashboard },
  { to: "/agency/clients", label: "العملاء", icon: Users },
  { to: "/agency/projects", label: "المشاريع", icon: Briefcase },
  { to: "/agency/accounts", label: "الحسابات", icon: Wallet },
  { to: "/agency/montage", label: "المونتاج", icon: Scissors },
  { to: "/agency/design", label: "الديزاين", icon: Palette },
  { to: "/agency/photography", label: "التصوير", icon: Camera },
  { to: "/agency/tasks", label: "تساكات حسب الكاتجوري", icon: ListTodo },
  { to: "/agency/programming", label: "البرمجة", icon: Code2 },
];

export const Route = createFileRoute("/_authenticated/agency")({
  beforeLoad: async () => {
    const _acc = await assertAreaAccess({ data: { area: "agency" } }); if (!_acc.ok) throw redirect({ to: "/auth" });
  },
  component: () => (
    <AreaGate area="agency">
      <AppShell nav={agencyNav} companyLabel="الماركتنج والبرمجة" companyIcon={Megaphone} area="agency">
        <Outlet />
      </AppShell>
    </AreaGate>
  ),
});