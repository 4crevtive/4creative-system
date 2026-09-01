import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";

type EditableContact = {
  id: string;
  full_name: string;
  type: string;
  phone?: string | null;
  email?: string | null;
  job_title?: string | null;
  city?: string | null;
  notes?: string | null;
};

/** Quick edit + delete for a client card. Rendered inside a Link, so clicks are contained. */
export function ContactQuickActions({ contact, onChanged }: { contact: EditableContact; onChanged: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: contact.full_name,
    type: contact.type,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    job_title: contact.job_title ?? "",
    city: contact.city ?? "",
    notes: contact.notes ?? "",
  });

  const contain = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  async function save() {
    if (!form.full_name.trim()) { toast.error("أدخل اسم العميل"); return; }
    setBusy(true);
    const { error } = await supabase.from("contacts").update({
      full_name: form.full_name.trim(),
      type: form.type as never,
      phone: form.phone || null,
      email: form.email || null,
      job_title: form.job_title || null,
      city: form.city || null,
      notes: form.notes || null,
    }).eq("id", contact.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث بيانات العميل");
    setEditOpen(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف العميل");
    setDelOpen(false);
    onChanged();
  }

  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="secondary" size="icon" className="h-7 w-7 shadow-sm"
        aria-label="تعديل العميل"
        onClick={(e) => { contain(e); setEditOpen(true); }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="secondary" size="icon" className="h-7 w-7 shadow-sm text-destructive"
        aria-label="حذف العميل"
        onClick={(e) => { contain(e); setDelOpen(true); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" onClick={contain}>
          <DialogHeader><DialogTitle>تعديل بيانات العميل</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">مدرس</SelectItem>
                    <SelectItem value="reel_client">عميل ريلز</SelectItem>
                    <SelectItem value="service_client">عميل خدمات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المسمى الوظيفي</Label>
                <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>البريد</Label>
                <Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={busy}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent dir="rtl" onClick={contain}>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العميل «{contact.full_name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف بيانات العميل نهائيًا. الحجوزات أو الفواتير المرتبطة قد تمنع الحذف.
            </AlertDialogDescription>
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
