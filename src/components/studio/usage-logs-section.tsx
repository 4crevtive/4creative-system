import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Camera, Film, Video, MonitorPlay, Clock, Plus, Pencil, Trash2, Wallet, Activity,
} from "lucide-react";
import { useCanManage } from "@/lib/use-can-manage";

export type UsageLog = {
  id: string;
  contact_id: string;
  package_id: string | null;
  room_id: string | null;
  usage_date: string;
  photos_count: number;
  reels_count: number;
  videos_count: number;
  screen_hours: number;
  studio_hours: number;
  amount_due: number;
  amount_paid: number;
  notes: string | null;
  created_at: string;
};

const emptyForm = {
  usage_date: format(new Date(), "yyyy-MM-dd"),
  photos_count: "0", reels_count: "0", videos_count: "0",
  screen_hours: "0", studio_hours: "0",
  amount_due: "0", amount_paid: "0",
  room_id: "", package_id: "", notes: "",
};

const num = (v: string) => Number(v) || 0;
const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} ج`;

export function UsageLogsSection({ contactId }: { contactId: string }) {
  const qc = useQueryClient();
  const { canManage } = useCanManage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UsageLog | null>(null);
  const [deleting, setDeleting] = useState<UsageLog | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ["usage-logs", contactId],
    queryFn: async () => ((await supabase.from("studio_usage_logs")
      .select("*").eq("contact_id", contactId)
      .order("usage_date", { ascending: false })).data ?? []) as UsageLog[],
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms-lite"],
    queryFn: async () => (await supabase.from("rooms").select("id, name_ar").order("name_ar")).data ?? [],
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["client-packages-lite", contactId],
    queryFn: async () => (await supabase.from("studio_packages")
      .select("id, name, total_hours, used_hours").eq("contact_id", contactId)).data ?? [],
  });

  const totals = useMemo(() => logs.reduce((a, l) => ({
    photos: a.photos + Number(l.photos_count || 0),
    reels: a.reels + Number(l.reels_count || 0),
    videos: a.videos + Number(l.videos_count || 0),
    screen: a.screen + Number(l.screen_hours || 0),
    studio: a.studio + Number(l.studio_hours || 0),
    due: a.due + Number(l.amount_due || 0),
    paid: a.paid + Number(l.amount_paid || 0),
  }), { photos: 0, reels: 0, videos: 0, screen: 0, studio: 0, due: 0, paid: 0 }), [logs]);

  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name_ar ?? null;
  const packageName = (id: string | null) => packages.find((p) => p.id === id)?.name ?? null;

  function openNew() { setEditing(null); setForm({ ...emptyForm }); setOpen(true); }
  function openEdit(l: UsageLog) {
    setEditing(l);
    setForm({
      usage_date: l.usage_date,
      photos_count: String(l.photos_count), reels_count: String(l.reels_count),
      videos_count: String(l.videos_count), screen_hours: String(l.screen_hours),
      studio_hours: String(l.studio_hours), amount_due: String(l.amount_due),
      amount_paid: String(l.amount_paid), room_id: l.room_id ?? "",
      package_id: l.package_id ?? "", notes: l.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    const payload = {
      contact_id: contactId,
      usage_date: form.usage_date,
      photos_count: num(form.photos_count),
      reels_count: num(form.reels_count),
      videos_count: num(form.videos_count),
      screen_hours: num(form.screen_hours),
      studio_hours: num(form.studio_hours),
      amount_due: num(form.amount_due),
      amount_paid: num(form.amount_paid),
      room_id: form.room_id || null,
      package_id: form.package_id || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("studio_usage_logs").update(payload).eq("id", editing.id)
      : await supabase.from("studio_usage_logs").insert(payload);

    // Charge the package hours when a package is linked (new records only).
    if (!error && !editing && payload.package_id) {
      const pkg = packages.find((p) => p.id === payload.package_id);
      const hours = payload.studio_hours + payload.screen_hours;
      if (pkg && hours > 0) {
        await supabase.from("studio_packages")
          .update({ used_hours: Number(pkg.used_hours || 0) + hours })
          .eq("id", pkg.id);
      }
    }

    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "تم تحديث السجل" : "تمت إضافة السجل");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["usage-logs", contactId] });
    qc.invalidateQueries({ queryKey: ["client-packages-lite", contactId] });
    qc.invalidateQueries({ queryKey: ["studio-packages-list"] });
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const { error } = await supabase.from("studio_usage_logs").delete().eq("id", deleting.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف السجل");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["usage-logs", contactId] });
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Stat icon={Camera} label="صور" value={totals.photos} tone="text-sky-600 dark:text-sky-400" />
        <Stat icon={Film} label="ريلز" value={totals.reels} tone="text-violet-600 dark:text-violet-400" />
        <Stat icon={Video} label="فيديوهات" value={totals.videos} tone="text-pink-600 dark:text-pink-400" />
        <Stat icon={MonitorPlay} label="ساعات الشاشة" value={totals.screen} tone="text-amber-600 dark:text-amber-400" />
        <Stat icon={Clock} label="ساعات الاستوديو" value={totals.studio} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat icon={Wallet} label="المستحق" value={money(totals.due)} tone="text-foreground" />
        <Stat icon={Wallet} label="المدفوع" value={money(totals.paid)} tone={totals.paid >= totals.due ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {logs.length} سجل استخدام — المتبقي على العميل:{" "}
          <span className="font-semibold tabular-nums text-foreground">{money(Math.max(0, totals.due - totals.paid))}</span>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 ml-1" /> إضافة سجل</Button>
      </div>

      {logs.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          لا يوجد سجل استخدام بعد — سجّل أول جلسة تصوير أو ريلز.
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
                  <Activity className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold tabular-nums">{format(new Date(l.usage_date), "yyyy/MM/dd")}</span>
                    {roomName(l.room_id) && <Badge variant="secondary">{roomName(l.room_id)}</Badge>}
                    {packageName(l.package_id) && <Badge>{packageName(l.package_id)}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap tabular-nums">
                    {l.photos_count > 0 && <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" /> {l.photos_count} صورة</span>}
                    {l.reels_count > 0 && <span className="inline-flex items-center gap-1"><Film className="h-3 w-3" /> {l.reels_count} ريل</span>}
                    {l.videos_count > 0 && <span className="inline-flex items-center gap-1"><Video className="h-3 w-3" /> {l.videos_count} فيديو</span>}
                    {Number(l.screen_hours) > 0 && <span className="inline-flex items-center gap-1"><MonitorPlay className="h-3 w-3" /> {l.screen_hours} ساعة شاشة</span>}
                    {Number(l.studio_hours) > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {l.studio_hours} ساعة استوديو</span>}
                  </div>
                  {l.notes && <p className="text-xs text-muted-foreground whitespace-pre-line">{l.notes}</p>}
                </div>
                <div className="text-right space-y-1">
                  <div className="font-semibold tabular-nums">{money(Number(l.amount_due))}</div>
                  <div className={`text-xs tabular-nums ${Number(l.amount_paid) >= Number(l.amount_due) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    مدفوع {money(Number(l.amount_paid))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(l)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(l)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "تعديل سجل الاستخدام" : "سجل استخدام جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={form.usage_date} onChange={(e) => setForm({ ...form, usage_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="عدد الصور" value={form.photos_count} onChange={(v) => setForm({ ...form, photos_count: v })} />
              <Field label="عدد الريلز" value={form.reels_count} onChange={(v) => setForm({ ...form, reels_count: v })} />
              <Field label="عدد الفيديوهات" value={form.videos_count} onChange={(v) => setForm({ ...form, videos_count: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ساعات الشاشة الذكية" value={form.screen_hours} onChange={(v) => setForm({ ...form, screen_hours: v })} step="0.5" />
              <Field label="ساعات الاستوديو" value={form.studio_hours} onChange={(v) => setForm({ ...form, studio_hours: v })} step="0.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="المستحق (ج)" value={form.amount_due} onChange={(v) => setForm({ ...form, amount_due: v })} />
              <Field label="المدفوع (ج)" value={form.amount_paid} onChange={(v) => setForm({ ...form, amount_paid: v })} />
            </div>
            <div className="space-y-2">
              <Label>الغرفة</Label>
              <Select value={form.room_id || "__none__"} onValueChange={(v) => setForm({ ...form, room_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون</SelectItem>
                  {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>خصم من باقة (اختياري)</Label>
              <Select value={form.package_id || "__none__"} onValueChange={(v) => setForm({ ...form, package_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون</SelectItem>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — متبقي {Math.max(0, Number(p.total_hours) - Number(p.used_hours))} ساعة
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={busy}>{editing ? "حفظ التعديل" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف هذا السجل؟</AlertDialogTitle>
            <AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={busy}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} step={step ?? "1"} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; tone: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${tone}`}>{value}</div>
    </Card>
  );
}
