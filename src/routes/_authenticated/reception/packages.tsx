import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, Lock } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/reception/packages")({
  head: () => ({ meta: [{ title: "الباقات — الاستقبال — 4Creative" }] }),
  component: ReceptionPackages,
});

function ReceptionPackages() {
  const { data: packages } = useQuery({
    queryKey: ["studio-packages-list"],
    queryFn: async () =>
      (await supabase
        .from("studio_packages")
        .select("*, contact:contacts(full_name, phone)")
        .order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">باقات العملاء</h1>
          <p className="text-muted-foreground mt-1">عرض الباقات وحالة الساعات والمدفوعات — قراءة فقط</p>
        </div>
        <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> قراءة فقط</Badge>
      </div>

      {(packages ?? []).length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا توجد باقات بعد</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(packages ?? []).map((p) => {
            const contact = (p as { contact?: { full_name?: string; phone?: string } }).contact;
            const remaining = Math.max(0, Number(p.total_hours) - Number(p.used_hours));
            const usagePct = p.total_hours > 0 ? (Number(p.used_hours) / Number(p.total_hours)) * 100 : 0;
            const due = Math.max(0, Number(p.total_amount) - Number(p.paid_amount));
            return (
              <Card key={p.id} className="p-5 hover:shadow-[var(--shadow-elegant)] transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 grid place-items-center text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{contact?.full_name ?? "—"}</div>
                  </div>
                  {p.is_active ? <Badge>نشطة</Badge> : <Badge variant="secondary">مغلقة</Badge>}
                </div>

                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>الساعات</span>
                      <span className="tabular-nums">{Number(p.used_hours)} / {Number(p.total_hours)} ساعة</span>
                    </div>
                    <Progress value={usagePct} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">المتبقي: {remaining} ساعة</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded-md bg-muted/40">
                      <div className="text-xs text-muted-foreground">الإجمالي</div>
                      <div className="font-semibold tabular-nums">{Number(p.total_amount).toLocaleString()} ج</div>
                    </div>
                    <div className={`p-2 rounded-md ${due > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}>
                      <div className="text-xs text-muted-foreground">المتبقي</div>
                      <div className="font-semibold tabular-nums">{due.toLocaleString()} ج</div>
                    </div>
                  </div>

                  {p.next_collection_date && (
                    <div className="text-xs text-muted-foreground tabular-nums">
                      📅 موعد التحصيل القادم: {format(new Date(p.next_collection_date), "yyyy/MM/dd")}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}