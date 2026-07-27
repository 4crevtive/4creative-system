import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Film, Image, Camera, Inbox } from "lucide-react";
import { useAllowedAreas } from "@/lib/use-allowed-areas";

export const Route = createFileRoute("/_authenticated/production/")({
  head: () => ({ meta: [{ title: "الإنتاج — 4Creative" }] }),
  component: ProductionHome,
});

function ProductionHome() {
  const allowed = useAllowedAreas();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const { data: counts } = useQuery({
    queryKey: ["my-tasks-counts", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("type, status")
        .eq("assignee_id", uid!)
        .not("status", "in", "(approved,rejected,archived)");
      const map: Record<string, number> = { editing: 0, design: 0, shooting: 0, external: 0 };
      const primary = new Set(
        [allowed.editing && "editing", allowed.design && "design", allowed.shooting && "shooting"].filter(Boolean) as string[],
      );
      for (const t of data ?? []) {
        map[t.type] = (map[t.type] ?? 0) + 1;
        if (!primary.has(t.type)) map.external = (map.external ?? 0) + 1;
      }
      return map;
    },
  });

  // لا يتم التوجيه التلقائي — الصفحة الرئيسية بتعرض التخصص + التاسكات الخارجية.

  const allCards: { to: "/production/editing" | "/production/design" | "/production/shooting"; label: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; key: "editing" | "design" | "shooting"; tone: string }[] = [
    { to: "/production/editing", label: "المونتاج", subtitle: "Started → 50% → مراجعة → تسليم", icon: Film, key: "editing", tone: "from-purple-500/15 to-purple-500/5 border-purple-200" },
    { to: "/production/design", label: "الديزاين", subtitle: "Started → 50% → مراجعة → تسليم", icon: Image, key: "design", tone: "from-blue-500/15 to-blue-500/5 border-blue-200" },
    { to: "/production/shooting", label: "التصوير", subtitle: "Started → تم الانتهاء", icon: Camera, key: "shooting", tone: "from-emerald-500/15 to-emerald-500/5 border-emerald-200" },
  ];
  const cards = allCards.filter((c) => allowed.isAdmin || allowed[c.key]);
  const externalCount = counts?.external ?? 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">الإنتاج</h1>
        <p className="text-muted-foreground mt-1">اختر داشبورد تخصصك لمتابعة التاسكات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const n = counts?.[c.key] ?? 0;
          return (
            <Link key={c.key} to={c.to}>
              <Card className={`p-6 hover:shadow-[var(--shadow-elegant)] transition-all cursor-pointer bg-gradient-to-br ${c.tone}`}>
                <Icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="text-xl font-bold">{c.label}</h3>
                <p className="text-xs text-muted-foreground mt-1">{c.subtitle}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{n}</span>
                  <span className="text-xs text-muted-foreground">تاسك نشط</span>
                </div>
              </Card>
            </Link>
          );
        })}
        {!allowed.isAdmin && (
          <Link to="/production/external">
            <Card className="p-6 hover:shadow-[var(--shadow-elegant)] transition-all cursor-pointer bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-200">
              <Inbox className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-xl font-bold">تاسكات خارجية</h3>
              <p className="text-xs text-muted-foreground mt-1">تاسكات مسندة إليك خارج تخصصك</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{externalCount}</span>
                <span className="text-xs text-muted-foreground">تاسك نشط</span>
              </div>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}