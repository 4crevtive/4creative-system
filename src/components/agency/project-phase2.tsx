import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, isSameMonth, startOfWeek, endOfWeek, addDays, differenceInMinutes, formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Flag, Plus, Trash2, Play, Pause, Timer, Calendar as CalendarIcon,
  AlertTriangle, ShieldCheck, ShieldAlert, Shield, ChevronLeft, ChevronRight,
  Clock, Target, CheckCircle2, Circle, MapPin, Edit3,
} from "lucide-react";
import { milestoneSchema, validateForm, zStr } from "@/lib/validation";
import { z } from "zod";

const riskSchema = z.object({
  title: zStr("عنوان الخطر", { min: 2, max: 200 }),
});
const calendarEventSchema = z.object({
  title: zStr("عنوان الحدث", { min: 2, max: 200 }),
  starts_at: z.string().min(1, "حدد وقت البداية"),
});

/* ────────────────────────────────────────────────────────────
   Shared helpers
   ──────────────────────────────────────────────────────────── */

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDur = (mins: number) => {
  if (!mins || mins <= 0) return "0د";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
};

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="font-medium">{title}</div>
      {hint && <div className="text-sm text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   1) MILESTONES
   ──────────────────────────────────────────────────────────── */

const MILESTONE_STATUS = [
  { value: "planned",     label: "مخطط",       tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { value: "in_progress", label: "قيد التنفيذ", tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200" },
  { value: "completed",   label: "مكتمل",      tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200" },
  { value: "delayed",     label: "متأخر",      tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200" },
] as const;

export function MilestonesSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", status: "planned", progress: 0 });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ws_milestones", projectId],
    queryFn: async () => (await supabase.from("project_milestones")
      .select("*").eq("project_id", projectId)
      .order("order_index", { ascending: true })
      .order("due_date", { ascending: true })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const v = validateForm(milestoneSchema, {
        title: form.title,
        description: form.description,
        due_date: form.due_date,
      });
      if (!v.ok) throw new Error(v.message);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("project_milestones").insert({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description || null,
        due_date: form.due_date || null,
        status: form.status,
        progress: Number(form.progress) || 0,
        order_index: items.length,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة المرحلة");
      qc.invalidateQueries({ queryKey: ["ws_milestones", projectId] });
      setOpen(false);
      setForm({ title: "", description: "", due_date: "", status: "planned", progress: 0 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (payload: { id: string; patch: { status?: string; progress?: number; title?: string; description?: string | null; due_date?: string | null } }) => {
      const { error } = await supabase.from("project_milestones").update(payload.patch).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ws_milestones", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["ws_milestones", projectId] });
    },
  });

  const summary = useMemo(() => {
    const total = items.length;
    const done = items.filter((x) => x.status === "completed").length;
    const late = items.filter((x) => x.status === "delayed").length;
    const avg  = total ? Math.round(items.reduce((s, x) => s + (x.progress || 0), 0) / total) : 0;
    return { total, done, late, avg };
  }, [items]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={Flag}         label="إجمالي المراحل" value={String(summary.total)}   tone="indigo" />
        <MiniStat icon={CheckCircle2} label="مكتملة"         value={String(summary.done)}    tone="emerald" />
        <MiniStat icon={AlertTriangle} label="متأخرة"        value={String(summary.late)}    tone="rose" />
        <MiniStat icon={Target}       label="متوسط الإنجاز"  value={`${summary.avg}%`}       tone="amber" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Flag className="h-4 w-4" /> مراحل المشروع</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-lg gap-1"><Plus className="h-4 w-4" /> مرحلة جديدة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader><DialogTitle>إضافة مرحلة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: تسليم المرحلة الأولى" /></div>
              <div><Label>الوصف</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>تاريخ الاستحقاق</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div><Label>الحالة</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MILESTONE_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>نسبة الإنجاز: {form.progress}%</Label>
                <Input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={() => create.mutate()} disabled={!form.title.trim() || create.isPending}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timeline */}
      <Card className="p-4 rounded-2xl">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">جارٍ التحميل…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Flag} title="لا توجد مراحل بعد" hint="ابدأ بإضافة أول مرحلة للمشروع." />
        ) : (
          <ol className="relative border-r-2 border-dashed border-border pr-6 space-y-4">
            {items.map((m) => {
              const st = MILESTONE_STATUS.find((s) => s.value === m.status) ?? MILESTONE_STATUS[0];
              return (
                <li key={m.id} className="relative">
                  <span className={cn("absolute -right-[34px] top-2 h-4 w-4 rounded-full ring-4 ring-background",
                    m.status === "completed" ? "bg-emerald-500" :
                    m.status === "delayed" ? "bg-rose-500" :
                    m.status === "in_progress" ? "bg-sky-500" : "bg-slate-400")} />
                  <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold truncate">{m.title}</div>
                          <Badge variant="outline" className={cn("text-[10px] border-0", st.tone)}>{st.label}</Badge>
                        </div>
                        {m.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> {fmtDate(m.due_date)}</span>
                          <span className="tabular-nums">{m.progress}%</span>
                        </div>
                        <Progress value={m.progress} className="h-1.5 mt-2" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Select value={m.status} onValueChange={(v) => update.mutate({ id: m.id, patch: { status: v, progress: v === "completed" ? 100 : m.progress } })}>
                          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{MILESTONE_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => remove.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   2) RISKS
   ──────────────────────────────────────────────────────────── */

const SEVERITY = [
  { value: "low",      label: "منخفض",  tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",       icon: Shield },
  { value: "medium",   label: "متوسط",  tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",     icon: ShieldAlert },
  { value: "high",     label: "عالي",   tone: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-200", icon: AlertTriangle },
  { value: "critical", label: "حرج",    tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200",         icon: AlertTriangle },
] as const;

const RISK_STATUS = [
  { value: "open",       label: "مفتوح",     tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200" },
  { value: "mitigating", label: "قيد المعالجة", tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200" },
  { value: "resolved",   label: "تم الحل",   tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200" },
] as const;

export function RisksSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", impact: "medium", status: "open", resolution: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ws_risks", projectId],
    queryFn: async () => (await supabase.from("project_risks")
      .select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const v = validateForm(riskSchema, { title: form.title });
      if (!v.ok) throw new Error(v.message);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("project_risks").insert({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description || null,
        severity: form.severity,
        impact: form.impact,
        status: form.status,
        resolution: form.resolution || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الخطر");
      qc.invalidateQueries({ queryKey: ["ws_risks", projectId] });
      setOpen(false);
      setForm({ title: "", description: "", severity: "medium", impact: "medium", status: "open", resolution: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (payload: { id: string; patch: { status?: string; severity?: string; impact?: string; resolution?: string | null } }) => {
      const { error } = await supabase.from("project_risks").update(payload.patch).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ws_risks", projectId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_risks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["ws_risks", projectId] });
    },
  });

  const stats = useMemo(() => ({
    total: items.length,
    open: items.filter((r) => r.status === "open").length,
    critical: items.filter((r) => r.severity === "critical" || r.severity === "high").length,
    resolved: items.filter((r) => r.status === "resolved").length,
  }), [items]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={AlertTriangle} label="إجمالي المخاطر" value={String(stats.total)}    tone="indigo" />
        <MiniStat icon={ShieldAlert}   label="مفتوحة"        value={String(stats.open)}     tone="rose" />
        <MiniStat icon={AlertTriangle} label="عالية/حرجة"    value={String(stats.critical)} tone="amber" />
        <MiniStat icon={ShieldCheck}   label="تم حلها"       value={String(stats.resolved)} tone="emerald" />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> سجل المخاطر والمشاكل</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-lg gap-1"><Plus className="h-4 w-4" /> خطر جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-lg">
            <DialogHeader><DialogTitle>تسجيل خطر</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: تأخر تسليم من العميل" /></div>
              <div><Label>الوصف</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>الخطورة</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITY.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>التأثير</Label>
                  <Select value={form.impact} onValueChange={(v) => setForm({ ...form, impact: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITY.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>الحالة</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RISK_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>خطة الحل / التخفيف</Label><Textarea rows={2} value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={() => create.mutate()} disabled={!form.title.trim() || create.isPending}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">جارٍ التحميل…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="لا توجد مخاطر مسجلة" hint="ابدأ برصد أي خطر أو مشكلة يمكن أن تؤثر على المشروع." />
        ) : (
          <ul className="divide-y">
            {items.map((r) => {
              const sv = SEVERITY.find((s) => s.value === r.severity) ?? SEVERITY[1];
              const st = RISK_STATUS.find((s) => s.value === r.status) ?? RISK_STATUS[0];
              const Icon = sv.icon;
              return (
                <li key={r.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", sv.tone)}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold truncate">{r.title}</div>
                        <Badge variant="outline" className={cn("text-[10px] border-0", sv.tone)}>خطورة: {sv.label}</Badge>
                        <Badge variant="outline" className={cn("text-[10px] border-0", st.tone)}>{st.label}</Badge>
                      </div>
                      {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                      {r.resolution && (
                        <div className="mt-2 rounded-lg bg-muted/50 border border-border/50 p-2 text-xs">
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">الحل: </span>
                          <span className="text-muted-foreground">{r.resolution}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, patch: { status: v } })}>
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{RISK_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   3) TIME TRACKING
   ──────────────────────────────────────────────────────────── */

export function TimeTrackingSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [taskId, setTaskId] = useState<string>("none");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ description: "", started_at: "", ended_at: "", billable: true, task_id: "none" });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: uid } = useQuery({
    queryKey: ["auth_user_id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: activeEntry } = useQuery({
    queryKey: ["ws_time_active", projectId, uid],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("project_time_entries")
      .select("*").eq("project_id", projectId).eq("user_id", uid!).is("ended_at", null)
      .order("started_at", { ascending: false }).limit(1).maybeSingle()).data,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["ws_time_entries", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("project_time_entries")
        .select("*, task:tasks(title)")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false }).limit(50);
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      let profileMap = new Map<string, { display_name: string | null; email: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, email").in("id", ids);
        (profs ?? []).forEach((p) => profileMap.set(p.id, { display_name: p.display_name, email: p.email }));
      }
      return rows.map((r) => ({ ...r, profile: profileMap.get(r.user_id) ?? null }));
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["ws_time_tasks", projectId],
    queryFn: async () => {
      const { data: proj } = await supabase.from("agency_projects").select("name").eq("id", projectId).maybeSingle();
      if (!proj?.name) return [];
      return (await supabase.from("tasks").select("id, title").eq("project_name", proj.name).order("created_at", { ascending: false })).data ?? [];
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("يجب تسجيل الدخول");
      const { error } = await supabase.from("project_time_entries").insert({
        project_id: projectId,
        user_id: uid,
        task_id: taskId === "none" ? null : taskId,
        description: description.trim() || null,
        started_at: new Date().toISOString(),
        billable,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("بدأ التتبع");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["ws_time_active", projectId] });
      qc.invalidateQueries({ queryKey: ["ws_time_entries", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stop = useMutation({
    mutationFn: async () => {
      if (!activeEntry) return;
      const end = new Date();
      const mins = Math.max(1, differenceInMinutes(end, new Date(activeEntry.started_at)));
      const { error } = await supabase.from("project_time_entries").update({
        ended_at: end.toISOString(),
        duration_minutes: mins,
      }).eq("id", activeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إيقاف التتبع");
      qc.invalidateQueries({ queryKey: ["ws_time_active", projectId] });
      qc.invalidateQueries({ queryKey: ["ws_time_entries", projectId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["ws_time_entries", projectId] });
    },
  });

  const addManual = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("يجب تسجيل الدخول");
      if (!manual.started_at || !manual.ended_at) throw new Error("حدد وقت البداية والنهاية");
      const s = new Date(manual.started_at);
      const e = new Date(manual.ended_at);
      const mins = Math.max(1, differenceInMinutes(e, s));
      const { error } = await supabase.from("project_time_entries").insert({
        project_id: projectId,
        user_id: uid,
        task_id: manual.task_id === "none" ? null : manual.task_id,
        description: manual.description || null,
        started_at: s.toISOString(),
        ended_at: e.toISOString(),
        duration_minutes: mins,
        billable: manual.billable,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["ws_time_entries", projectId] });
      setManualOpen(false);
      setManual({ description: "", started_at: "", ended_at: "", billable: true, task_id: "none" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const elapsedSec = activeEntry ? Math.max(0, Math.floor((Date.now() - new Date(activeEntry.started_at).getTime()) / 1000)) : 0;
  void tick;

  const stats = useMemo(() => {
    const total = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
    const billableM = entries.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0);
    const today = entries.filter((e) => isSameDay(new Date(e.started_at), new Date())).reduce((s, e) => s + (e.duration_minutes || 0), 0);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 6 });
    const week = entries.filter((e) => new Date(e.started_at) >= weekStart).reduce((s, e) => s + (e.duration_minutes || 0), 0);
    return { total, billable: billableM, today, week };
  }, [entries]);

  const hh = String(Math.floor(elapsedSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={Clock}  label="اليوم"           value={fmtDur(stats.today)}    tone="indigo" />
        <MiniStat icon={Clock}  label="الأسبوع"         value={fmtDur(stats.week)}     tone="sky" />
        <MiniStat icon={Timer}  label="الإجمالي"        value={fmtDur(stats.total)}    tone="violet" />
        <MiniStat icon={Target} label="ساعات قابلة للفوترة" value={fmtDur(stats.billable)} tone="emerald" />
      </div>

      {/* Timer card */}
      <Card className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 border">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("h-14 w-14 rounded-2xl grid place-items-center", activeEntry ? "bg-emerald-500/10 text-emerald-600 animate-pulse" : "bg-muted text-muted-foreground")}>
              <Timer className="h-6 w-6" />
            </div>
            <div className="tabular-nums text-3xl font-bold">
              {activeEntry ? `${hh}:${mm}:${ss}` : "00:00:00"}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-2 min-w-0">
            <Input placeholder="على أي شغّال دلوقتي؟" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!!activeEntry} className="h-10" />
            <Select value={taskId} onValueChange={setTaskId} disabled={!!activeEntry}>
              <SelectTrigger className="h-10 w-[160px]"><SelectValue placeholder="مهمة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون مهمة</SelectItem>
                {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs">
              <Switch checked={billable} onCheckedChange={setBillable} disabled={!!activeEntry} />
              <span>قابل للفوترة</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeEntry ? (
              <Button onClick={() => stop.mutate()} disabled={stop.isPending} size="lg" className="rounded-xl bg-rose-600 hover:bg-rose-700 gap-2"><Pause className="h-4 w-4" /> إيقاف</Button>
            ) : (
              <Button onClick={() => start.mutate()} disabled={start.isPending} size="lg" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-2"><Play className="h-4 w-4" /> ابدأ</Button>
            )}
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogTrigger asChild><Button variant="outline" size="lg" className="rounded-xl gap-1"><Plus className="h-4 w-4" /> يدوي</Button></DialogTrigger>
              <DialogContent dir="rtl" className="sm:max-w-md">
                <DialogHeader><DialogTitle>إدخال وقت يدوي</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>الوصف</Label><Input value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>البداية</Label><Input type="datetime-local" value={manual.started_at} onChange={(e) => setManual({ ...manual, started_at: e.target.value })} /></div>
                    <div><Label>النهاية</Label><Input type="datetime-local" value={manual.ended_at} onChange={(e) => setManual({ ...manual, ended_at: e.target.value })} /></div>
                  </div>
                  <div><Label>المهمة</Label>
                    <Select value={manual.task_id} onValueChange={(v) => setManual({ ...manual, task_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون مهمة</SelectItem>
                        {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-sm"><Switch checked={manual.billable} onCheckedChange={(v) => setManual({ ...manual, billable: v })} /> قابل للفوترة</div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setManualOpen(false)}>إلغاء</Button>
                  <Button onClick={() => addManual.mutate()} disabled={addManual.isPending}>حفظ</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Card>

      {/* Entries */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Timer className="h-4 w-4" /> أحدث السجلات</h3>
          <span className="text-xs text-muted-foreground">{entries.length} سجل</span>
        </div>
        {entries.length === 0 ? (
          <EmptyState icon={Timer} title="لا توجد سجلات وقت" hint="ابدأ المؤقّت أو أضف وقتاً يدوياً." />
        ) : (
          <ul className="divide-y">
            {entries.map((e) => {
              const isRunning = !e.ended_at;
              return (
                <li key={e.id} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0",
                      isRunning ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                      {isRunning ? <Play className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium truncate">{e.description || (e.task?.title ?? "بدون وصف")}</div>
                        {e.task?.title && e.description && <Badge variant="outline" className="text-[10px]">{e.task.title}</Badge>}
                        {e.billable && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900">فوترة</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.profile?.display_name || e.profile?.email || "—"} · {format(new Date(e.started_at), "d MMM yyyy - HH:mm", { locale: arSA })}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums font-semibold shrink-0">
                      {isRunning ? "…" : fmtDur(e.duration_minutes || 0)}
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => remove.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   4) CALENDAR
   ──────────────────────────────────────────────────────────── */

const EVENT_TYPES = [
  { value: "meeting",     label: "اجتماع",       color: "bg-sky-500",     tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200 border-sky-200 dark:border-sky-900" },
  { value: "deadline",    label: "موعد نهائي",   color: "bg-rose-500",    tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200 border-rose-200 dark:border-rose-900" },
  { value: "milestone",   label: "مرحلة",        color: "bg-violet-500",  tone: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200 border-violet-200 dark:border-violet-900" },
  { value: "deliverable", label: "تسليم",        color: "bg-emerald-500", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900" },
  { value: "leave",       label: "إجازة",        color: "bg-amber-500",   tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200 border-amber-200 dark:border-amber-900" },
] as const;

export function CalendarSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [form, setForm] = useState({ title: "", description: "", event_type: "meeting", starts_at: "", ends_at: "", all_day: false, location: "" });

  const rangeStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 6 });
  const rangeEnd   = endOfWeek(endOfMonth(cursor), { weekStartsOn: 6 });

  const { data: events = [] } = useQuery({
    queryKey: ["ws_events", projectId, cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => (await supabase.from("project_calendar_events")
      .select("*").eq("project_id", projectId)
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString())
      .order("starts_at", { ascending: true })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const v = validateForm(calendarEventSchema, { title: form.title, starts_at: form.starts_at });
      if (!v.ok) throw new Error(v.message);
      const { data: { user } } = await supabase.auth.getUser();
      if (!form.starts_at) throw new Error("حدد وقت البداية");
      const { error } = await supabase.from("project_calendar_events").insert({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description || null,
        event_type: form.event_type,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        all_day: form.all_day,
        location: form.location || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الحدث");
      qc.invalidateQueries({ queryKey: ["ws_events", projectId] });
      setOpen(false);
      setForm({ title: "", description: "", event_type: "meeting", starts_at: "", ends_at: "", all_day: false, location: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["ws_events", projectId] });
    },
  });

  const days: Date[] = [];
  {
    let d = rangeStart;
    while (d <= rangeEnd) { days.push(d); d = addDays(d, 1); }
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const ev of events) {
      const key = format(new Date(ev.starts_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...events].filter((e) => new Date(e.starts_at) >= now).slice(0, 6);
  }, [events]);

  const openForDay = (d: Date) => {
    setSelectedDay(d);
    const iso = format(d, "yyyy-MM-dd'T'09:00");
    setForm((f) => ({ ...f, starts_at: iso, ends_at: format(d, "yyyy-MM-dd'T'10:00") }));
    setOpen(true);
  };

  const weekDays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <div className="min-w-[160px] text-center font-semibold">
            {format(cursor, "LLLL yyyy", { locale: arSA })}
          </div>
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" className="h-9 rounded-lg" onClick={() => setCursor(new Date())}>اليوم</Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="rounded-lg gap-1"><Plus className="h-4 w-4" /> حدث جديد</Button></DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader><DialogTitle>{selectedDay ? `حدث في ${format(selectedDay, "d MMM", { locale: arSA })}` : "حدث جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>نوع الحدث</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-sm"><Switch checked={form.all_day} onCheckedChange={(v) => setForm({ ...form, all_day: v })} /> طوال اليوم</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>البداية</Label><Input type={form.all_day ? "date" : "datetime-local"} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>النهاية</Label><Input type={form.all_day ? "date" : "datetime-local"} value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
              <div><Label>المكان</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="مثال: Google Meet / المكتب" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={() => create.mutate()} disabled={!form.title.trim() || create.isPending}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Month grid */}
        <Card className="rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/30 text-xs">
            {weekDays.map((d) => <div key={d} className="p-2 text-center font-medium text-muted-foreground">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const key = format(d, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(key) ?? [];
              const inMonth = isSameMonth(d, cursor);
              const today = isSameDay(d, new Date());
              return (
                <button
                  key={i}
                  onClick={() => openForDay(d)}
                  className={cn(
                    "min-h-[92px] p-1.5 text-right border-b border-l last:border-l-0 hover:bg-muted/40 transition-colors focus:outline-none focus:bg-muted/60",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                  )}
                >
                  <div className={cn(
                    "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs tabular-nums mb-1",
                    today && "bg-primary text-primary-foreground font-bold",
                  )}>{format(d, "d")}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const t = EVENT_TYPES.find((x) => x.value === ev.event_type) ?? EVENT_TYPES[0];
                      return (
                        <div key={ev.id} className={cn("truncate text-[10px] px-1.5 py-0.5 rounded border", t.tone)}>
                          <span className={cn("inline-block h-1.5 w-1.5 rounded-full ml-1", t.color)} />
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Upcoming panel */}
        <Card className="rounded-2xl p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><CalendarIcon className="h-4 w-4" /> القادمة</h3>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarIcon} title="لا توجد أحداث قادمة" />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((ev) => {
                const t = EVENT_TYPES.find((x) => x.value === ev.event_type) ?? EVENT_TYPES[0];
                return (
                  <li key={ev.id} className="group rounded-xl border p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-1 h-2.5 w-2.5 rounded-full shrink-0", t.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium truncate text-sm">{ev.title}</div>
                          <Badge variant="outline" className={cn("text-[10px] border-0", t.tone)}>{t.label}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(ev.starts_at), ev.all_day ? "d MMM yyyy" : "d MMM yyyy - HH:mm", { locale: arSA })}
                        </div>
                        {ev.location && <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {ev.location}</div>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 opacity-0 group-hover:opacity-100" onClick={() => remove.mutate(ev.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Shared MiniStat
   ──────────────────────────────────────────────────────────── */

const TONES: Record<string, string> = {
  indigo:  "from-indigo-500/10 to-indigo-500/0 text-indigo-600 dark:text-indigo-300",
  emerald: "from-emerald-500/10 to-emerald-500/0 text-emerald-600 dark:text-emerald-300",
  rose:    "from-rose-500/10 to-rose-500/0 text-rose-600 dark:text-rose-300",
  amber:   "from-amber-500/10 to-amber-500/0 text-amber-600 dark:text-amber-300",
  sky:     "from-sky-500/10 to-sky-500/0 text-sky-600 dark:text-sky-300",
  violet:  "from-violet-500/10 to-violet-500/0 text-violet-600 dark:text-violet-300",
};

function MiniStat({ icon: Icon, label, value, tone = "indigo" }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <Card className={cn("relative overflow-hidden rounded-2xl p-3 bg-gradient-to-br", TONES[tone] ?? TONES.indigo)}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</div>
    </Card>
  );
}