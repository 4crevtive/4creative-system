import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell, type NavItem } from "@/components/app-shell";
import { AreaGate } from "@/components/area-gate";
import { useAllowedAreas } from "@/lib/use-allowed-areas";
import { Film, Image, Camera, History, Shield, Clapperboard, Activity, BarChart3, LayoutDashboard, UserCog, ShieldCheck, ListTodo, Home, UserCheck, Wallet, Inbox } from "lucide-react";
import { assertAreaAccess } from "@/lib/access.functions";

export const Route = createFileRoute("/_authenticated/production")({
  ssr: false,
  beforeLoad: async () => {
    const _acc = await assertAreaAccess({ data: { area: "production" } }); if (!_acc.ok) throw redirect({ to: "/auth" });
  },
  component: ProductionLayout,
});

function ProductionLayout() {
  const allowed = useAllowedAreas();
  // Admins see the unified Hub sidebar — task management is integrated into the main dashboard.
  if (allowed.isAdmin) {
    const hubNav: NavItem[] = [
      { to: "/dashboard", label: "اللوحة الإدارية", icon: LayoutDashboard },
      { to: "/my-tasks", label: "مهامي", icon: UserCheck },
      { to: "/hr", label: "الحضور والموظفين", icon: UserCog },
      { to: "/accounts", label: "الحسابات الشاملة", icon: Wallet },
      { to: "/production/admin", label: "إدارة المهام", icon: ListTodo },
      { to: "/production/monitor", label: "المتابعة المباشرة", icon: Activity },
      { to: "/production/history", label: "سجل المهام", icon: History },
      { to: "/production/performance", label: "أداء الفريق", icon: BarChart3 },
      { to: "/reports", label: "التقارير والتحليلات", icon: Shield },
      { to: "/users", label: "إدارة المستخدمين", icon: ShieldCheck },
    ];
    return (
      <AreaGate area="production">
        <AppShell nav={hubNav} companyLabel="إدارة 4Creative" companyIcon={Home} area="hub">
          <Outlet />
        </AppShell>
      </AreaGate>
    );
  }

  // Employees see only their own production board
  const nav: NavItem[] = [
    { to: "/production", label: "الرئيسية", icon: Home },
  ];
  if (allowed.isAdmin || allowed.editing) nav.push({ to: "/production/editing", label: "مونتاج", icon: Film });
  if (allowed.isAdmin || allowed.design) nav.push({ to: "/production/design", label: "ديزاين", icon: Image });
  if (allowed.isAdmin || allowed.shooting) nav.push({ to: "/production/shooting", label: "تصوير", icon: Camera });
  nav.push({ to: "/production/external", label: "تاسكات خارجية", icon: Inbox });
  nav.push({ to: "/production/history", label: "السجل", icon: History });

  return (
    <AreaGate area="production">
      <AppShell nav={nav} companyLabel="الإنتاج" companyIcon={Clapperboard} area="studio">
        <Outlet />
      </AppShell>
    </AreaGate>
  );
}