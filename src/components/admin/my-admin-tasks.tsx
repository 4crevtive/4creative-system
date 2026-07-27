import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard, type ProdTask } from "@/components/production/task-card";
import { NewTaskDialog } from "@/components/production/new-task-dialog";

/**
 * Personal tasks board for admin/management users.
 * Shows tasks where the current user is the assignee, a watcher, or the creator.
 * The "New Task" button lets an admin assign a task to themselves or any other admin.
 */
export function MyAdminTasks() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-my-tasks"] });

  const { data: tasks } = useQuery({
    queryKey: ["admin-my-tasks", uid],
    enabled: !!uid,
    queryFn: async () => {
      // Assignee or creator
      const { data: mine } = await supabase.from("tasks")
        .select("*, contact:contacts(full_name)")
        .or(`assignee_id.eq.${uid},created_by.eq.${uid}`)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("priority");
      // Watcher
      const { data: watched } = await supabase.from("task_watchers")
        .select("task_id")
        .eq("user_id", uid!);
      const watchIds = (watched ?? []).map((w) => w.task_id);
      let watchedTasks: ProdTask[] = [];
      if (watchIds.length > 0) {
        const { data } = await supabase.from("tasks")
          .select("*, contact:contacts(full_name)")
          .in("id", watchIds);
        watchedTasks = (data ?? []) as unknown as ProdTask[];
      }
      const map = new Map<string, ProdTask>();
      for (const t of [...((mine ?? []) as unknown as ProdTask[]), ...watchedTasks]) map.set(t.id, t);
      const merged = Array.from(map.values());
      // Enrich with creator (from profiles) and shooting room name
      const creatorIds = Array.from(new Set(merged.map((t) => t.created_by).filter(Boolean))) as string[];
      const roomIds = Array.from(new Set(merged.map((t) => t.shooting_room_id).filter(Boolean))) as string[];
      const [profilesRes, roomsRes] = await Promise.all([
        creatorIds.length > 0
          ? supabase.from("profiles").select("id, display_name, email").in("id", creatorIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string | null; email: string | null }[] }),
        roomIds.length > 0
          ? supabase.from("rooms").select("id, name_ar, name_en, code").in("id", roomIds)
          : Promise.resolve({ data: [] as { id: string; name_ar: string | null; name_en: string | null; code: string | null }[] }),
      ]);
      const pMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const rMap = new Map((roomsRes.data ?? []).map((r) => [r.id, r]));
      for (const t of merged) {
        if (t.created_by) {
          const p = pMap.get(t.created_by);
          if (p) t.creator = { display_name: p.display_name, email: p.email };
        }
        if (t.shooting_room_id) {
          const r = rMap.get(t.shooting_room_id);
          if (r) t.room = { name: r.name_ar || r.name_en, code: r.code };
        }
      }
      return merged.sort((a, b) => {
        const ad = a.due_at ? new Date(a.due_at).getTime() : Infinity;
        const bd = b.due_at ? new Date(b.due_at).getTime() : Infinity;
        return ad - bd;
      });
    },
  });

  const all = tasks ?? [];
  const active = all.filter((t) => !["approved", "rejected", "archived"].includes(t.status));
  const done = all.filter((t) => ["approved", "archived"].includes(t.status));

  const byType = (type: string) => active.filter((t) => t.type === type);

  const visible =
    tab === "all" ? active
      : tab === "done" ? done
      : byType(tab);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مهامي</h1>
          <p className="text-muted-foreground mt-1">
            التاسكات المسندة إليك أو التي أنشأتها. يمكنك إضافة مهمة لنفسك أو لأي عضو آخر من الإدارة.
          </p>
        </div>
        <NewTaskDialog
          defaultType="editing"
          assignPool="all"
          preselectSelf
          triggerLabel="تاسك جديد لي أو لزميل"
          onCreated={invalidate}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="إجمالي نشط" value={active.length} />
        <Stat label="مونتاج" value={byType("editing").length} />
        <Stat label="ديزاين" value={byType("design").length} />
        <Stat label="برمجة" value={byType("programming").length} />
        <Stat label="ماركتنج" value={byType("marketing").length} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">الكل ({active.length})</TabsTrigger>
          <TabsTrigger value="editing">مونتاج ({byType("editing").length})</TabsTrigger>
          <TabsTrigger value="design">ديزاين ({byType("design").length})</TabsTrigger>
          <TabsTrigger value="shooting">تصوير ({byType("shooting").length})</TabsTrigger>
          <TabsTrigger value="programming">برمجة ({byType("programming").length})</TabsTrigger>
          <TabsTrigger value="marketing">ماركتنج ({byType("marketing").length})</TabsTrigger>
          <TabsTrigger value="done">منتهية ({done.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا توجد تاسكات في هذه الفئة</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map((t) => (
            <TaskCard key={t.id} task={t} onChanged={invalidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </Card>
  );
}