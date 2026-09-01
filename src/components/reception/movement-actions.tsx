import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";

export type CashMovement = {
  id: string;
  direction: string;
  amount: number;
  category?: string | null;
  description?: string | null;
  business_date: string;
  contact_id?: string | null;
};

/** Edit + delete actions for a single cash movement (income / expense). */
export function MovementActions({ movement, onChanged }: { movement: CashMovement; onChanged: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    direction: movement.direction,
    amount: String(movement.amount),
    category: movement.category ?? "",
    description: movement.description ?? "",
    business_date: movement.business_date,
    contact_id: movement.contact_id ?? "",
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-lite-fin"],
    queryFn: async () => (await supabase.from("contacts").select("id, full_name").order("full_name")).data ?? [],
    enabled: editOpen,
  });

  async function save() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error("أدخل مبلغًا صحيحًا"); return; }
    setBusy(true);
    const { error } = await supabase.from("cash_movements").update({
      direction: form.direction as never,
      amount,
      category: form.category || null,
      description: form.description || null,
      business_date: form.business_date,
      contact_id: form.contact_id || null,
    }).eq("id", movement.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث الحركة");
    setEditOpen(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("cash_movements").delete().eq("id", movement.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الحركة");
    setDelOpen(false);
    onChanged();
  }

  return (
    <div className="flex items-center gap-1 print:hidden">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="تعديل">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDelOpen(true)} aria-label="حذف">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل الحركة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">داخل (إيراد)</SelectItem>
                    <SelectItem value="out">خارج (مصروف)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المبلغ</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="مثال: مبيعات / إيجار / مرتبات" />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input type="date" value={form.business_date} onChange={(e) => setForm({ ...form, business_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>العميل (اختياري)</Label>
                <Select value={form.contact_id || "__none__"} onValueChange={(v) => setForm({ ...form, contact_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">بدون</SelectItem>
                    {(contacts ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={busy}>حفظ التعديل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحركة؟</AlertDialogTitle>
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
