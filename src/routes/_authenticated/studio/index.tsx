import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Calendar, Users, ListTodo, Wallet, Scissors, Palette, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/studio/")({
  head: () => ({ meta: [{ title: "الاستوديو — 4Creative" }] }),
  component: StudioHome,
});

const tiles = [
  { to: "/studio/bookings", label: "المواعيد والحجوزات", icon: Calendar, tint: "from-violet-500 to-fuchsia-500" },
  { to: "/studio/crm", label: "العملاء والمدرسين", icon: Users, tint: "from-blue-500 to-cyan-500" },
  { to: "/studio/tasks", label: "التساكات", icon: ListTodo, tint: "from-amber-500 to-orange-500" },
  { to: "/studio/montage", label: "المونتاج", icon: Scissors, tint: "from-pink-500 to-rose-500" },
  { to: "/studio/design", label: "الديزاين", icon: Palette, tint: "from-indigo-500 to-purple-500" },
  { to: "/studio/accounts", label: "الحسابات والخزنة", icon: Wallet, tint: "from-emerald-500 to-teal-500" },
] as const;

function StudioHome() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl grid place-items-center text-white" style={{ background: "var(--gradient-brand)" }}>
          <Camera className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">شركة الاستوديو والتصوير</h1>
          <p className="text-muted-foreground mt-1">إدارة الحجوزات والإنتاج والحسابات</p>
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