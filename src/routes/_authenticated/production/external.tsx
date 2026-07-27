import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TaskCard, type ProdTask } from "@/components/production/task-card";
import { useAllowedAreas } from "@/lib/use-allowed-areas";

export const Route = createFileRoute("/_authenticated/production/external")({
  head: () => ({ meta: [{ title: "تاسكات خارجية — 4Creative" }] }),
  component: ExternalTasksPage,
});

function ExternalTasksPage() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const allowed = useAllowedAreas();

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const primaryTypes = [
    allowed.editing && "editing",
    allowed.design && "design",
    allowed.shooting && "shooting",
  ].filter(Boolean) as string[];

  const { data: tasks } = useQuery({
    queryKey: ["external-tasks", uid, primaryTypes.join(",")],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("*, contact:contacts(full_name)")
        .eq("assignee_id", uid!)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("priority");
      return (data as unknown as ProdTask[] ?? []).filter((t) => !primaryTypes.includes(t.type));
    },
  });

  const active = (tasks ?? []).filter((t) => !["approved", "rejected", "archived"].includes(t.status));

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">تاسكات خارجية</h1>
        <p className="text-muted-foreground mt-1">تاسكات مسندة إليك خارج تخصصك الأساسي</p>
      </div>

      {active.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا توجد تاسكات خارجية حالياً</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {active.map((t) => (
            <TaskCard key={t.id} task={t} onChanged={() => qc.invalidateQueries({ queryKey: ["external-tasks"] })} />
          ))}
        </div>
      )}
    </div>
  );
}
