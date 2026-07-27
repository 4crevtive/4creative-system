import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { TaskCard, type ProdTask } from "@/components/production/task-card";
import { useAllowedAreas } from "@/lib/use-allowed-areas";
import { taskCreateSchema, validateForm } from "@/lib/validation";

type AdminTask = ProdTask & {
  assignee_id?: string | null;
  assignee?: { display_name: string | null; email?: string | null };
};

export const Route = createFileRoute("/_authenticated/production/admin")({
  head: () => ({ meta: [{ title: "إدارة التاسكات — 4Creative" }] }),
  component: AdminTasksPage,
});

function AdminTasksPage() {
  const qc = useQueryClient();
  const allowed = useAllowedAreas();
  const navigate = useNavigate();
  const [tab, setTab] = useState("approvals");

  useEffect(() => {
    if (!allowed.isLoading && !allowed.isAdmin) {
      toast.error("هذه الصفحة للإدارة فقط");
      navigate({ to: "/production", replace: true });
    }
  }, [allowed, navigate]);

  const { data: submitted } = useQuery({
    queryKey: ["admin-submitted"],
    queryFn: async () => (await supabase.from("tasks")
      .select("*, contact:contacts(full_name)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })).data as unknown as ProdTask[] ?? [],
  });

  const { data: active } = useQuery({
    queryKey: ["admin-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks")
        .select("*, contact:contacts(full_name)")
        .in("status", ["pending", "accepted", "started", "shooting_started", "shooting_done", "uploaded", "progress_50", "in_review"])
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) {
        toast.error(error.message);
        return [];
      }

      const tasks = (data ?? []) as unknown as AdminTask[];
      const assigneeIds = Array.from(new Set(tasks.map((task) => task.assignee_id).filter(Boolean))) as string[];
      if (assigneeIds.length === 0) return tasks;

      const { data: profiles } = await supabase.from("profiles")
        .select("id, display_name, email")
        .in("id", assigneeIds);
      const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      return tasks.map((task) => ({
        ...task,
        assignee: task.assignee_id ? profilesById.get(task.assignee_id) : undefined,
      }));
    },
  });

  if (!allowed.isAdmin) return null;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة التاسكات</h1>
          <p className="text-muted-foreground mt-1">إنشاء التاسكات واعتماد التسليمات</p>
        </div>
        <NewTaskDialog onCreated={() => {
          setTab("active");
          qc.invalidateQueries({ queryKey: ["admin-active"] });
        }} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="approvals">بانتظار الاعتماد ({(submitted ?? []).length})</TabsTrigger>
          <TabsTrigger value="active">قيد التنفيذ ({(active ?? []).length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "approvals" ? (
        (submitted ?? []).length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">لا توجد تسليمات بانتظار الاعتماد</Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {submitted!.map((t) => (
              <TaskCard key={t.id} task={t} adminMode
                onChanged={() => qc.invalidateQueries({ queryKey: ["admin-submitted"] })} />
            ))}
          </div>
        )
      ) : (
        (active ?? []).length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">لا توجد تاسكات نشطة</Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {active!.map((t) => (
              <div key={t.id} className="space-y-1">
                <div className="text-xs text-muted-foreground mr-1">المسند إليه: {t.assignee?.display_name ?? t.assignee?.email ?? "غير محدد"}</div>
                <TaskCard task={t} adminMode
                  onChanged={() => qc.invalidateQueries({ queryKey: ["admin-active"] })} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function NewTaskDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = {
    title: "", description: "", type: "editing" as ProdTask["type"],
    assignee_id: "", contact_id: "", priority: "3",
    due_at: "", video_duration_pre_seconds: "", video_duration_post_seconds: "",
    client_name: "", project_name: "", video_type: "", aspect_ratio: "",
    resolution: "", platform: "", delivery_method: "", required_output: "",
    estimated_minutes: "", shooting_room_id: "", shooting_location: "", shooting_external_address: "", shooting_notes: "",
    shooting_starts_at: "", shooting_ends_at: "", end_equals_delivery: true,
  };
  const [form, setForm] = useState(emptyForm);
  const [internalNotes, setInternalNotes] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [refs, setRefs] = useState<{ label: string; url: string }[]>([]);
  const [newRef, setNewRef] = useState({ label: "", url: "" });

  const { data: users } = useQuery({
    queryKey: ["prod-staff-all"],
    enabled: open,
    queryFn: async () => {
      // كل الموظفين والإدارة متاحون للإسناد (خصوصاً لتاسكات التصوير).
      const { data } = await supabase.from("profiles")
        .select("id, display_name, email")
        .order("display_name");
      return data ?? [];
    },
  });

  // من الذي لديه تاسك آخر في نفس الفترة الزمنية (±60 دقيقة من موعد التسليم)؟
  const { data: busyIds } = useQuery({
    queryKey: ["busy-assignees", form.due_at],
    enabled: open && !!form.due_at,
    queryFn: async () => {
      const t = new Date(form.due_at).getTime();
      if (Number.isNaN(t)) return new Set<string>();
      const from = new Date(t - 60 * 60 * 1000).toISOString();
      const to = new Date(t + 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from("tasks")
        .select("assignee_id, due_at, status")
        .not("status", "in", "(approved,rejected,archived,completed)")
        .gte("due_at", from)
        .lte("due_at", to);
      return new Set((data ?? []).map((r) => r.assignee_id).filter(Boolean) as string[]);
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ["rooms-lite-prod"],
    enabled: open && form.type === "shooting",
    queryFn: async () => (await supabase.from("rooms").select("id, name_ar, name_en, code").order("code")).data ?? [],
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-lite-prod"],
    enabled: open,
    queryFn: async () => (await supabase.from("contacts").select("id, full_name").order("full_name")).data ?? [],
  });

  async function hasAssigneeConflict() {
    if (!form.assignee_id || !form.due_at) return false;
    const t = new Date(form.due_at).getTime();
    if (Number.isNaN(t)) return false;
    const from = new Date(t - 60 * 60 * 1000).toISOString();
    const to = new Date(t + 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("tasks")
      .select("id, title")
      .eq("assignee_id", form.assignee_id)
      .not("status", "in", "(approved,rejected,archived,completed)")
      .gte("due_at", from)
      .lte("due_at", to)
      .limit(1);
    if (error) {
      toast.error(error.message);
      return true;
    }
    if ((data ?? []).length > 0) {
      toast.error(`هذا الموظف مشغول في نفس الموعد: ${data![0].title}`);
      return true;
    }
    return false;
  }

  async function save() {
    const v = validateForm(taskCreateSchema, {
      title: form.title,
      description: form.description,
      type: form.type,
      assignees: form.assignee_id ? [form.assignee_id] : [],
      contact_id: form.contact_id,
      priority: form.priority,
      due_at: form.due_at,
      video_duration_pre_seconds: form.video_duration_pre_seconds,
      video_duration_post_seconds: form.video_duration_post_seconds,
      estimated_minutes: form.estimated_minutes,
      client_name: form.client_name,
      project_name: form.project_name,
      video_type: form.video_type,
      aspect_ratio: form.aspect_ratio,
      resolution: form.resolution,
      platform: form.platform,
      delivery_method: form.delivery_method,
      required_output: form.required_output,
      internal_notes: internalNotes,
    });
    if (!v.ok) return;
    if (!form.due_at) { toast.error("موعد التسليم إلزامي حتى يتم التحقق من تعارض الموظف"); return; }
    if (form.type === "shooting" && !form.shooting_location) { toast.error("حدد مكان التصوير"); return; }
    if (form.type === "shooting" && ["inside", "both"].includes(form.shooting_location) && !form.shooting_room_id) { toast.error("حدد غرفة التصوير"); return; }
    if (form.type === "shooting") {
      if (!form.shooting_starts_at) { toast.error("حدد موعد بدء التصوير"); return; }
      if (!form.end_equals_delivery && !form.shooting_ends_at) { toast.error("حدد موعد انتهاء التصوير"); return; }
    }
    if (form.due_at && busyIds?.has(form.assignee_id)) {
      toast.error("هذا الموظف مشغول بتاسك آخر في نفس الموعد (±60 دقيقة)");
      return;
    }
    if (await hasAssigneeConflict()) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      title: form.title, description: form.description || null,
      type: form.type, assignee_id: form.assignee_id,
      contact_id: form.contact_id || null,
      priority: Number(form.priority),
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      video_duration_pre_seconds: form.video_duration_pre_seconds ? Number(form.video_duration_pre_seconds) : null,
      video_duration_post_seconds: form.video_duration_post_seconds ? Number(form.video_duration_post_seconds) : null,
      status: "pending", created_by: u.user?.id,
      client_name: form.client_name || null,
      project_name: form.project_name || null,
      video_type: form.video_type || null,
      aspect_ratio: form.aspect_ratio || null,
      resolution: form.resolution || null,
      platform: form.platform || null,
      delivery_method: form.delivery_method || null,
      required_output: form.required_output || null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      shooting_room_id: form.type === "shooting" ? form.shooting_room_id || null : null,
      shooting_location: form.type === "shooting" ? form.shooting_location || null : null,
      shooting_external_address: form.type === "shooting" ? form.shooting_external_address || null : null,
      shooting_notes: form.type === "shooting" ? form.shooting_notes || null : null,
      shooting_starts_at: form.type === "shooting" && form.shooting_starts_at ? new Date(form.shooting_starts_at).toISOString() : null,
      shooting_ends_at: form.type === "shooting"
        ? (form.end_equals_delivery
            ? (form.due_at ? new Date(form.due_at).toISOString() : null)
            : (form.shooting_ends_at ? new Date(form.shooting_ends_at).toISOString() : null))
        : null,
    };
    const { data: inserted, error } = await supabase.from("tasks").insert(payload as never).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const taskId = (inserted as { id: string }).id;
    if (internalNotes.trim()) {
      await supabase.from("task_internal_notes").insert({ task_id: taskId, notes: internalNotes.trim(), updated_by: u.user?.id } as never);
    }
    if (checklist.length > 0) {
      await supabase.from("task_checklist_items").insert(
        checklist.map((title, i) => ({ task_id: taskId, title, position: i, created_by: u.user?.id })) as never,
      );
    }
    if (refs.length > 0) {
      await supabase.from("task_references").insert(
        refs.map((r) => ({ task_id: taskId, label: r.label || null, url: r.url, created_by: u.user?.id })) as never,
      );
    }
    toast.success("تم إنشاء التاسك");
    setOpen(false);
    setForm(emptyForm); setInternalNotes(""); setChecklist([]); setRefs([]);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" /> تاسك جديد</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>إنشاء تاسك جديد</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-xs font-semibold text-muted-foreground border-b pb-1">الأساسيات</div>
          <div className="space-y-1.5"><Label>العنوان *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>الوصف</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ProdTask["type"], assignee_id: "", shooting_room_id: "", shooting_location: "", shooting_external_address: "", shooting_notes: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shooting">تصوير</SelectItem>
                  <SelectItem value="editing">مونتاج</SelectItem>
                  <SelectItem value="design">ديزاين</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">عاجل جداً</SelectItem>
                  <SelectItem value="2">عاجل</SelectItem>
                  <SelectItem value="3">عادي</SelectItem>
                  <SelectItem value="4">منخفض</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>المسند إليه *</Label>
            <Select value={form.assignee_id} onValueChange={(v) => setForm({ ...form, assignee_id: v })}>
              <SelectTrigger><SelectValue placeholder={(users ?? []).length === 0 ? "لا يوجد موظفون بهذا الدور" : "اختر موظف"} /></SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => {
                  const busy = busyIds?.has(u.id);
                  return (
                    <SelectItem key={u.id} value={u.id} disabled={busy}>
                      {(u.display_name || u.email) + (busy ? " — مشغول في هذا الموعد" : "")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">جميع الموظفين والإدارة متاحون. الموظف المشغول في نفس الموعد يظهر معطلاً.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>العميل من قاعدة البيانات</Label>
              <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                <SelectTrigger><SelectValue placeholder="بدون عميل" /></SelectTrigger>
                <SelectContent>
                  {(contacts ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>اسم العميل (نص حر)</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>اسم المشروع</Label><Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>موعد التسليم *</Label>
              <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value, assignee_id: "" })} />
              {form.type === "shooting" && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={form.end_equals_delivery}
                    onChange={(e) => setForm({ ...form, end_equals_delivery: e.target.checked })}
                  />
                  موعد انتهاء التصوير = موعد التسليم
                </label>
              )}
            </div>
          </div>

          {form.type === "shooting" && (
            <>
              <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">تفاصيل التصوير</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>مكان التصوير *</Label>
                  <Select value={form.shooting_location} onValueChange={(v) => setForm({ ...form, shooting_location: v, shooting_room_id: v === "outside" ? "" : form.shooting_room_id })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inside">داخل المكان</SelectItem>
                      <SelectItem value="outside">خارج المكان</SelectItem>
                      <SelectItem value="both">داخل وخارج المكان</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {["inside", "both"].includes(form.shooting_location) && (
                  <div className="space-y-1.5">
                    <Label>غرفة التصوير *</Label>
                    <Select value={form.shooting_room_id} onValueChange={(v) => setForm({ ...form, shooting_room_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر الغرفة" /></SelectTrigger>
                      <SelectContent>
                        {(rooms ?? []).map((room) => <SelectItem key={room.id} value={room.id}>{room.name_ar || room.name_en}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {["outside", "both"].includes(form.shooting_location) && (
                  <div className="space-y-1.5 col-span-2">
                    <Label>عنوان التصوير الخارجي</Label>
                    <Input value={form.shooting_external_address} onChange={(e) => setForm({ ...form, shooting_external_address: e.target.value })} />
                  </div>
                )}
                <div className="space-y-1.5 col-span-2">
                  <Label>ملاحظات التصوير</Label>
                  <Textarea rows={2} placeholder="معدات، زاوية التصوير، عدد المشاهد..." value={form.shooting_notes} onChange={(e) => setForm({ ...form, shooting_notes: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>موعد بدء التصوير *</Label>
                  <Input type="datetime-local" value={form.shooting_starts_at} onChange={(e) => setForm({ ...form, shooting_starts_at: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>موعد انتهاء التصوير *</Label>
                  <Input
                    type="datetime-local"
                    disabled={form.end_equals_delivery}
                    value={form.end_equals_delivery ? form.due_at : form.shooting_ends_at}
                    onChange={(e) => setForm({ ...form, shooting_ends_at: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {form.type !== "shooting" && (
            <>
              <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">تفاصيل الفيديو</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>نوع الفيديو</Label>
                  <Select value={form.video_type} onValueChange={(v) => setForm({ ...form, video_type: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reel">ريلز</SelectItem>
                      <SelectItem value="short">شورت</SelectItem>
                      <SelectItem value="ad">إعلان</SelectItem>
                      <SelectItem value="podcast">بودكاست</SelectItem>
                      <SelectItem value="course">كورس</SelectItem>
                      <SelectItem value="documentary">وثائقي</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الأبعاد</Label>
                  <Select value={form.aspect_ratio} onValueChange={(v) => setForm({ ...form, aspect_ratio: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:16">9:16 (عمودي)</SelectItem>
                      <SelectItem value="16:9">16:9 (أفقي)</SelectItem>
                      <SelectItem value="1:1">1:1 (مربع)</SelectItem>
                      <SelectItem value="4:5">4:5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الدقة</Label>
                  <Select value={form.resolution} onValueChange={(v) => setForm({ ...form, resolution: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1080p">1080p</SelectItem>
                      <SelectItem value="2k">2K</SelectItem>
                      <SelectItem value="4k">4K</SelectItem>
                      <SelectItem value="8k">8K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>المنصة</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">إنستجرام</SelectItem>
                      <SelectItem value="tiktok">تيك توك</SelectItem>
                      <SelectItem value="youtube">يوتيوب</SelectItem>
                      <SelectItem value="facebook">فيسبوك</SelectItem>
                      <SelectItem value="linkedin">لينكد إن</SelectItem>
                      <SelectItem value="multi">متعدد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>مدة الفيديو الأصلية (ثانية)</Label><Input type="number" dir="ltr" value={form.video_duration_pre_seconds} onChange={(e) => setForm({ ...form, video_duration_pre_seconds: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>المدة بعد المونتاج (ثانية)</Label><Input type="number" dir="ltr" value={form.video_duration_post_seconds} onChange={(e) => setForm({ ...form, video_duration_post_seconds: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>طريقة التسليم</Label><Input placeholder="Drive / WeTransfer / Frame.io" value={form.delivery_method} onChange={(e) => setForm({ ...form, delivery_method: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>المطلوب تسليمه</Label><Input placeholder="مثال: 3 نسخ + ثامبنيل" value={form.required_output} onChange={(e) => setForm({ ...form, required_output: e.target.value })} /></div>
              </div>
            </>
          )}

          <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">قائمة المهام (Checklist)</div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input placeholder="أضف بند للتشيك ليست..." value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newItem.trim()) { setChecklist([...checklist, newItem.trim()]); setNewItem(""); e.preventDefault(); } }} />
              <Button type="button" variant="outline" onClick={() => { if (newItem.trim()) { setChecklist([...checklist, newItem.trim()]); setNewItem(""); } }}>إضافة</Button>
            </div>
            {checklist.length > 0 && (
              <ul className="space-y-1 text-sm">
                {checklist.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{it}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setChecklist(checklist.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">روابط مرجعية</div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <Input placeholder="اسم الرابط" value={newRef.label} onChange={(e) => setNewRef({ ...newRef, label: e.target.value })} />
              <Input dir="ltr" placeholder="https://..." value={newRef.url} onChange={(e) => setNewRef({ ...newRef, url: e.target.value })} />
              <Button type="button" variant="outline" onClick={() => {
                const u = newRef.url.trim();
                if (!u) return;
                if (!/^https?:\/\//i.test(u)) { toast.error("يجب أن يبدأ الرابط بـ https:// أو http://"); return; }
                setRefs([...refs, { label: newRef.label, url: u }]);
                setNewRef({ label: "", url: "" });
              }}>إضافة</Button>
            </div>
            {refs.length > 0 && (
              <ul className="space-y-1 text-sm">
                {refs.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
                    <span className="flex-1 truncate">{r.label || r.url}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRefs(refs.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">ملاحظات داخلية</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>الوقت المقدر (دقيقة)</Label><Input type="number" dir="ltr" value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="invisible">.</Label><div /></div>
          </div>
          <div className="space-y-1.5"><Label>ملاحظات داخلية (لا تظهر للعميل)</Label><Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "إنشاء"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}