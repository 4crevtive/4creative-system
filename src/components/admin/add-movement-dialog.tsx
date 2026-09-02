import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ArrowDownCircle, ArrowUpCircle, CalendarIcon, Loader2, Plus, Camera, Megaphone, Sparkles, Pencil,
} from "lucide-react";

const OUT_CATEGORIES = [
  "مرتبات", "إيجار", "كهرباء ومياه", "إنترنت وهاتف", "معدات وتصوير", "صيانة",
  "مواصلات", "بوفيه وضيافة", "تسويق وإعلانات", "فريلانسرز", "خامات وطباعة",
  "ضرائب ورسوم", "عمولات", "مصاريف نثرية",
];
const IN_CATEGORIES = [
  "حجز استوديو", "مشروع إعلاني", "إدارة سوشيال ميديا", "تصوير فوتوغرافي",
  "مونتاج", "دفعة عميل", "إيراد أخرى",
];
const METHODS = ["كاش", "انستاباي", "فودافون كاش", "تحويل بنكي", "فيزا"] as const;

const schema = z.object({
  direction: z.enum(["in", "out"]),
  company: z.enum(["studio", "agency"]),
  amount: z.coerce.number({ invalid_type_error: "أدخل مبلغًا صحيحًا" }).positive("المبلغ يجب أن يكون أكبر من صفر").max(100000000, "المبلغ كبير جدًا"),
  category: z.string().min(1, "اختر التصنيف"),
  customCategory: z.string().max(60).optional(),
  business_date: z.date({ required_error: "اختر التاريخ" }),
  method: z.string().min(1),
  contact_id: z.string().optional(),
  reference: z.string().max(60).optional(),
  description: z.string().min(2, "اكتب وصفًا موضحًا للحركة").max(400),
  notes: z.string().max(1000).optional(),
}).refine((v) => v.category !== "__other__" || (v.customCategory ?? "").trim().length >= 2, {
  message: "اكتب اسم التصنيف",
  path: ["customCategory"],
});

type FormValues = z.infer<typeof schema>;

export type EditableMovement = {
  id: string;
  cashbox_id: string;
  direction: "in" | "out";
  amount: number;
  category: string | null;
  description: string | null;
  business_date: string;
  contact_id: string | null;
  company?: string;
};

export function AddMovementDialog({ movement }: { movement?: EditableMovement }) {
  const isEdit = !!movement;
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const initialCategory = movement?.category
    ? ([...OUT_CATEGORIES, ...IN_CATEGORIES].includes(movement.category) ? movement.category : "__other__")
    : "";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: movement?.direction ?? "out",
      company: (movement?.company === "agency" ? "agency" : "studio"),
      amount: (movement ? Number(movement.amount) : undefined) as unknown as number,
      category: initialCategory,
      customCategory: initialCategory === "__other__" ? (movement?.category ?? "") : "",
      business_date: movement?.business_date ? new Date(`${movement.business_date}T00:00:00`) : new Date(),
      method: "كاش",
      contact_id: movement?.contact_id ?? "",
      reference: "",
      description: movement?.description ?? "",
      notes: "",
    },
  });

  const direction = form.watch("direction");
  const company = form.watch("company");
  const category = form.watch("category");
  const amount = form.watch("amount");

  const [dirTouched, setDirTouched] = useState(false);
  useEffect(() => {
    if (!dirTouched) return;
    form.setValue("category", "");
  }, [direction]); // eslint-disable-line react-hooks/exhaustive-deps


  const { data: boxes } = useQuery({
    queryKey: ["cashboxes-by-company"],
    queryFn: async () => {
      const { data: companies } = await supabase.from("companies").select("id, code");
      const { data: cbs } = await supabase.from("cashboxes").select("id, company_id");
      return (cbs ?? []).map((cb) => ({
        id: cb.id,
        code: (companies ?? []).find((c) => c.id === cb.company_id)?.code ?? "unknown",
      }));
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-lite-cf"],
    queryFn: async () => (await supabase.from("contacts").select("id, full_name").order("full_name")).data ?? [],
  });

  const { data: agencyClients } = useQuery({
    queryKey: ["agency-clients-lite-cf"],
    queryFn: async () =>
      (await supabase.from("agency_clients").select("id, name").order("name")).data ?? [],
  });


  const cashboxId = useMemo(() => (boxes ?? []).find((b) => b.code === company)?.id, [boxes, company]);
  const categories = direction === "out" ? OUT_CATEGORIES : IN_CATEGORIES;

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      if (!cashboxId) throw new Error("لا توجد خزنة مرتبطة بهذه الشركة");
      const { data: u } = await supabase.auth.getUser();
      const finalCategory = v.category === "__other__" ? (v.customCategory ?? "").trim() : v.category;
      const meta = [
        isEdit ? "" : `طريقة الدفع: ${v.method}`,
        v.reference ? `مرجع: ${v.reference}` : "",
        v.notes?.trim() ? `ملاحظات: ${v.notes.trim()}` : "",
      ].filter(Boolean).join(" · ");
      const payload = {
        cashbox_id: cashboxId,
        direction: v.direction as never,
        amount: v.amount,
        category: finalCategory,
        business_date: format(v.business_date, "yyyy-MM-dd"),
        description: meta ? `${v.description} — ${meta}` : v.description,
        contact_id: v.contact_id?.startsWith("ag:") ? null : (v.contact_id || null),
        agency_client_id: v.contact_id?.startsWith("ag:") ? v.contact_id.slice(3) : null,
      };
      if (isEdit && movement) {
        const { error } = await supabase.from("cash_movements").update(payload).eq("id", movement.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("cash_movements")
        .insert({ ...payload, created_by: u.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم تحديث الحركة" : "تم تسجيل الحركة بنجاح");
      qc.invalidateQueries({ queryKey: ["movements-consolidated"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      if (!isEdit) {
        form.reset({
          direction, company, amount: undefined as unknown as number, category: "", customCategory: "",
          business_date: new Date(), method: "كاش", contact_id: "", reference: "", description: "", notes: "",
        });
      }
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || (isEdit ? "فشل تحديث الحركة" : "فشل تسجيل الحركة")),
  });

  const err = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground" aria-label="تعديل الحركة">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-primary-foreground">
            <Plus className="h-4 w-4 ml-1" /> إضافة حركة
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" /> {isEdit ? "تعديل الحركة المالية" : "حركة مالية جديدة"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "عدّل بيانات الحركة — يتم تحديث الحسابات فورًا بعد الحفظ."
              : "سجّل مصروفًا أو إيرادًا لأي من الشركتين بتفاصيل كاملة — يظهر فورًا في الحسابات الشاملة."}
          </DialogDescription>
        </DialogHeader>


        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          {/* Direction */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setDirTouched(true); form.setValue("direction", "out"); }}
              className={cn("p-4 rounded-2xl border text-right transition-all",
                direction === "out" ? "border-rose-300 bg-rose-50/70 ring-2 ring-rose-200" : "hover:bg-muted/50")}>
              <ArrowUpCircle className={cn("h-6 w-6 mb-2", direction === "out" ? "text-rose-600" : "text-muted-foreground")} />
              <div className="font-bold text-sm">منصرف / مصروف</div>
              <div className="text-xs text-muted-foreground">خارج من الخزنة</div>
            </button>
            <button type="button" onClick={() => { setDirTouched(true); form.setValue("direction", "in"); }}
              className={cn("p-4 rounded-2xl border text-right transition-all",
                direction === "in" ? "border-emerald-300 bg-emerald-50/70 ring-2 ring-emerald-200" : "hover:bg-muted/50")}>
              <ArrowDownCircle className={cn("h-6 w-6 mb-2", direction === "in" ? "text-emerald-600" : "text-muted-foreground")} />
              <div className="font-bold text-sm">دخل / إيراد</div>
              <div className="text-xs text-muted-foreground">داخل إلى الخزنة</div>
            </button>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">الشركة / الخزنة</Label>
            <div className="grid grid-cols-2 gap-3">
              {([["studio", "الاستوديو", Camera], ["agency", "4Creative", Megaphone]] as const).map(([code, label, Icon]) => (
                <button key={code} type="button" onClick={() => form.setValue("company", code)}
                  className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all",
                    company === code ? "border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-200 text-indigo-700" : "hover:bg-muted/50")}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            {!cashboxId && boxes && <p className="text-xs text-destructive">لا توجد خزنة مرتبطة بهذه الشركة</p>}
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">المبلغ (جنيه)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" className="rounded-lg text-lg font-bold tabular-nums"
                {...form.register("amount")} />
              {err.amount && <p className="text-xs text-destructive">{err.amount.message}</p>}
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">تاريخ الحركة</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="justify-start font-normal rounded-lg">
                    <CalendarIcon className="h-4 w-4 ml-1 opacity-70" />
                    <span dir="ltr" className="tabular-nums text-sm">{format(form.watch("business_date"), "yyyy/MM/dd")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.watch("business_date")}
                    onSelect={(d) => d && form.setValue("business_date", d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">التصنيف</Label>
              <Select value={category} onValueChange={(v) => form.setValue("category", v, { shouldValidate: true })}>
                <SelectTrigger className="rounded-lg"><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__other__">تصنيف آخر…</SelectItem>
                </SelectContent>
              </Select>
              {err.category && <p className="text-xs text-destructive">{err.category.message}</p>}
              {category === "__other__" && (
                <>
                  <Input placeholder="اسم التصنيف الجديد" className="rounded-lg mt-1" {...form.register("customCategory")} />
                  {err.customCategory && <p className="text-xs text-destructive">{err.customCategory.message}</p>}
                </>
              )}
            </div>

            {/* Method */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
              <Select value={form.watch("method")} onValueChange={(v) => form.setValue("method", v)}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Contact */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {company === "agency" ? "عميل الماركتنج (اختياري)" : "عميل الاستوديو (اختياري)"}
              </Label>
              <Select value={form.watch("contact_id") || "none"}
                onValueChange={(v) => form.setValue("contact_id", v === "none" ? "" : v)}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {company === "agency"
                    ? (agencyClients ?? []).map((c) => (
                        <SelectItem key={c.id} value={`ag:${c.id}`}>{c.name}</SelectItem>
                      ))
                    : (contacts ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>


            {/* Reference */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">رقم مرجعي / فاتورة (اختياري)</Label>
              <Input placeholder="INV-1024" className="rounded-lg" {...form.register("reference")} />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">الوصف</Label>
            <Input placeholder="مثال: شراء عدسة 50mm" className="rounded-lg" {...form.register("description")} />
            {err.description && <p className="text-xs text-destructive">{err.description.message}</p>}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">ملاحظات إضافية (اختياري)</Label>
            <Textarea rows={3} placeholder="تفاصيل أكثر عن الحركة…" className="rounded-lg resize-none" {...form.register("notes")} />
          </div>

          {/* Summary */}
          <div className={cn("p-4 rounded-2xl border flex items-center justify-between",
            direction === "out" ? "bg-rose-50/60 border-rose-100" : "bg-emerald-50/60 border-emerald-100")}>
            <span className="text-sm font-medium text-muted-foreground">
              {direction === "out" ? "سيتم خصم" : "سيتم إضافة"} من خزنة {company === "studio" ? "الاستوديو" : "4Creative"}
            </span>
            <span className={cn("text-xl font-bold tabular-nums", direction === "out" ? "text-rose-700" : "text-emerald-700")}>
              {direction === "out" ? "−" : "+"} {Number(amount || 0).toLocaleString()} ج
            </span>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={save.isPending} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-primary-foreground">
              {save.isPending && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
              {isEdit ? "حفظ التعديلات" : "حفظ الحركة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
