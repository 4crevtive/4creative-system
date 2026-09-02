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
import { ArrowDownCircle, Plus, Pencil, Trash2, Wallet, TrendingUp } from "lucide-react";
import { useCanManage } from "@/lib/use-can-manage";

export type ProjectIncome = {
  id: string;
  project_id: string;
  amount: number;
  received_at: string;
  method: string | null;
  title: string | null;
  notes: string | null;
  cash_movement_id: string | null;
  created_at: string;
};

const METHODS = [
  { value: "cash", label: "كاش" },
  { value: "instapay", label: "إنستا باي" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "bank", label: "تحويل بنكي" },
  { value: "other", label: "أخرى" },
] as const;

export const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} ج`;
const methodLabel = (v: string | null) => METHODS.find((m) => m.value === v)?.label ?? v ?? "—";

/** All incomes of a set of projects — used in the agency client profile. */
export function useProjectIncomes(projectIds?: string[]) {
  return useQuery({
    queryKey: ["project_incomes", (projectIds ?? []).join(",")],
    queryFn: async () => {
      let q = supabase.from("project_incomes").select("*").order("received_at", { ascending: false });
      if (projectIds) q = q.in("project_id", projectIds);
      return ((await q).data ?? []) as ProjectIncome[];
    },
  });
}

async function agencyCashboxId() {
  const { data: co } = await supabase.from("companies").select("id").eq("code", "agency" as never).maybeSingle();
  if (!co?.id) return null;
  const { data: box } = await supabase.from("cashboxes").select("id").eq("company_id", co.id)
    .eq("is_active", true).order("created_at").limit(1).maybeSingle();
  return box?.id ?? null;
}

const emptyForm = {
  amount: "0",
  received_at: format(new Date(), "yyyy-MM-dd"),
  method: "cash",
  title: "",
  notes: "",
};

export function ProjectIncomeSection({ projectId, projectName, clientName }: {
  projectId: string; projectName: string; clientName?: string | null;
}) {
  const qc = useQueryClient();
  const { canManage } = useCanManage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectIncome | null>(null);
  const [deleting, setDeleting] = useState<ProjectIncome | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);

  const { data: incomes = [] } = useQuery({
    queryKey: ["project_incomes", projectId],
    queryFn: async () => ((await supabase.from("project_incomes")
      .select("*").eq("project_id", projectId)
      .order("received_at", { ascending: false })).data ?? []) as ProjectIncome[],
  });

  const total = useMemo(() => incomes.reduce((s, i) => s + Number(i.amount || 0), 0), [incomes]);

  function openNew() { setEditing(null); setForm({ ...emptyForm }); setOpen(true); }
  function openEdit(i: ProjectIncome) {
    setEditing(i);
    setForm({
      amount: String(i.amount), received_at: i.received_at,
      method: i.method ?? "cash", title: i.title ?? "", notes: i.notes ?? "",
    });
    setOpen(true);
  }

  const description = (title: string) =>
    `دخل مشروع «${projectName}»${clientName ? ` — العميل: ${clientName}` : ""}${title ? ` — ${title}` : ""}`;

  async function save() {
    const amount = Number(form.amount) || 0;
    if (amount <= 0) { toast.error("أدخل مبلغًا صحيحًا"); return; }
    setBusy(true);

    if (editing) {
      const { error } = await supabase.from("project_incomes").update({
        amount, received_at: form.received_at, method: form.method,
        title: form.title.trim() || null, notes: form.notes.trim() || null,
      }).eq("id", editing.id);
      if (!error && editing.cash_movement_id) {
        await supabase.from("cash_movements").update({
          amount, business_date: form.received_at,
          description: description(form.title.trim()),
        }).eq("id", editing.cash_movement_id);
      }
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("تم تحديث الدخل");
    } else {
      const boxId = await agencyCashboxId();
      let movementId: string | null = null;
      if (boxId) {
        const { data: mv, error: mvErr } = await supabase.from("cash_movements").insert({
          cashbox_id: boxId, direction: "in" as never, amount,
          business_date: form.received_at, category: "project_income",
          description: description(form.title.trim()),
        }).select("id").maybeSingle();
        if (mvErr) { setBusy(false); toast.error(mvErr.message); return; }
        movementId = mv?.id ?? null;
      }
      const { error } = await supabase.from("project_incomes").insert({
        project_id: projectId, amount, received_at: form.received_at,
        method: form.method, title: form.title.trim() || null,
        notes: form.notes.trim() || null, cash_movement_id: movementId,
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success(boxId ? "تم تسجيل الدخل في خزنة الوكالة" : "تم تسجيل الدخل (لا توجد خزنة للوكالة)");
    }

    setOpen(false);
    qc.invalidateQueries({ queryKey: ["project_incomes"] });
    qc.invalidateQueries({ queryKey: ["movements-consolidated"] });
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const { error } = await supabase.from("project_incomes").delete().eq("id", deleting.id);
    if (!error && deleting.cash_movement_id) {
      await supabase.from("cash_movements").delete().eq("id", deleting.cash_movement_id);
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الدخل");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["project_incomes"] });
    qc.invalidateQueries({ queryKey: ["movements-consolidated"] });
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> إجمالي الدخل المستلم</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(total)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> عدد الدفعات</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{incomes.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownCircle className="h-3.5 w-3.5" /> آخر استلام</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {incomes[0] ? format(new Date(incomes[0].received_at), "yyyy/MM/dd") : "—"}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">كل دفعة تُسجَّل تلقائيًا في خزنة الوكالة وتظهر في الحسابات الشاملة.</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 ml-1" /> تسجيل دخل</Button>
      </div>

      {incomes.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">لا يوجد دخل مسجّل لهذا المشروع بعد.</Card>
      ) : (
        <div className="space-y-2">
          {incomes.map((i) => (
            <Card key={i.id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <ArrowDownCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{i.title || "دفعة"}</span>
                  <Badge variant="secondary">{methodLabel(i.method)}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    استُلمت {format(new Date(i.received_at), "yyyy/MM/dd")}
                  </span>
                </div>
                {i.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{i.notes}</p>}
              </div>
              <div className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(Number(i.amount))}</div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                {canManage && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "تعديل الدخل" : "تسجيل دخل من المشروع"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>المبلغ (ج)</Label>
              <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الاستلام</Label>
              <Input type="date" value={form.received_at} onChange={(e) => setForm({ ...form, received_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الوصف (اختياري)</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: الدفعة الأولى 50%" />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={busy}>{editing ? "حفظ التعديل" : "تسجيل"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف هذه الدفعة؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف حركة الخزنة المرتبطة بها أيضًا.</AlertDialogDescription>
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
