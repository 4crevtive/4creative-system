import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { ProdTask } from "@/components/production/task-card";
import { taskCreateSchema, validateForm } from "@/lib/validation";

// Map production task type → freelancer specialty
const SPECIALTY_BY_TASK_TYPE: Record<string, string> = {
  editing: "montage",
  design: "design",
  shooting: "photography",
  programming: "programming",
  marketing: "ads",
};

const TYPE_LABELS: Record<string, string> = {
  shooting: "تصوير", editing: "مونتاج", design: "ديزاين", programming: "برمجة", marketing: "ماركتنج",
};

export function NewTaskDialog({
  onCreated,
  defaultType = "editing",
  lockedType = false,
  triggerLabel = "تاسك جديد",
  assignPool = "role",
  preselectSelf = false,
}: {
  onCreated: () => void;
  defaultType?: ProdTask["type"];
  lockedType?: boolean;
  triggerLabel?: string;
  /** "role" = filter by task type role/dept (default). "all" = any staff member (for admin personal tasks). */
  assignPool?: "role" | "all";
  /** Preselect the current user as the primary assignee. */
  preselectSelf?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  function nowLocalIso() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  const emptyForm = {
    title: "", description: "", type: defaultType as ProdTask["type"],
    contact_id: "", priority: "3",
    due_at: nowLocalIso(), started_at: "",
    video_duration_pre_seconds: "", video_duration_post_seconds: "",
    client_name: "", project_name: "", video_type: "", aspect_ratio: "",
    resolution: "", platform: "", delivery_method: "", required_output: "",
    estimated_minutes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [internalNotes, setInternalNotes] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [freelancerAssignees, setFreelancerAssignees] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [refs, setRefs] = useState<{ label: string; url: string }[]>([]);
  const [newRef, setNewRef] = useState({ label: "", url: "" });

  useEffect(() => {
    if (!open || !preselectSelf) return;
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (uid) setAssignees((prev) => (prev.length === 0 ? [uid] : prev));
    });
  }, [open, preselectSelf]);

  const { data: users } = useQuery({
    queryKey: ["task-staff", form.type, assignPool],
    enabled: open,
    queryFn: async () => {
      if (assignPool === "all" || form.type === "shooting") {
        const { data: all } = await supabase.from("profiles").select("id, display_name, email").order("display_name");
        return all ?? [];
      }
      const roleByType: Record<string, string> = { editing: "editor", design: "designer", shooting: "photographer" };
      const deptByType: Record<string, string> = { programming: "programming", marketing: "marketing" };
      const role = roleByType[form.type];
      const dept = deptByType[form.type];
      let ids: string[] = [];
      if (role) {
        const { data: ur } = await supabase.from("user_roles").select("user_id").eq("role", role as never);
        ids = (ur ?? []).map((r) => r.user_id);
      } else if (dept) {
        const { data: d } = await supabase.from("departments").select("id").eq("code", dept as never).maybeSingle();
        if (d?.id) {
          const { data: dm } = await supabase.from("department_members").select("user_id").eq("department_id", d.id);
          ids = (dm ?? []).map((m) => m.user_id);
        }
        // Fallback: if department empty, allow all staff (non-reception)
        if (ids.length === 0) {
          const { data: all } = await supabase.from("profiles").select("id, display_name, email").order("display_name");
          return all ?? [];
        }
      }
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, display_name, email").in("id", ids).order("display_name");
      return data ?? [];
    },
  });

  const { data: freelancers } = useQuery({
    queryKey: ["task-freelancers", form.type],
    enabled: open,
    queryFn: async () => {
      const specialty = SPECIALTY_BY_TASK_TYPE[form.type];
      let q = supabase.from("freelancers").select("id, full_name, specialty, scope").eq("is_active", true).order("full_name");
      if (specialty) q = q.or(`specialty.eq.${specialty},specialty.eq.other`);
      return (await q).data ?? [];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-lite-newtask"],
    enabled: open,
    queryFn: async () => (await supabase.from("contacts").select("id, full_name").order("full_name")).data ?? [],
  });

  async function save() {
    const totalAssignees = assignees.length + freelancerAssignees.length;
    const v = validateForm(taskCreateSchema, {
      title: form.title,
      description: form.description,
      type: form.type,
      // schema requires at least one — pass a placeholder uuid when only freelancers are chosen
      assignees: totalAssignees > 0 && assignees.length === 0
        ? ["00000000-0000-0000-0000-000000000000"]
        : assignees,
      contact_id: form.contact_id,
      priority: form.priority,
      due_at: form.due_at,
      started_at: form.started_at,
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
    if (totalAssignees === 0) { toast.error("يجب تعيين موظف أو فريلانسر واحد على الأقل"); return; }
    // Validate references (each must be a valid URL)
    for (const r of refs) {
      try { new URL(r.url); } catch { toast.error("رابط المرجع غير صالح"); return; }
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    // Primary: first staff assignee, else first freelancer
    const primaryUserId = assignees[0] ?? null;
    const primaryFreelancerId = primaryUserId ? null : (freelancerAssignees[0] ?? null);
    const payload = {
      title: form.title, description: form.description || null,
      type: form.type,
      assignee_id: primaryUserId,
      freelancer_id: primaryFreelancerId,
      contact_id: form.contact_id || null,
      priority: Number(form.priority),
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      started_at: form.started_at ? new Date(form.started_at).toISOString() : null,
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
    };
    const { data: inserted, error } = await supabase.from("tasks").insert(payload as never).select("id").single();
    if (error) { setSaving(false); toast.error(error.message); return; }
    const taskId = (inserted as { id: string }).id;
    if (internalNotes.trim()) {
      await supabase.from("task_internal_notes").insert({ task_id: taskId, notes: internalNotes.trim(), updated_by: u.user?.id } as never);
    }
    // Additional assignees stored as watchers so they can access the task
    const extraUsers = primaryUserId ? assignees.slice(1) : assignees;
    const extraFreelancers = primaryFreelancerId ? freelancerAssignees.slice(1) : freelancerAssignees;
    if (extraUsers.length > 0) {
      await supabase.from("task_watchers").insert(
        extraUsers.map((uid) => ({ task_id: taskId, user_id: uid })) as never,
      );
    }
    if (extraFreelancers.length > 0) {
      await supabase.from("task_watchers").insert(
        extraFreelancers.map((fid) => ({ task_id: taskId, freelancer_id: fid })) as never,
      );
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
    setSaving(false);
    toast.success("تم إنشاء التاسك");
    setOpen(false);
    setForm({ ...emptyForm, due_at: nowLocalIso(), type: defaultType });
    setInternalNotes("");
    setChecklist([]); setRefs([]); setAssignees([]); setFreelancerAssignees([]);
    onCreated();
  }

  const isVideoType = form.type === "editing" || form.type === "design";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" /> {triggerLabel}</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>إنشاء تاسك جديد {lockedType ? `— ${TYPE_LABELS[form.type]}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-xs font-semibold text-muted-foreground border-b pb-1">الأساسيات</div>
          <div className="space-y-1.5"><Label>العنوان *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>الوصف</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            {!lockedType && (
              <div className="space-y-1.5">
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => { setForm({ ...form, type: v as ProdTask["type"] }); setAssignees([]); }}>
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
            )}
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
            <Label>المسند إليهم * <span className="text-xs text-muted-foreground">(يمكن اختيار أكثر من موظف)</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start font-normal h-auto min-h-10 py-2">
                  <Users className="h-4 w-4 ml-2 shrink-0" />
                  {assignees.length === 0 && freelancerAssignees.length === 0 ? (
                    <span className="text-muted-foreground">{(users ?? []).length === 0 && (freelancers ?? []).length === 0 ? "لا يوجد موظفون مناسبون" : "اختر موظفين أو فريلانسر"}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {assignees.map((id, i) => {
                        const u = (users ?? []).find((x) => x.id === id);
                        return (
                          <Badge key={id} variant={i === 0 ? "default" : "secondary"}>
                            {u?.display_name || u?.email || "—"}{i === 0 ? " (رئيسي)" : ""}
                          </Badge>
                        );
                      })}
                      {freelancerAssignees.map((id) => {
                        const f = (freelancers ?? []).find((x) => x.id === id);
                        return (
                          <Badge key={id} variant="outline" className="bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300">
                            {f?.full_name || "—"} · فريلانسر
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[320px] p-2 max-h-[280px] overflow-y-auto overscroll-contain"
                dir="rtl"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {(users ?? []).length === 0 && (freelancers ?? []).length === 0 && (
                  <div className="text-sm text-muted-foreground p-2">لا يوجد موظفون أو فريلانسر</div>
                )}
                {(users ?? []).length > 0 && (
                  <div className="text-[10px] font-semibold text-muted-foreground px-2 pt-1 pb-0.5">الموظفون</div>
                )}
                {(users ?? []).map((u) => {
                  const checked = assignees.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          if (c) setAssignees([...assignees, u.id]);
                          else setAssignees(assignees.filter((a) => a !== u.id));
                        }}
                      />
                      <span className="flex-1 text-sm">{u.display_name || u.email}</span>
                    </label>
                  );
                })}
                {(freelancers ?? []).length > 0 && (
                  <>
                    <div className="text-[10px] font-semibold text-muted-foreground px-2 pt-2 pb-0.5 border-t border-border/60 mt-1">الفريلانسرز</div>
                    {(freelancers ?? []).map((f) => {
                      const checked = freelancerAssignees.includes(f.id);
                      return (
                        <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              if (c) setFreelancerAssignees([...freelancerAssignees, f.id]);
                              else setFreelancerAssignees(freelancerAssignees.filter((a) => a !== f.id));
                            }}
                          />
                          <span className="flex-1 text-sm">{f.full_name}</span>
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300">فريلانسر</Badge>
                        </label>
                      );
                    })}
                  </>
                )}
              </PopoverContent>
            </Popover>
            {(assignees.length + freelancerAssignees.length) > 1 && (
              <p className="text-xs text-muted-foreground">أول موظف هو المسؤول الرئيسي، والباقي متابعون.</p>
            )}
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
            <div className="space-y-1.5"><Label>تاريخ البدء</Label><Input type="datetime-local" step={1} value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} /></div>
            <div className="space-y-1.5 col-span-2"><Label>موعد التسليم</Label><Input type="datetime-local" step={1} value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
          </div>

          {isVideoType && (
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
                <div className="space-y-1.5"><Label>المدة الأصلية (ثانية)</Label><Input type="number" dir="ltr" value={form.video_duration_pre_seconds} onChange={(e) => setForm({ ...form, video_duration_pre_seconds: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>المدة بعد المونتاج (ثانية)</Label><Input type="number" dir="ltr" value={form.video_duration_post_seconds} onChange={(e) => setForm({ ...form, video_duration_post_seconds: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>طريقة التسليم</Label><Input placeholder="Drive / WeTransfer" value={form.delivery_method} onChange={(e) => setForm({ ...form, delivery_method: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>المطلوب تسليمه</Label><Input value={form.required_output} onChange={(e) => setForm({ ...form, required_output: e.target.value })} /></div>
              </div>
            </>
          )}

          <div className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">قائمة المهام</div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input placeholder="أضف بند..." value={newItem}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>الوقت المقدر (دقيقة)</Label><Input type="number" dir="ltr" value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>ملاحظات داخلية</Label><Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "إنشاء"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}