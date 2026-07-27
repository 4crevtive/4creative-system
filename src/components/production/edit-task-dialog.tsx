import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

type EditableTask = {
  id: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  priority?: number | null;
  due_at?: string | null;
  started_at?: string | null;
  assignee_id?: string | null;
  freelancer_id?: string | null;
  contact_id?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  video_type?: string | null;
  aspect_ratio?: string | null;
  resolution?: string | null;
  platform?: string | null;
  delivery_method?: string | null;
  required_output?: string | null;
  estimated_minutes?: number | null;
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  trigger,
}: {
  task: EditableTask;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setInternalOpen(v));

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: task.title ?? "",
    description: task.description ?? "",
    type: (task.type ?? "editing") as string,
    priority: String(task.priority ?? 3),
    due_at: toLocalInput(task.due_at),
    started_at: toLocalInput(task.started_at),
    assignee_id: task.assignee_id ?? "__none__",
    freelancer_id: task.freelancer_id ?? "__none__",
    contact_id: task.contact_id ?? "__none__",
    client_name: task.client_name ?? "",
    project_name: task.project_name ?? "",
    video_type: task.video_type ?? "",
    aspect_ratio: task.aspect_ratio ?? "",
    resolution: task.resolution ?? "",
    platform: task.platform ?? "",
    delivery_method: task.delivery_method ?? "",
    required_output: task.required_output ?? "",
    estimated_minutes: task.estimated_minutes ? String(task.estimated_minutes) : "",
  });

  // Re-seed when a different task is opened.
  useEffect(() => {
    if (!isOpen) return;
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      type: (task.type ?? "editing") as string,
      priority: String(task.priority ?? 3),
      due_at: toLocalInput(task.due_at),
      started_at: toLocalInput(task.started_at),
      assignee_id: task.assignee_id ?? "__none__",
      freelancer_id: task.freelancer_id ?? "__none__",
      contact_id: task.contact_id ?? "__none__",
      client_name: task.client_name ?? "",
      project_name: task.project_name ?? "",
      video_type: task.video_type ?? "",
      aspect_ratio: task.aspect_ratio ?? "",
      resolution: task.resolution ?? "",
      platform: task.platform ?? "",
      delivery_method: task.delivery_method ?? "",
      required_output: task.required_output ?? "",
      estimated_minutes: task.estimated_minutes ? String(task.estimated_minutes) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task.id]);

  const { data: users } = useQuery({
    queryKey: ["edit-task-users"],
    enabled: isOpen,
    queryFn: async () => (await supabase.from("profiles").select("id, display_name, email").order("display_name")).data ?? [],
  });
  const { data: freelancers } = useQuery({
    queryKey: ["edit-task-freelancers"],
    enabled: isOpen,
    queryFn: async () =>
      (await supabase.from("freelancers").select("id, full_name").eq("is_active", true).order("full_name")).data ?? [],
  });
  const { data: contacts } = useQuery({
    queryKey: ["edit-task-contacts"],
    enabled: isOpen,
    queryFn: async () => (await supabase.from("contacts").select("id, full_name").order("full_name")).data ?? [],
  });

  async function save() {
    if (!form.title.trim()) { toast.error("العنوان مطلوب"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      priority: Number(form.priority),
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      started_at: form.started_at ? new Date(form.started_at).toISOString() : null,
      assignee_id: form.assignee_id === "__none__" ? null : form.assignee_id,
      freelancer_id: form.freelancer_id === "__none__" ? null : form.freelancer_id,
      contact_id: form.contact_id === "__none__" ? null : form.contact_id,
      client_name: form.client_name.trim() || null,
      project_name: form.project_name.trim() || null,
      video_type: form.video_type.trim() || null,
      aspect_ratio: form.aspect_ratio.trim() || null,
      resolution: form.resolution.trim() || null,
      platform: form.platform.trim() || null,
      delivery_method: form.delivery_method.trim() || null,
      required_output: form.required_output.trim() || null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
    };
    const { error } = await supabase.from("tasks").update(payload as never).eq("id", task.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ التعديلات");
    qc.invalidateQueries({ queryKey: ["task-detail", task.id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    qc.invalidateQueries({ queryKey: ["project-tasks"] });
    setOpen(false);
  }

  const isVideoType = form.type === "editing" || form.type === "design";

  return (
    <>
      {trigger !== undefined && !isControlled && (
        <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
      )}
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> تعديل التاسك
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs font-semibold text-muted-foreground border-b pb-1">الأساسيات</div>
            <div className="space-y-1.5">
              <Label>العنوان *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>الوصف</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shooting">تصوير</SelectItem>
                    <SelectItem value="editing">مونتاج</SelectItem>
                    <SelectItem value="design">ديزاين</SelectItem>
                    <SelectItem value="programming">برمجة</SelectItem>
                    <SelectItem value="marketing">ماركتنج</SelectItem>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>تاريخ البدء</Label>
                <Input type="datetime-local" value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>موعد التسليم</Label>
                <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
              </div>
            </div>

            <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">المسؤولون</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الموظف المسؤول</Label>
                <Select value={form.assignee_id} onValueChange={(v) => setForm({ ...form, assignee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر موظف" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">بدون</SelectItem>
                    {(users ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الفريلانسر</Label>
                <Select value={form.freelancer_id} onValueChange={(v) => setForm({ ...form, freelancer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="بدون فريلانسر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">بدون</SelectItem>
                    {(freelancers ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>العميل</Label>
                <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                  <SelectTrigger><SelectValue placeholder="بدون عميل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">بدون</SelectItem>
                    {(contacts ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">تفاصيل المشروع</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>اسم العميل (نص)</Label>
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>اسم المشروع</Label>
                <Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>الوقت المقدر (دقيقة)</Label>
                <Input type="number" min={0} value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>المنصة</Label>
                <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Instagram / YouTube / ..." />
              </div>
            </div>

            {isVideoType && (
              <>
                <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">
                  {form.type === "design" ? "تفاصيل التصميم" : "تفاصيل الفيديو"}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>نوع الفيديو / التصميم</Label>
                    <Input value={form.video_type} onChange={(e) => setForm({ ...form, video_type: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الأبعاد</Label>
                    <Input value={form.aspect_ratio} onChange={(e) => setForm({ ...form, aspect_ratio: e.target.value })} placeholder="16:9 / 9:16 / 1:1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الدقة</Label>
                    <Input value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} placeholder="1080p / 4K" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>طريقة التسليم</Label>
                    <Input value={form.delivery_method} onChange={(e) => setForm({ ...form, delivery_method: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>المطلوب</Label>
                    <Textarea rows={2} value={form.required_output} onChange={(e) => setForm({ ...form, required_output: e.target.value })} />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}