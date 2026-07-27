import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Wallet, Scissors, Palette, Camera, ListTodo, Code2, Megaphone, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agency/")({
  head: () => ({ meta: [{ title: "الوكالة — 4Creative" }] }),
  component: AgencyHome,
});

const tiles = [
  { to: "/agency/projects", label: "المشاريع", icon: Briefcase, tint: "from-indigo-500 to-violet-500" },
  { to: "/agency/accounts", label: "الحسابات", icon: Wallet, tint: "from-emerald-500 to-teal-500" },
  { to: "/agency/montage", label: "المونتاج", icon: Scissors, tint: "from-violet-500 to-fuchsia-500" },
  { to: "/agency/design", label: "الديزاين", icon: Palette, tint: "from-pink-500 to-rose-500" },
  { to: "/agency/photography", label: "التصوير", icon: Camera, tint: "from-amber-500 to-orange-500" },
  { to: "/agency/tasks", label: "تساكات الكاتجوري", icon: ListTodo, tint: "from-blue-500 to-cyan-500" },
  { to: "/agency/programming", label: "البرمجة", icon: Code2, tint: "from-indigo-500 to-purple-500" },
] as const;

function AgencyHome() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl grid place-items-center text-white" style={{ background: "var(--gradient-brand)" }}>
          <Megaphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">شركة الماركتنج والبرمجة</h1>
          <p className="text-muted-foreground mt-1">تابع أقسام الوكالة من مكان واحد</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="p-5 hover:shadow-[var(--shadow-elegant)] transition-all hover:-translate-y-0.5 group cursor-pointer">
              <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${t.tint} grid place-items-center text-white shadow-md mb-3`}>
                <t.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold group-hover:text-primary transition-colors">{t.label}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}