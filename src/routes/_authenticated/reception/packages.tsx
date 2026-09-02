import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Pencil, Trash2, Clock, BadgeDollarSign } from "lucide-react";
import { format } from "date-fns";
import { usePackageImage } from "@/components/package-image";
import { useCanManage } from "@/lib/use-can-manage";


export const Route = createFileRoute("/_authenticated/reception/packages")({
  head: () => ({
    meta: [
      { title: "الباقات والأسعار — الاستقبال — 4Creative" },
      { name: "description", content: "كتالوج الباقات وباقات العملاء: الساعات والمدفوعات ومواعيد التحصيل." },
      { property: "og:title", content: "الباقات والأسعار — الاستقبال" },
      { property: "og:description", content: "إدارة باقات العملاء في الاستقبال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceptionPackages,
});

type Offering = {
  id: string; name: string; description: string | null; image_url: string | null;
  price: number; hours: number; features: string[]; tags?: string[]; is_active: boolean;
  room_id: string | null;
};

type Room = { id: string; name_ar: string; code: string };

type ClientPackage = {
  id: string; name: string; contact_id: string; offering_id: string | null;
  total_hours: number; used_hours: number; total_amount: number; paid_amount: number;
  next_collection_date: string | null; notes: string | null; is_active: boolean;
  contact?: { full_name?: string; phone?: string } | null;
};

const emptyForm = {
  contact_id: "", offering_id: "", name: "", total_hours: "0", used_hours: "0",
  total_amount: "0", paid_amount: "0", next_collection_date: "", notes: "", is_active: true,
};

function ReceptionPackages() {
  const qc = useQueryClient();
  const { canManage } = useCanManage();
  const [open, setOpen] = useState(false);

  const [editing, setEditing] = useState<ClientPackage | null>(null);
  const [deleting, setDeleting] = useState<ClientPackage | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);

  const { data: offerings = [] } = useQuery({
    queryKey: ["package_offerings"],
    queryFn: async () => ((await supabase.from("package_offerings").select("*").order("sort_order")).data ?? []) as Offering[],
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["studio-packages-list"],
    queryFn: async () => ((await supabase.from("studio_packages")
      .select("*, contact:contacts(full_name, phone)")
      .order("created_at", { ascending: false })).data ?? []) as ClientPackage[],
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-lite-packages"],
    queryFn: async () => (await supabase.from("contacts").select("id, full_name").order("full_name")).data ?? [],
  });

  function openNew() { setEditing(null); setForm({ ...emptyForm }); setOpen(true); }

  function openEdit(p: ClientPackage) {
    setEditing(p);
    setForm({
      contact_id: p.contact_id,
      offering_id: p.offering_id ?? "",
      name: p.name,
      total_hours: String(p.total_hours),
      used_hours: String(p.used_hours),
      total_amount: String(p.total_amount),
      paid_amount: String(p.paid_amount),
      next_collection_date: p.next_collection_date ?? "",
      notes: p.notes ?? "",
      is_active: p.is_active,
    });
    setOpen(true);
  }

  /** Picking a catalog package pre-fills name / hours / price. */
  function pickOffering(id: string) {
    const o = offerings.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      offering_id: id,
      name: f.name || o?.name || "",
      total_hours: o ? String(o.hours) : f.total_hours,
      total_amount: o ? String(o.price) : f.total_amount,
    }));
  }

  async function save() {
    if (!form.contact_id) { toast.error("اختر العميل"); return; }
    if (!form.name.trim()) { toast.error("أدخل اسم الباقة"); return; }
    setBusy(true);
    const payload = {
      contact_id: form.contact_id,
      offering_id: form.offering_id || null,
      name: form.name.trim(),
      total_hours: Number(form.total_hours) || 0,
      used_hours: Number(form.used_hours) || 0,
      total_amount: Number(form.total_amount) || 0,
      paid_amount: Number(form.paid_amount) || 0,
      next_collection_date: form.next_collection_date || null,
      notes: form.notes || null,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("studio_packages").update(payload).eq("id", editing.id)
      : await supabase.from("studio_packages").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "تم تحديث الباقة" : "تمت إضافة الباقة للعميل");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["studio-packages-list"] });
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const { error } = await supabase.from("studio_packages").delete().eq("id", deleting.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الباقة");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["studio-packages-list"] });
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الباقات والأسعار</h1>
          <p className="text-muted-foreground mt-1">كتالوج الباقات المعتمد من الإدارة، وباقات العملاء المسجّلة</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 ml-1" /> باقة لعميل</Button>
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">باقات العملاء ({packages.length})</TabsTrigger>
          <TabsTrigger value="catalog">كتالوج الأسعار ({offerings.filter((o) => o.is_active).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          {packages.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">لا توجد باقات بعد</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((p) => {
                const remaining = Math.max(0, Number(p.total_hours) - Number(p.used_hours));
                const usagePct = p.total_hours > 0 ? (Number(p.used_hours) / Number(p.total_hours)) * 100 : 0;
                const due = Math.max(0, Number(p.total_amount) - Number(p.paid_amount));
                return (
                  <Card key={p.id} className="p-5 hover:shadow-[var(--shadow-elegant)] transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-11 w-11 rounded-lg bg-primary/10 grid place-items-center text-primary">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.contact?.full_name ?? "—"}</div>
                      </div>
                      {p.is_active ? <Badge>نشطة</Badge> : <Badge variant="secondary">مغلقة</Badge>}
                    </div>

                    <div className="space-y-3 pt-3 border-t">
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>الساعات</span>
                          <span className="tabular-nums">{Number(p.used_hours)} / {Number(p.total_hours)} ساعة</span>
                        </div>
                        <Progress value={usagePct} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1 tabular-nums">المتبقي: {remaining} ساعة</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 rounded-md bg-muted/40">
                          <div className="text-xs text-muted-foreground">الإجمالي</div>
                          <div className="font-semibold tabular-nums">{Number(p.total_amount).toLocaleString()} ج</div>
                        </div>
                        <div className={`p-2 rounded-md ${due > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}>
                          <div className="text-xs text-muted-foreground">المتبقي</div>
                          <div className="font-semibold tabular-nums">{due.toLocaleString()} ج</div>
                        </div>
                      </div>

                      {p.next_collection_date && (
                        <div className="text-xs text-muted-foreground tabular-nums">
                          📅 موعد التحصيل القادم: {format(new Date(p.next_collection_date), "yyyy/MM/dd")}
                        </div>
                      )}

                      {canManage ? (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5 ml-1" /> تعديل
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(p)}>
                            <Trash2 className="h-3.5 w-3.5 ml-1" /> حذف
                          </Button>
                        </div>
                      ) : (
                        <div className="pt-2 border-t text-xs text-muted-foreground">
                          التعديل والحذف متاح للإدارة فقط
                        </div>
                      )}

                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-4">
          {offerings.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              لا توجد باقات في الكتالوج — تُضاف من داشبورد الإدارة (الباقات والأسعار).
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offerings.filter((o) => o.is_active).map((o) => (
                <CatalogCard key={o.id} offering={o} onUse={() => { openNew(); pickOffering(o.id); }} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "تعديل باقة العميل" : "إضافة باقة لعميل"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>العميل</Label>
              <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الباقة من الكتالوج (اختياري)</Label>
              <Select value={form.offering_id || "__none__"} onValueChange={(v) => (v === "__none__" ? setForm({ ...form, offering_id: "" }) : pickOffering(v))}>
                <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون</SelectItem>
                  {offerings.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} — {Number(o.price).toLocaleString()} ج / {Number(o.hours)} ساعة
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اسم الباقة</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>إجمالي الساعات</Label>
                <Input type="number" min={0} value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الساعات المستخدمة</Label>
                <Input type="number" min={0} value={form.used_hours} onChange={(e) => setForm({ ...form, used_hours: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الإجمالي (ج)</Label>
                <Input type="number" min={0} value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>المدفوع (ج)</Label>
                <Input type="number" min={0} value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>موعد التحصيل القادم</Label>
              <Input type="date" value={form.next_collection_date} onChange={(e) => setForm({ ...form, next_collection_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="mb-0">الباقة نشطة</Label>
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

function CatalogCard({ offering, onUse }: { offering: Offering; onUse: () => void }) {
  const src = usePackageImage(offering.image_url);
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="h-36 relative bg-muted/40 grid place-items-center">
        {src
          ? <img src={src} alt={offering.name} className="absolute inset-0 h-full w-full object-cover" />
          : <Package className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="font-semibold">{offering.name}</div>
        {(offering.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {offering.tags!.map((t) => <Badge key={t} className="text-[10px]">{t}</Badge>)}
          </div>
        )}
        {offering.description && <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4">{offering.description}</p>}
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 tabular-nums"><BadgeDollarSign className="h-3.5 w-3.5" /> {Number(offering.price).toLocaleString()} ج</span>
          <span className="inline-flex items-center gap-1 tabular-nums"><Clock className="h-3.5 w-3.5" /> {Number(offering.hours)} ساعة</span>
        </div>
        {(offering.features ?? []).length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1">
            {offering.features.map((f) => <li key={f}>• {f}</li>)}
          </ul>
        )}
        <Button className="mt-auto" size="sm" variant="outline" onClick={onUse}>
          <Plus className="h-3.5 w-3.5 ml-1" /> استخدام لعميل
        </Button>
      </div>
    </Card>
  );
}
