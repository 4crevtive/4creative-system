import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Clock, Calendar, Film, Image as ImageIcon, Camera, PlayCircle, CheckCircle2, Building2, MapPin,
  Send, Eye, AlertCircle, Upload, FileText, Trash2, Download, MessageCircle, History as HistoryIcon, Link2, User, Undo2, AtSign,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { changeStatus } from "@/components/production/task-card";
import { useAllowedAreas } from "@/lib/use-allowed-areas";
import { EditTaskDialog } from "@/components/production/edit-task-dialog";
import { Pencil } from "lucide-react";

type FullTask = {
  id: string; title: string; description: string | null; type: string; status: string;
  priority: number; due_at: string | null; started_at: string | null; submitted_at: string | null;
  approved_at: string | null; created_at: string; assignee_id: string | null; created_by: string | null;
  video_duration_pre_seconds: number | null; video_duration_post_seconds: number | null;
  client_name: string | null; project_name: string | null; video_type: string | null;
  aspect_ratio: string | null; resolution: string | null; platform: string | null;
  delivery_method: string | null; required_output: string | null; estimated_minutes: number | null;
  shooting_room_id: string | null; shooting_location: string | null; shooting_external_address: string | null; shooting_notes: string | null;
  contact?: { full_name: string } | null;
  assignee?: { display_name: string | null; email: string } | null;
  shooting_room?: { name_ar: string | null; name_en: string | null } | null;
};

export type TaskSeed = Partial<FullTask> & { id: string; title?: string | null; type?: string | null; status?: string | null };

const STATUS_AR: Record<string, string> = {
  pending: "في الانتظار", accepted: "تم القبول", started: "تم البدء", progress_50: "50% منجز",
  in_review: "مراجعة داخلية", submitted: "تم التسليم (بانتظار الاعتماد)",
  shooting_started: "بدء التصوير", shooting_done: "انتهى التصوير", uploaded: "تم الرفع",
  approved: "معتمد", completed: "مكتمل", rejected: "مرفوض", archived: "مؤرشف",
};
const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  accepted: "bg-sky-500/15 text-sky-700",
  started: "bg-blue-500/15 text-blue-700",
  progress_50: "bg-amber-500/15 text-amber-700",
  in_review: "bg-purple-500/15 text-purple-700",
  submitted: "bg-orange-500/15 text-orange-700",
  shooting_started: "bg-blue-500/15 text-blue-700",
  shooting_done: "bg-purple-500/15 text-purple-700",
  uploaded: "bg-purple-500/15 text-purple-700",
  approved: "bg-emerald-500/15 text-emerald-700",
  completed: "bg-emerald-500/15 text-emerald-700",
  rejected: "bg-rose-500/15 text-rose-700",
  archived: "bg-muted text-muted-foreground",
};

const SHOOTING_LOCATION_AR: Record<string, string> = {
  inside: "داخل المكان",
  outside: "خارج المكان",
  both: "داخل وخارج المكان",
};

function typeIcon(t: string) {
  if (t === "shooting") return Camera;
  if (t === "design") return ImageIcon;
  return Film;
}
function fmtDur(s: number | null) {
  if (!s) return null;
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function toFullTask(seed: TaskSeed): FullTask {
  return {
    id: seed.id,
    title: seed.title ?? "بدون عنوان",
    description: seed.description ?? null,
    type: seed.type ?? "editing",
    status: seed.status ?? "pending",
    priority: seed.priority ?? 3,
    due_at: seed.due_at ?? null,
    started_at: seed.started_at ?? null,
    submitted_at: seed.submitted_at ?? null,
    approved_at: seed.approved_at ?? null,
    created_at: seed.created_at ?? new Date().toISOString(),
    assignee_id: seed.assignee_id ?? null,
    created_by: seed.created_by ?? null,
    video_duration_pre_seconds: seed.video_duration_pre_seconds ?? null,
    video_duration_post_seconds: seed.video_duration_post_seconds ?? null,
    client_name: seed.client_name ?? null,
    project_name: seed.project_name ?? null,
    video_type: seed.video_type ?? null,
    aspect_ratio: seed.aspect_ratio ?? null,
    resolution: seed.resolution ?? null,
    platform: seed.platform ?? null,
    delivery_method: seed.delivery_method ?? null,
    required_output: seed.required_output ?? null,
    estimated_minutes: seed.estimated_minutes ?? null,
    shooting_room_id: seed.shooting_room_id ?? null,
    shooting_location: seed.shooting_location ?? null,
    shooting_external_address: seed.shooting_external_address ?? null,
    shooting_notes: seed.shooting_notes ?? null,
    contact: seed.contact ?? null,
    assignee: seed.assignee ?? null,
    shooting_room: seed.shooting_room ?? null,
  };
}

function isSafeHttpUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  return /^https?:\/\//i.test(u.trim());
}

function findTaskInCache(data: unknown, id: string): TaskSeed | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findTaskInCache(item, id);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (record.id === id) return record as TaskSeed;
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) {
        const found = findTaskInCache(value, id);
        if (found) return found;
      }
    }
  }
  return null;
}

export function TaskDetailView({ id, initialTask }: { id: string; initialTask?: TaskSeed }) {
  const qc = useQueryClient();
  const allowed = useAllowedAreas();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const cachedTask = useMemo(() => {
    if (!id) return null;
    if (initialTask?.id === id) return toFullTask(initialTask);
    for (const [, data] of qc.getQueriesData({})) {
      const found = findTaskInCache(data, id);
      if (found) return toFullTask(found);
    }
    return null;
  }, [id, initialTask, qc]);

  const { data: fetchedTask, isLoading } = useQuery({
    queryKey: ["task-detail", id],
    enabled: !!id,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks")
        .select("*, contact:contacts(full_name)")
        .eq("id", id).maybeSingle();
      if (error) {
        console.error("task-detail-load-error", error);
        return null;
      }
      if (!data) return null;
      let assignee: FullTask["assignee"] = null;
      let shooting_room: FullTask["shooting_room"] = null;
      if ((data as { assignee_id: string | null }).assignee_id) {
        const { data: p } = await supabase.from("profiles")
          .select("display_name, email")
          .eq("id", (data as { assignee_id: string }).assignee_id)
          .maybeSingle();
        assignee = (p as FullTask["assignee"]) ?? null;
      }
      if ((data as { shooting_room_id?: string | null }).shooting_room_id) {
        const { data: room } = await supabase.from("rooms")
          .select("name_ar, name_en")
          .eq("id", (data as { shooting_room_id: string }).shooting_room_id)
          .maybeSingle();
        shooting_room = (room as FullTask["shooting_room"]) ?? null;
      }
      return { ...(data as unknown as FullTask), assignee, shooting_room };
    },
  });
  const task = fetchedTask ?? cachedTask;

  const { data: internalNotes } = useQuery({
    queryKey: ["task-internal-notes", id],
    enabled: !!id && !!allowed.isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("task_internal_notes").select("notes").eq("task_id", id).maybeSingle();
      return (data as { notes: string | null } | null)?.notes ?? null;
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`task-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["task-detail", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_checklist_items", filter: `task_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["task-checklist", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_attachments", filter: `task_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["task-attachments", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["task-comments", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_status_history", filter: `task_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["task-history", id] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, qc]);

  if (isLoading && !cachedTask) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="h-8 w-2/3 bg-muted/60 rounded animate-pulse" />
        <div className="h-4 w-1/3 bg-muted/40 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-64 lg:order-2 bg-muted/30 rounded-lg animate-pulse" />
          <div className="lg:col-span-2 lg:order-1 space-y-3">
            <div className="h-24 bg-muted/30 rounded-lg animate-pulse" />
            <div className="h-40 bg-muted/30 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }
  if (!task) {
    return (
      <Card className="p-8 text-center space-y-3" dir="rtl">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted grid place-items-center">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-lg font-semibold">التاسك غير موجود</div>
        <p className="text-sm text-muted-foreground">قد يكون التاسك تم حذفه، أو أن صلاحيات الحساب لا تسمح بقراءته.</p>
      </Card>
    );
  }

  const isAssignee = uid === task.assignee_id;
  const isAdmin = allowed.isAdmin;
  const canAct = isAssignee || isAdmin;
  const canEdit = isAdmin || uid === task.created_by;
  const Icon = typeIcon(task.type);
  const overdue = task.due_at && new Date(task.due_at) < new Date() && !["approved", "completed", "archived"].includes(task.status);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            <Badge className={`text-xs ${STATUS_TONE[task.status] ?? ""}`}>{STATUS_AR[task.status] ?? task.status}</Badge>
            {task.priority <= 2 && <Badge variant="destructive">عاجل</Badge>}
            {overdue && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> متأخر</Badge>}
          </div>
          {(task.project_name || task.client_name) && (
            <p className="text-muted-foreground">
              {task.project_name}{task.project_name && (task.client_name || task.contact?.full_name) ? " • " : ""}
              {task.client_name || task.contact?.full_name}
            </p>
          )}
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> تعديل
          </Button>
        )}
      </div>

      {canEdit && (
        <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 space-y-3 lg:order-2 h-fit">
          <h3 className="text-sm font-semibold">المعلومات</h3>
          <Separator />
          <InfoRow icon={User} label="المسند إليه" value={task.assignee?.display_name ?? task.assignee?.email ?? "—"} />
          {task.due_at && <InfoRow icon={Calendar} label="موعد التسليم" value={format(new Date(task.due_at), "yyyy/MM/dd HH:mm:ss")} />}
          {task.estimated_minutes && <InfoRow icon={Clock} label="الوقت المقدر" value={`${task.estimated_minutes} دقيقة`} />}
          {task.video_type && <InfoRow label="نوع الفيديو" value={task.video_type} />}
          {task.aspect_ratio && <InfoRow label="الأبعاد" value={task.aspect_ratio} />}
          {task.resolution && <InfoRow label="الدقة" value={task.resolution} />}
          {task.platform && <InfoRow label="المنصة" value={task.platform} />}
          {task.delivery_method && <InfoRow label="طريقة التسليم" value={task.delivery_method} />}
          {task.required_output && <InfoRow label="المطلوب" value={task.required_output} />}
          {task.type === "shooting" && task.shooting_location && <InfoRow icon={MapPin} label="مكان التصوير" value={SHOOTING_LOCATION_AR[task.shooting_location] ?? task.shooting_location} />}
          {task.type === "shooting" && task.shooting_room && <InfoRow icon={Building2} label="الغرفة" value={task.shooting_room.name_ar ?? task.shooting_room.name_en ?? "—"} />}
          {task.type === "shooting" && task.shooting_external_address && <InfoRow icon={MapPin} label="العنوان الخارجي" value={task.shooting_external_address} />}
          {(task.video_duration_pre_seconds || task.video_duration_post_seconds) && (
            <InfoRow label="المدة" value={`${fmtDur(task.video_duration_pre_seconds) ?? "—"} ← ${fmtDur(task.video_duration_post_seconds) ?? "؟"}`} />
          )}
          {task.started_at && (
            <InfoRow
              label="بدأ"
              value={`${format(new Date(task.started_at), "yyyy/MM/dd HH:mm:ss")} · ${formatDistanceToNow(new Date(task.started_at), { addSuffix: true, locale: ar })}`}
            />
          )}
          {task.submitted_at && (
            <InfoRow
              label="سُلّم"
              value={`${format(new Date(task.submitted_at), "yyyy/MM/dd HH:mm:ss")} · ${formatDistanceToNow(new Date(task.submitted_at), { addSuffix: true, locale: ar })}`}
            />
          )}
          {task.approved_at && (
            <InfoRow
              label="اعتُمد"
              value={`${format(new Date(task.approved_at), "yyyy/MM/dd HH:mm:ss")} · ${formatDistanceToNow(new Date(task.approved_at), { addSuffix: true, locale: ar })}`}
            />
          )}

          {canAct && (
            <>
              <Separator />
              <WorkflowButtons task={task} isAdmin={isAdmin} isAssignee={isAssignee} onChanged={() => qc.invalidateQueries({ queryKey: ["task-detail", id] })} />
            </>
          )}
        </Card>

        <div className="lg:col-span-2 lg:order-1 space-y-4">
          {task.description && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">الوصف</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </Card>
          )}
          {isAdmin && internalNotes && (
            <Card className="p-4 bg-amber-500/5 border-amber-300/40">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-amber-700"><AlertCircle className="h-4 w-4" /> ملاحظات داخلية</h3>
              <p className="text-sm whitespace-pre-wrap">{internalNotes}</p>
            </Card>
          )}

          {task.type === "shooting" && task.shooting_notes && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Camera className="h-4 w-4" /> ملاحظات التصوير</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{task.shooting_notes}</p>
            </Card>
          )}

          <Tabs defaultValue="checklist">
            <TabsList>
              <TabsTrigger value="checklist">قائمة المهام</TabsTrigger>
              <TabsTrigger value="files">الملفات</TabsTrigger>
              <TabsTrigger value="refs">روابط</TabsTrigger>
              <TabsTrigger value="comments">التعليقات</TabsTrigger>
              <TabsTrigger value="history">السجل</TabsTrigger>
            </TabsList>
            <TabsContent value="checklist"><ChecklistPanel taskId={id} canEdit={canAct} /></TabsContent>
            <TabsContent value="files"><FilesPanel taskId={id} canUpload={canAct} /></TabsContent>
            <TabsContent value="refs"><ReferencesPanel taskId={id} canEdit={canAct} /></TabsContent>
            <TabsContent value="comments"><CommentsPanel taskId={id} uid={uid} /></TabsContent>
            <TabsContent value="history"><HistoryPanel taskId={id} /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: I, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">{I && <I className="h-3.5 w-3.5" />}{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function WorkflowButtons({ task, isAdmin, isAssignee, onChanged }: { task: FullTask; isAdmin: boolean; isAssignee: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function act(to: string, extra?: Record<string, unknown>) {
    setBusy(true);
    const ok = await changeStatus(task.id, task.status, to, extra);
    setBusy(false);
    if (ok) { toast.success("تم التحديث"); onChanged(); }
  }
  const isShooting = task.type === "shooting";
  const buttons: React.ReactNode[] = [];

  if (isAssignee) {
    if (task.status === "pending") buttons.push(
      <Button key="accept" size="sm" variant="outline" disabled={busy} onClick={() => act("accepted", { accepted_at: new Date().toISOString() })}>
        <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> قبول المهمة
      </Button>,
      <Button key="start" size="sm" disabled={busy} onClick={() => act(isShooting ? "shooting_started" : "started", { started_at: new Date().toISOString() })}>
        <PlayCircle className="h-3.5 w-3.5 ml-1" /> ابدأ الآن
      </Button>,
    );
    if (task.status === "accepted") buttons.push(
      <Button key="start2" size="sm" disabled={busy} onClick={() => act(isShooting ? "shooting_started" : "started", { started_at: new Date().toISOString() })}>
        <PlayCircle className="h-3.5 w-3.5 ml-1" /> ابدأ الآن
      </Button>,
    );
    if (isShooting) {
      if (["started", "shooting_started"].includes(task.status))
        buttons.push(<Button key="done" size="sm" disabled={busy} onClick={() => act("submitted", { submitted_at: new Date().toISOString() })}><CheckCircle2 className="h-3.5 w-3.5 ml-1" /> تم الانتهاء</Button>);
    } else {
      if (task.status === "started") buttons.push(<Button key="50" size="sm" variant="outline" disabled={busy} onClick={() => act("progress_50")}><PlayCircle className="h-3.5 w-3.5 ml-1" /> وصلت 50%</Button>);
      if (["started", "progress_50"].includes(task.status)) buttons.push(<Button key="rev" size="sm" variant="outline" disabled={busy} onClick={() => act("in_review")}><Eye className="h-3.5 w-3.5 ml-1" /> للمراجعة</Button>);
      if (["started", "progress_50", "in_review"].includes(task.status))
        buttons.push(<Button key="sub" size="sm" disabled={busy} onClick={() => act("submitted", { submitted_at: new Date().toISOString() })}><Send className="h-3.5 w-3.5 ml-1" /> تسليم نهائي</Button>);
    }
  }

  if (isAdmin && task.status === "submitted") {
    buttons.push(
      <Button key="approve" size="sm" disabled={busy} onClick={() => act("approved", { approved_at: new Date().toISOString() })}>
        <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> اعتماد التسليم
      </Button>,
      <Button key="reject" size="sm" variant="outline" disabled={busy} onClick={() => act("rejected")}>
        رفض وإرجاع
      </Button>,
    );
  }

  // Revert / تراجع خطوة — متاح للموظف أو الأدمن
  const PREV: Record<string, { to: string; clear?: Record<string, null> }> = isShooting
    ? {
        accepted: { to: "pending" },
        shooting_started: { to: "accepted", clear: { started_at: null } },
        submitted: { to: "shooting_started", clear: { submitted_at: null } },
        rejected: { to: "shooting_started" },
      }
    : {
        accepted: { to: "pending" },
        started: { to: "accepted", clear: { started_at: null } },
        progress_50: { to: "started" },
        in_review: { to: "progress_50" },
        submitted: { to: "in_review", clear: { submitted_at: null } },
        rejected: { to: "in_review" },
      };
  const prev = PREV[task.status];
  if (prev && (isAssignee || isAdmin) && task.status !== "approved" && task.status !== "completed") {
    buttons.push(
      <Button key="revert" size="sm" variant="ghost" disabled={busy}
        onClick={() => { if (confirm("هل تريد التراجع خطوة للوراء؟")) act(prev.to, prev.clear); }}>
        <Undo2 className="h-3.5 w-3.5 ml-1" /> تراجع خطوة
      </Button>,
    );
  }

  if (buttons.length === 0) return <p className="text-xs text-muted-foreground text-center py-2">لا توجد إجراءات متاحة</p>;
  return <div className="flex flex-col gap-2">{buttons}</div>;
}

function ChecklistPanel({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState("");
  const { data: items } = useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: async () => (await supabase.from("task_checklist_items")
      .select("*").eq("task_id", taskId).order("position")).data ?? [],
  });
  const list = items ?? [];
  const done = list.filter((i) => i.is_done).length;
  const pct = list.length === 0 ? 0 : Math.round((done / list.length) * 100);

  async function toggle(itemId: string, val: boolean) {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("task_checklist_items").update({
      is_done: val, done_by: val ? u.user?.id : null, done_at: val ? new Date().toISOString() : null,
    } as never).eq("id", itemId);
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
  }
  async function add() {
    if (!newItem.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("task_checklist_items").insert({
      task_id: taskId, title: newItem.trim(), position: list.length, created_by: u.user?.id,
    } as never);
    setNewItem("");
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
  }
  async function remove(itemId: string) {
    await supabase.from("task_checklist_items").delete().eq("id", itemId);
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
  }

  return (
    <Card className="p-4 space-y-3">
      {list.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">التقدم</span>
            <span className="font-medium tabular-nums">{done}/{list.length} ({pct}%)</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <ul className="space-y-1">
        {list.length === 0 && <li className="text-sm text-muted-foreground text-center py-4">لا توجد بنود</li>}
        {list.map((it) => (
          <li key={it.id} className="flex items-center gap-2 rounded-md hover:bg-muted/50 px-2 py-1.5 group">
            <Checkbox checked={it.is_done} onCheckedChange={(v) => toggle(it.id, !!v)} disabled={!canEdit} />
            <span className={`flex-1 text-sm ${it.is_done ? "line-through text-muted-foreground" : ""}`}>{it.title}</span>
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => remove(it.id)}>
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="flex gap-2 pt-2 border-t">
          <Input placeholder="أضف بند جديد..." value={newItem} onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <Button onClick={add} disabled={!newItem.trim()}>إضافة</Button>
        </div>
      )}
    </Card>
  );
}

function FilesPanel({ taskId, canUpload }: { taskId: string; canUpload: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<"general" | "submission" | "preview" | "source">("general");

  const { data: files } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => (await supabase.from("task_attachments")
      .select("*").eq("task_id", taskId).order("created_at", { ascending: false })).data ?? [],
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const path = `${taskId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("task-files").upload(path, file);
      if (upErr) throw upErr;
      const existingSameKind = (files ?? []).filter((f) => f.kind === kind).length;
      await supabase.from("task_attachments").insert({
        task_id: taskId, storage_path: path, file_name: file.name,
        mime_type: file.type || null, size_bytes: file.size,
        version: existingSameKind + 1, kind, uploaded_by: u.user?.id,
      } as never);
      toast.success("تم رفع الملف");
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("task-files").createSignedUrl(path, 60);
    if (error || !data) { toast.error("تعذر إنشاء رابط التحميل"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.click();
  }

  async function remove(id: string, path: string) {
    if (!confirm("حذف هذا الملف؟")) return;
    await supabase.storage.from("task-files").remove([path]);
    await supabase.from("task_attachments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
  }

  const KIND_AR: Record<string, string> = { general: "عام", submission: "تسليم", preview: "بريفيو", source: "مصدر" };
  const KIND_TONE: Record<string, string> = {
    general: "bg-muted text-muted-foreground",
    submission: "bg-emerald-500/15 text-emerald-700",
    preview: "bg-blue-500/15 text-blue-700",
    source: "bg-purple-500/15 text-purple-700",
  };

  return (
    <Card className="p-4 space-y-3">
      {canUpload && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-dashed bg-muted/30">
          <select value={kind} onChange={(e) => setKind(e.target.value as "general" | "submission" | "preview" | "source")}
            className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="general">عام</option>
            <option value="preview">بريفيو</option>
            <option value="submission">تسليم نهائي</option>
            <option value="source">ملفات مصدر</option>
          </select>
          <input ref={fileRef} type="file" hidden onChange={onPick} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-3.5 w-3.5 ml-1" /> {uploading ? "جاري الرفع..." : "اختر ملف"}
          </Button>
          <span className="text-xs text-muted-foreground">سيتم تخزين كل نسخة جديدة كإصدار منفصل</span>
        </div>
      )}
      <ul className="space-y-1.5">
        {(files ?? []).length === 0 && <li className="text-sm text-muted-foreground text-center py-6">لا توجد ملفات</li>}
        {(files ?? []).map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-2.5 rounded-md border bg-card hover:bg-muted/30">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{f.file_name}</span>
                <Badge className={`text-[10px] ${KIND_TONE[f.kind] ?? ""}`}>{KIND_AR[f.kind] ?? f.kind}</Badge>
                <Badge variant="outline" className="text-[10px]">v{f.version}</Badge>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {((f.size_bytes ?? 0) / 1024 / 1024).toFixed(2)} MB • {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ar })}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => download(f.storage_path, f.file_name)}><Download className="h-4 w-4" /></Button>
            {canUpload && <Button size="icon" variant="ghost" onClick={() => remove(f.id, f.storage_path)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReferencesPanel({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const { data: refs } = useQuery({
    queryKey: ["task-refs", taskId],
    queryFn: async () => (await supabase.from("task_references").select("*").eq("task_id", taskId).order("created_at")).data ?? [],
  });
  async function add() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!isSafeHttpUrl(trimmed)) {
      toast.error("يجب أن يبدأ الرابط بـ https:// أو http://");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("task_references").insert({
      task_id: taskId, label: label || null, url: trimmed, created_by: u.user?.id,
    } as never);
    setLabel(""); setUrl("");
    qc.invalidateQueries({ queryKey: ["task-refs", taskId] });
  }
  async function remove(id: string) {
    await supabase.from("task_references").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-refs", taskId] });
  }
  return (
    <Card className="p-4 space-y-3">
      <ul className="space-y-1.5">
        {(refs ?? []).length === 0 && <li className="text-sm text-muted-foreground text-center py-6">لا توجد روابط</li>}
        {(refs ?? []).map((r) => (
          <li key={r.id} className="flex items-center gap-2 p-2.5 rounded-md border hover:bg-muted/30">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{r.label || r.url}</div>
              <a
                href={isSafeHttpUrl(r.url) ? r.url : "#"}
                target="_blank"
                rel="noreferrer noopener"
                dir="ltr"
                className="text-xs text-primary hover:underline truncate block"
                onClick={(e) => { if (!isSafeHttpUrl(r.url)) e.preventDefault(); }}
              >
                {r.url}
              </a>
            </div>
            {canEdit && <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 pt-2 border-t">
          <Input placeholder="اسم" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input dir="ltr" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={add} disabled={!url.trim()}>إضافة</Button>
        </div>
      )}
    </Card>
  );
}

function CommentsPanel({ taskId, uid }: { taskId: string; uid: string | null }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { data: comments } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_comments")
        .select("*").eq("task_id", taskId).order("created_at");
      if (error) { console.error("comments-load", error); return []; }
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean) as string[]));
      let map: Record<string, { display_name: string | null; email: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("id, display_name, email").in("id", ids);
        map = Object.fromEntries((profs ?? []).map((p) => [p.id, { display_name: p.display_name, email: p.email ?? null }]));
      }
      return rows.map((r) => ({ ...r, author: r.author_id ? map[r.author_id] ?? null : null }));
    },
  });
  async function post(notifyAdmins = false) {
    if (!body.trim() || !uid) return;
    setSending(true);
    try {
      const text = body.trim();
      const finalBody = notifyAdmins ? `📣 للأدمن: ${text}` : text;
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId, author_id: uid, body: finalBody,
      } as never);
      if (error) throw error;
      if (notifyAdmins) {
        const { data: admins } = await supabase
          .from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
        const { data: me } = await supabase.from("profiles").select("display_name, email").eq("id", uid).maybeSingle();
        const fromName = me?.display_name ?? me?.email ?? "موظف";
        const rows = (admins ?? [])
          .filter((a) => a.user_id !== uid)
          .map((a) => ({
            user_id: a.user_id,
            title: `ملاحظة من ${fromName}`,
            body: text.slice(0, 200),
            task_id: taskId,
            kind: "comment_to_admin",
            link: `/production/task/${taskId}`,
          }));
        if (rows.length) await supabase.from("notifications").insert(rows as never);
        toast.success("تم إرسال الملاحظة للأدمن");
      } else {
        toast.success("تم إرسال التعليق");
      }
      setBody("");
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإرسال");
    } finally {
      setSending(false);
    }
  }
  return (
    <Card className="p-4 space-y-3">
      <ul className="space-y-3">
        {(comments ?? []).length === 0 && <li className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2"><MessageCircle className="h-6 w-6 opacity-50" /> لا توجد تعليقات</li>}
        {(comments ?? []).map((c) => {
          const author = (c as unknown as { author?: { display_name: string | null; email: string } }).author;
          const name = author?.display_name ?? author?.email ?? "مستخدم";
          return (
            <li key={c.id} className="flex gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
                {name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ar })}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-0.5">{c.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="space-y-2 pt-3 border-t">
        <Textarea rows={2} placeholder="اكتب تعليق..." value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex justify-end gap-2 flex-wrap">
          <Button variant="outline" onClick={() => post(true)} disabled={!body.trim() || !uid || sending}>
            <AtSign className="h-3.5 w-3.5 ml-1" /> إرسال للأدمن
          </Button>
          <Button onClick={() => post(false)} disabled={!body.trim() || !uid || sending}>
            <Send className="h-3.5 w-3.5 ml-1" /> إرسال
          </Button>
        </div>
      </div>
    </Card>
  );
}

function HistoryPanel({ taskId }: { taskId: string }) {
  const { data: history } = useQuery({
    queryKey: ["task-history", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_status_history")
        .select("*").eq("task_id", taskId).order("created_at", { ascending: false });
      if (error) { console.error("history-load", error); return []; }
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.changed_by).filter(Boolean) as string[]));
      let map: Record<string, { display_name: string | null; email: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("id, display_name, email").in("id", ids);
        map = Object.fromEntries((profs ?? []).map((p) => [p.id, { display_name: p.display_name, email: p.email ?? null }]));
      }
      return rows.map((r) => ({ ...r, by: r.changed_by ? map[r.changed_by] ?? null : null }));
    },
  });
  const items = history ?? [];
  return (
    <Card className="p-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2"><HistoryIcon className="h-6 w-6 opacity-50" /> لا توجد تحديثات</p>
      ) : (
        <ol className="space-y-3 relative border-r-2 border-muted pr-4">
          {items.map((h) => {
            const by = (h as unknown as { by?: { display_name: string | null; email: string } }).by;
            const name = by?.display_name ?? by?.email ?? "—";
            return (
              <li key={h.id} className="relative">
                <span className="absolute -right-[1.4rem] top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <Badge variant="outline" className="text-[10px]">{STATUS_AR[h.from_status ?? ""] ?? h.from_status ?? "—"}</Badge>
                  <span className="text-muted-foreground">←</span>
                  <Badge className={`text-[10px] ${STATUS_TONE[h.to_status ?? ""] ?? ""}`}>{STATUS_AR[h.to_status ?? ""] ?? h.to_status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {name} • {format(new Date(h.created_at), "yyyy/MM/dd HH:mm")}
                </div>
                {h.notes && <p className="text-sm mt-1 bg-muted/50 rounded px-2 py-1">{h.notes}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}