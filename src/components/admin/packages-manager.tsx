import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Package, Plus, Pencil, Trash2, Camera, Loader2, Clock, BadgeDollarSign } from "lucide-react";
import { usePackageImage } from "@/components/package-image";

export type Offering = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  hours: number;
  features: string[];
  sort_order: number;
  is_active: boolean;
};

const emptyForm = {
  name: "", description: "", image_url: "", price: "0", hours: "0",
  features: "", sort_order: "0", is_active: true,
};
type FormState = typeof emptyForm;

export function PackagesManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Offering | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Offering | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["package_offerings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("package_offerings")
        .select("*").order("sort_order").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Offering[];
    },
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(o: Offering) {
    setEditing(o);
    setForm({
      name: o.name,
      description: o.description ?? "",
      image_url: o.image_url ?? "",
      price: String(o.price ?? 0),
      hours: String(o.hours ?? 0),
      features: (o.features ?? []).join("\n"),
      sort_order: String(o.sort_order ?? 0),
      is_active: o.is_active,
    });
    setOpen(true);
  }

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("الحد الأقصى 10 ميجا"); return; }
    setBusy(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `offerings/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("package-images")
      .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (error) { toast.error(error.message); return; }
    setForm((f) => ({ ...f, image_url: path }));
    toast.success("تم رفع صورة الباقة");
  }

  async function save() {
    if (!form.name.trim()) { toast.error("أدخل اسم الباقة"); return; }
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      image_url: form.image_url || null,
      price: Number(form.price) || 0,
      hours: Number(form.hours) || 0,
      features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("package_offerings").update(payload).eq("id", editing.id)
      : await supabase.from("package_offerings").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "تم تحديث الباقة" : "تمت إضافة الباقة");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["package_offerings"] });
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const { error } = await supabase.from("package_offerings").delete().eq("id", deleting.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الباقة");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["package_offerings"] });
  }

  const previewSrc = usePackageImage(form.image_url);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الباقات والأسعار</h1>
          <p className="text-muted-foreground mt-1">
            كتالوج الباقات الذي يظهر للاستقبال — أضف صورة ووصفًا ومميزات لكل باقة.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 ml-1" /> باقة جديدة</Button>
      </div>

      {isLoading ? (
        <Card className="p-12 text-center text-muted-foreground">جارٍ التحميل…</Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا توجد باقات بعد — أضف أول باقة.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((o) => (
            <OfferingCard key={o.id} offering={o} onEdit={() => openEdit(o)} onDelete={() => setDeleting(o)} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "تعديل الباقة" : "إضافة باقة"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border overflow-hidden bg-muted/30">
              <div className="h-36 relative grid place-items-center">
                {previewSrc
                  ? <img src={previewSrc} alt={form.name || "صورة الباقة"} className="absolute inset-0 h-full w-full object-cover" />
                  : <Package className="h-8 w-8 text-muted-foreground" />}
              </div>
              <div className="p-2 flex items-center gap-2 border-t bg-background">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Camera className="h-3.5 w-3.5 ml-1" />}
                  رفع صورة
                </Button>
                {form.image_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>
                    إزالة الصورة
                  </Button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>اسم الباقة</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: باقة 10 ساعات تصوير" />
            </div>
            <div className="space-y-2">
              <Label>الوصف (نص الباقة)</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="اكتب تفاصيل الباقة كما تُعرض للعميل…" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>السعر (ج)</Label>
                <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>عدد الساعات</Label>
                <Input type="number" min={0} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الترتيب</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>المميزات (كل ميزة في سطر)</Label>
              <Textarea rows={4} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder={"مونتاج كامل\nغرفة تصوير مجهزة\nتسليم خلال 48 ساعة"} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="mb-0">الباقة مفعّلة (تظهر للاستقبال)</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
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
            <AlertDialogTitle>حذف باقة «{deleting?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>باقات العملاء المرتبطة بها ستبقى لكن بدون ربط بالكتالوج.</AlertDialogDescription>
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

function OfferingCard({ offering, onEdit, onDelete }: { offering: Offering; onEdit: () => void; onDelete: () => void }) {
  const src = usePackageImage(offering.image_url);
  return (
    <Card className="overflow-hidden flex flex-col hover:shadow-[var(--shadow-elegant)] transition-shadow">
      <div className="h-36 relative bg-muted/40 grid place-items-center">
        {src
          ? <img src={src} alt={offering.name} className="absolute inset-0 h-full w-full object-cover" />
          : <Package className="h-8 w-8 text-muted-foreground" />}
        {!offering.is_active && <Badge variant="secondary" className="absolute top-2 left-2">غير مفعّلة</Badge>}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="font-semibold">{offering.name}</div>
        {offering.description && <p className="text-sm text-muted-foreground line-clamp-3">{offering.description}</p>}
        <div className="flex items-center gap-3 text-sm mt-1">
          <span className="inline-flex items-center gap-1 tabular-nums"><BadgeDollarSign className="h-3.5 w-3.5" /> {Number(offering.price).toLocaleString()} ج</span>
          <span className="inline-flex items-center gap-1 tabular-nums"><Clock className="h-3.5 w-3.5" /> {Number(offering.hours)} ساعة</span>
        </div>
        {(offering.features ?? []).length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1 mt-1">
            {offering.features.slice(0, 4).map((f) => <li key={f}>• {f}</li>)}
          </ul>
        )}
        <div className="mt-auto pt-3 flex items-center gap-2 border-t">
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5 ml-1" /> تعديل</Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 ml-1" /> حذف
          </Button>
        </div>
      </div>
    </Card>
  );
}
