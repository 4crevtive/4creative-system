import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, Camera, Film, Image } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TaskDetailView } from "@/components/production/task-detail-view";

export const Route = createFileRoute("/_authenticated/production/history")({
  head: () => ({ meta: [{ title: "السجل — الإنتاج — 4Creative" }] }),
  component: HistoryPage,
});

const statusLabels: Record<string, string> = {
  submitted: "مُرسل", uploaded: "تم الرفع", completed: "مكتمل",
  approved: "معتمد", rejected: "مرفوض", archived: "مؤرشف",
};

function HistoryPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const { data: tasks } = useQuery({
    queryKey: ["my-history", uid],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("tasks")
      .select("*, contact:contacts(full_name)")
      .eq("assignee_id", uid!)
      .in("status", ["submitted", "uploaded", "completed", "approved", "rejected", "archived"])
      .order("updated_at", { ascending: false })
      .limit(200)).data ?? [],
  });

  function typeIcon(t: string) {
    if (t === "shooting") return Camera;
    if (t === "editing") return Film;
    return Image;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">سجل التاسكات</h1>
        <p className="text-muted-foreground mt-1">جميع التاسكات المعتمدة والمسلّمة</p>
      </div>

      {(tasks ?? []).length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا يوجد سجل بعد</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-right p-3">التاسك</th>
                <th className="text-right p-3">العميل</th>
                <th className="text-right p-3">سُلّم</th>
                <th className="text-right p-3">اعتُمد</th>
                <th className="text-right p-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {tasks!.map((t) => {
                const Icon = typeIcon(t.type);
                const contact = (t as { contact?: { full_name?: string } }).contact;
                return (
                  <tr key={t.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setOpenId(t.id)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="font-medium">{t.title}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{contact?.full_name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground tabular-nums text-xs">
                      {t.submitted_at ? (
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(t.submitted_at), "yyyy/MM/dd HH:mm")}</span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground tabular-nums text-xs">
                      {t.approved_at ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" />{format(new Date(t.approved_at), "yyyy/MM/dd HH:mm")}</span>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      {t.status === "approved" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 text-xs"><CheckCircle2 className="h-3 w-3 ml-0.5" /> معتمد</Badge>
                      ) : t.status === "rejected" ? (
                        <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 ml-0.5" /> مرفوض</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{statusLabels[t.status] ?? t.status}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
          {openId && <TaskDetailView id={openId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}