import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Home, LayoutDashboard, UserCog, ShieldCheck, BarChart3, ListTodo, Activity, History, Shield, UserCheck, Wallet, Briefcase, User, Package } from "lucide-react";
import { AreaGate } from "@/components/area-gate";
import { assertAreaAccess } from "@/lib/access.functions";

const hubNav = [
  { to: "/dashboard", label: "اللوحة الإدارية", icon: LayoutDashboard },
  { to: "/my-tasks", label: "مهامي", icon: UserCheck },
  { to: "/hr", label: "الحضور والموظفين", icon: UserCog },
  { to: "/freelancers", label: "الفريلانسرز", icon: Briefcase },
  { to: "/accounts", label: "الحسابات الشاملة", icon: Wallet },
  { to: "/packages", label: "الباقات والأسعار", icon: Package },
  { to: "/production/admin", label: "إدارة المهام", icon: ListTodo },
  { to: "/production/monitor", label: "المتابعة المباشرة", icon: Activity },
  { to: "/production/history", label: "سجل المهام", icon: History },
  { to: "/production/performance", label: "أداء الفريق", icon: Shield },
  { to: "/reports", label: "التقارير والتحليلات", icon: BarChart3 },
  { to: "/users", label: "إدارة المستخدمين", icon: ShieldCheck },
  { to: "/me", label: "بروفايلي", icon: User },
];

export const Route = createFileRoute("/_authenticated/_hub")({
  beforeLoad: async () => {
    const _acc = await assertAreaAccess({ data: { area: "hub" } }); if (!_acc.ok) throw redirect({ to: "/auth" });
  },
  component: () => (
    <AreaGate area="hub">
      <AppShell nav={hubNav} companyLabel="إدارة 4Creative" companyIcon={Home} area="hub">
        <Outlet />
      </AppShell>
    </AreaGate>
  ),
});