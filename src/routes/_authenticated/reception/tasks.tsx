import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard, type ProdTask } from "@/components/production/task-card";

export const Route = createFileRoute("/_authenticated/reception/tasks")({
  head: () => ({
    meta: [
      { title: "تاسكات الاستقبال — 4Creative" },
      { name: "description", content: "التاسكات المسندة لموظف الاستقبال ومتابعة حالتها خطوة بخطوة." },
      { property: "og:title", content: "تاسكات الاستقبال — 4Creative" },
      { property: "og:description", content: "التاسكات المسندة لموظف الاستقبال ومتابعة حالتها خطوة بخطوة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceptionTasksPage,
});

function ReceptionTasksPage() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [filter, setFilter] = useState("active");

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const { data: tasks } = useQuery({
    queryKey: ["reception-tasks", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("*, contact:contacts(full_name)")
        .eq("assignee_id", uid!)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("priority");
      return (data as unknown as ProdTask[]) ?? [];
    },
  });

  const active = (tasks ?? []).filter((t) => !["approved", "rejected", "archived"].includes(t.status));
  const stats = {
    pending: active.filter((t) => t.status === "pending").length,
    inProgress: active.filter((t) => ["started", "progress_50", "in_review"].includes(t.status)).length,
    submitted: active.filter((t) => t.status === "submitted").length,
    total: active.length,
  };

  const visible = filter === "active" ? active
    : filter === "pending" ? active.filter((t) => t.status === "pending")
    : filter === "submitted" ? active.filter((t) => t.status === "submitted")
    : active.filter((t) => ["started", "progress_50", "in_review"].includes(t.status));

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">تاسكاتي</h1>
        <p className="text-muted-foreground mt-1">التاسكات المسندة إليك في الاستقبال</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="إجمالي نشط" value={stats.total} />
        <Stat label="في الانتظار" value={stats.pending} tone="muted" />
        <Stat label="قيد التنفيذ" value={stats.inProgress} tone="blue" />
        <Stat label="بانتظار الاعتماد" value={stats.submitted} tone="orange" />
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="active">الكل ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">جديد ({stats.pending})</TabsTrigger>
          <TabsTrigger value="progress">قيد التنفيذ ({stats.inProgress})</TabsTrigger>
          <TabsTrigger value="submitted">بانتظار الاعتماد ({stats.submitted})</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا توجد تاسكات في هذه الحالة</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map((t) => (
            <TaskCard key={t.id} task={t} onChanged={() => qc.invalidateQueries({ queryKey: ["reception-tasks"] })} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "muted" | "blue" | "orange" }) {
  const tones = {
    muted: "bg-muted/40", blue: "bg-blue-500/10 text-blue-700",
    orange: "bg-orange-500/10 text-orange-700",
  } as const;
  return (
    <Card className={`p-4 ${tone ? tones[tone] : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </Card>
  );
}
