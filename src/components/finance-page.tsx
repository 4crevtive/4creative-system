import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowDownCircle, ArrowUpCircle, Lock, Printer, TrendingUp, TrendingDown, Wallet, CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cashMovementSchema, validateForm } from "@/lib/validation";
import { MovementActions, type CashMovement } from "@/components/reception/movement-actions";

export type CompanyCode = "studio" | "agency";

type ViewMode = "all" | "expenses" | "salaries" | "income" | "profit";
type Range = "today" | "week" | "month" | "year";

const VIEW_LABELS: Record<ViewMode, string> = {
  all: "الحسابات العامة (الكل)",
  expenses: "المصاريف",
  salaries: "المرتبات",
  income: "الدخل",
  profit: "الربح",
};

const SALARY_CATS = new Set(["salary", "salaries", "مرتبات"]);

function loadCustomViews(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("fin_custom_views") || "[]") || []; }
  catch { return []; }
}

function rangeStart(range: Range): string {
  const d = new Date();
  if (range === "today") return d.toISOString().slice(0, 10);
  if (range === "week") d.setDate(d.getDate() - 7);
  else if (range === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function FinancePage({ company, title }: { company: CompanyCode; title: string }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState<string>("all");
  const [customViews, setCustomViews] = useState<string[]>(() => loadCustomViews());
  const [showNewView, setShowNewView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [range, setRange] = useState<Range>("today");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const customFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
  const customTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : customFrom;
  const hasCustom = !!customFrom;
  const fromDate = customFrom ?? rangeStart(range);
  const toDate = customTo ?? today;

  const { data: cashbox } = useQuery({
    queryKey: ["cashbox", company],
    queryFn: async () => {
      const { data: c } = await supabase.from("companies").select("id").eq("code", company).maybeSingle();
      if (!c) return null;
      const { data } = await supabase.from("cashboxes").select("*").eq("company_id", c.id).maybeSingle();
      return data;
    },
  });

  const { data: movements } = useQuery({
    queryKey: ["movements", cashbox?.id, fromDate, toDate],
    enabled: !!cashbox,
    queryFn: async () => (await supabase.from("cash_movements")
      .select("*, contact:contacts(full_name)")
      .eq("cashbox_id", cashbox!.id)
      .gte("business_date", fromDate)
      .lte("business_date", toDate)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const isBuiltin = (v: string) => v === "all" || v === "expenses" || v === "salaries" || v === "income" || v === "profit";
  const viewLabel = isBuiltin(view) ? VIEW_LABELS[view as ViewMode] : view;

  function addCustomView() {
    const name = newViewName.trim();
    if (!name) return;
    const next = customViews.includes(name) ? customViews : [...customViews, name];
    setCustomViews(next);
    try { localStorage.setItem("fin_custom_views", JSON.stringify(next)); } catch {}
    setView(name);
    setNewViewName("");
    setShowNewView(false);
  }

  const all = movements ?? [];
  const filtered = all.filter((m) => {
    const cat = (m.category || "").toLowerCase();
    if (view === "all" || view === "profit") return true;
    if (view === "income") return m.direction === "in";
    if (view === "expenses") return m.direction === "out" && !SALARY_CATS.has(cat);
    if (view === "salaries") return m.direction === "out" && SALARY_CATS.has(cat);
    // custom view: match by category name (case-insensitive)
    return (m.category || "").toLowerCase() === view.toLowerCase();
  });

  const totals = all.reduce(
    (acc, m) => {
      const cat = (m.category || "").toLowerCase();
      const amt = Number(m.amount);
      if (m.direction === "in") acc.in += amt;
      else {
        acc.out += amt;
        if (SALARY_CATS.has(cat)) acc.salaries += amt;
        else acc.expenses += amt;
      }
      return acc;
    },
    { in: 0, out: 0, expenses: 0, salaries: 0 },
  );
  const profit = totals.in - totals.out;

  async function closeDay() {
    if (!cashbox) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("daily_closings").insert({
      cashbox_id: cashbox.id, business_date: today,
      total_in: totals.in, total_out: totals.out, net_amount: totals.in - totals.out,
      closed_by: u.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم تقفيل الخزنة لهذا اليوم");
    qc.invalidateQueries({ queryKey: ["movements"] });
  }

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">
            {viewLabel} · {hasCustom ? `من ${customFrom} إلى ${customTo}` : `من ${fromDate} إلى ${today}`}
          </p>
        </div>
        <div className="flex gap-2 print:hidden flex-wrap">
          <div className="flex flex-col gap-1">
            <Select
              value={view}
              onValueChange={(v) => {
                if (v === "__new_view__") { setShowNewView(true); return; }
                setView(v);
              }}
            >
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الحسابات العامة</SelectItem>
                <SelectItem value="expenses">المصاريف</SelectItem>
                <SelectItem value="salaries">المرتبات</SelectItem>
                <SelectItem value="income">الدخل</SelectItem>
                <SelectItem value="profit">الربح</SelectItem>
                {customViews.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                <SelectItem value="__new_view__">➕ نوع آخر (اسم جديد)</SelectItem>
              </SelectContent>
            </Select>
            {showNewView && (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  className="w-44"
                  placeholder="اسم النوع الجديد"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomView(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustomView}>إضافة</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewView(false); setNewViewName(""); }}>×</Button>
              </div>
            )}
          </div>
          <Select value={range} onValueChange={(v) => { setRange(v as Range); setDateRange(undefined); }} disabled={hasCustom}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="week">آخر أسبوع</SelectItem>
              <SelectItem value="month">آخر شهر</SelectItem>
              <SelectItem value="year">آخر سنة</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start font-normal", !hasCustom && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 ml-1" />
                {hasCustom ? `${customFrom} → ${customTo}` : "من / إلى"}
                {hasCustom && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDateRange(undefined); }}
                    className="mr-2 rounded p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <NewMovementDialog cashboxId={cashbox?.id} onCreated={() => qc.invalidateQueries({ queryKey: ["movements"] })} />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 ml-1" /> طباعة التقرير
          </Button>
          <Button variant="outline" onClick={closeDay} disabled={!cashbox}>
            <Lock className="h-4 w-4 ml-1" /> تقفيل اليوم
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200">
          <ArrowDownCircle className="h-6 w-6 text-emerald-500 mb-2" />
          <p className="text-xs text-emerald-700">الدخل</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700 mt-1">{totals.in.toLocaleString()} ج</p>
        </Card>
        <Card className="p-5 bg-rose-50 dark:bg-rose-900/20 border-rose-200">
          <TrendingDown className="h-6 w-6 text-rose-500 mb-2" />
          <p className="text-xs text-rose-700">المصاريف</p>
          <p className="text-2xl font-bold tabular-nums text-rose-700 mt-1">{totals.expenses.toLocaleString()} ج</p>
        </Card>
        <Card className="p-5 bg-orange-50 dark:bg-orange-900/20 border-orange-200">
          <Wallet className="h-6 w-6 text-orange-500 mb-2" />
          <p className="text-xs text-orange-700">المرتبات</p>
          <p className="text-2xl font-bold tabular-nums text-orange-700 mt-1">{totals.salaries.toLocaleString()} ج</p>
        </Card>
        <Card className="p-5 bg-slate-50 dark:bg-slate-900/20 border-slate-200">
          <ArrowUpCircle className="h-6 w-6 text-slate-500 mb-2" />
          <p className="text-xs text-slate-700">إجمالي المنصرف</p>
          <p className="text-2xl font-bold tabular-nums text-slate-700 mt-1">{totals.out.toLocaleString()} ج</p>
        </Card>
        <Card className="p-5" style={{ background: "var(--gradient-brand)", color: "white" }}>
          <TrendingUp className="h-6 w-6 mb-2" />
          <p className="text-xs opacity-90">الربح (الصافي)</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{profit.toLocaleString()} ج</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">تفاصيل الحركات</h3>
          <Badge variant="secondary">{filtered.length} حركة</Badge>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">لا توجد حركات</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors">
                {m.direction === "in"
                  ? <ArrowDownCircle className="h-5 w-5 text-emerald-500" />
                  : <ArrowUpCircle className="h-5 w-5 text-rose-500" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.description || m.category || (m.direction === "in" ? "إيراد" : "مصروف")}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    {m.category && <Badge variant="outline" className="text-[10px]">{m.category}</Badge>}
                    {(m as { contact?: { full_name?: string } }).contact?.full_name && (
                      <span>· {(m as { contact?: { full_name?: string } }).contact?.full_name}</span>
                    )}
                    <span className="tabular-nums">· {format(new Date(m.created_at), "yyyy/MM/dd HH:mm")}</span>
                  </div>
                </div>
                <div className={`font-bold tabular-nums ${m.direction === "in" ? "text-emerald-700" : "text-rose-700"}`}>
                  {m.direction === "in" ? "+" : "−"} {Number(m.amount).toLocaleString()} ج
                </div>
                <MovementActions
                  movement={m as unknown as CashMovement}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["movements"] })}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function NewMovementDialog({ cashboxId, onCreated }: { cashboxId?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ direction: "in", amount: "", description: "", contact_id: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [customCats, setCustomCats] = useState<{ in: string[]; out: string[] }>(() => {
    if (typeof window === "undefined") return { in: [], out: [] };
    try { return JSON.parse(localStorage.getItem("fin_custom_cats") || "") || { in: [], out: [] }; }
    catch { return { in: [], out: [] }; }
  });
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  // Custom "types" — a saved shortcut that pins a direction + category name
  type CustomType = { name: string; direction: "in" | "out" };
  const [customTypes, setCustomTypes] = useState<CustomType[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("fin_custom_types") || "[]") || []; }
    catch { return []; }
  });
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDir, setNewTypeDir] = useState<"in" | "out">("in");

  function addCustomType() {
    const name = newTypeName.trim();
    if (!name) return;
    const exists = customTypes.some((t) => t.name === name && t.direction === newTypeDir);
    const next = exists ? customTypes : [...customTypes, { name, direction: newTypeDir }];
    setCustomTypes(next);
    try { localStorage.setItem("fin_custom_types", JSON.stringify(next)); } catch {}
    setForm({ ...form, direction: newTypeDir, category: name });
    setNewTypeName("");
    setShowNewType(false);
  }

  function addCustomCat() {
    const name = newCatName.trim();
    if (!name) return;
    const dir = form.direction as "in" | "out";
    if (!customCats[dir].includes(name)) {
      const next = { ...customCats, [dir]: [...customCats[dir], name] };
      setCustomCats(next);
      try { localStorage.setItem("fin_custom_cats", JSON.stringify(next)); } catch {}
    }
    setForm({ ...form, category: name });
    setNewCatName("");
    setShowNewCat(false);
  }

  const { data: contacts } = useQuery({
    queryKey: ["contacts-lite-fin"],
    queryFn: async () => (await supabase.from("contacts").select("id, full_name").order("full_name")).data ?? [],
    enabled: open,
  });

  async function save() {
    if (!cashboxId) { toast.error("اختر الخزنة"); return; }
    const v = validateForm(cashMovementSchema, {
      amount: form.amount,
      type: form.direction,
      reason: form.description,
      notes: "",
    });
    if (!v.ok) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("cash_movements").insert({
      cashbox_id: cashboxId, direction: form.direction as never,
      amount: Number(form.amount), description: form.description,
      category: form.category || null,
      contact_id: form.contact_id || null, created_by: u.user?.id,
    });
    if (error) { setSaving(false); toast.error(error.message); return; }

    if (form.direction === "in" && form.contact_id) {
      const { error: payErr } = await supabase.from("payments").insert({
        contact_id: form.contact_id,
        amount: Number(form.amount),
        method: "cash",
        notes: form.description || "دفعة كاشير",
        created_by: u.user?.id,
      } as never);
      if (payErr) { setSaving(false); toast.error("تم تسجيل الحركة لكن فشل ربط الدفعة: " + payErr.message); return; }
    }
    setSaving(false);
    toast.success("تم تسجيل الحركة" + (form.direction === "in" && form.contact_id ? " وإضافتها لبروفايل العميل" : ""));
    setOpen(false);
    setForm({ direction: "in", amount: "", description: "", contact_id: "", category: "" });
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button disabled={!cashboxId}><Plus className="h-4 w-4 ml-1" /> حركة جديدة</Button></DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>تسجيل حركة خزنة</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>النوع</Label>
            <Select
              value={
                form.category && customTypes.some((t) => t.name === form.category && t.direction === form.direction)
                  ? `__ct__:${form.direction}:${form.category}`
                  : form.direction
              }
              onValueChange={(v) => {
                if (v === "__new_type__") { setShowNewType(true); return; }
                if (v.startsWith("__ct__:")) {
                  const [, dir, ...rest] = v.split(":");
                  const name = rest.join(":");
                  setForm({ ...form, direction: dir, category: name });
                  return;
                }
                setForm({ ...form, direction: v, category: "" });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">داخل (إيراد)</SelectItem>
                <SelectItem value="out">خارج (مصروف)</SelectItem>
                {customTypes.map((t) => (
                  <SelectItem key={`${t.direction}:${t.name}`} value={`__ct__:${t.direction}:${t.name}`}>
                    {t.name} ({t.direction === "in" ? "داخل" : "خارج"})
                  </SelectItem>
                ))}
                <SelectItem value="__new_type__">➕ نوع آخر (اسم جديد)</SelectItem>
              </SelectContent>
            </Select>
            {showNewType && (
              <div className="flex flex-col gap-2 pt-1 p-2 rounded border bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="اسم النوع الجديد"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomType(); } }}
                  />
                  <Select value={newTypeDir} onValueChange={(v) => setNewTypeDir(v as "in" | "out")}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">داخل</SelectItem>
                      <SelectItem value="out">خارج</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addCustomType}>إضافة</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewType(false); setNewTypeName(""); }}>إلغاء</Button>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>التصنيف</Label>
            <div className="flex gap-2">
              <Select
                value={form.category}
                onValueChange={(v) => {
                  if (v === "__new__") { setShowNewCat(true); return; }
                  setForm({ ...form, category: v });
                }}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                <SelectContent>
                  {form.direction === "in" ? (
                    <>
                      <SelectItem value="sales">مبيعات / حجوزات</SelectItem>
                      <SelectItem value="services">خدمات</SelectItem>
                      {customCats.in.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </>
                  ) : (
                    <>
                      <SelectItem value="مرتبات">مرتبات</SelectItem>
                      <SelectItem value="rent">إيجار</SelectItem>
                      <SelectItem value="utilities">فواتير ومرافق</SelectItem>
                      <SelectItem value="supplies">مستلزمات</SelectItem>
                      <SelectItem value="marketing">تسويق</SelectItem>
                      {customCats.out.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </>
                  )}
                  <SelectItem value="__new__">
                    ➕ {form.direction === "in" ? "دخل آخر (اسم جديد)" : "مصروف آخر (اسم جديد)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showNewCat && (
              <div className="flex gap-2 pt-1">
                <Input
                  autoFocus
                  placeholder={form.direction === "in" ? "اسم الدخل الجديد" : "اسم المصروف الجديد"}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCat(); } }}
                />
                <Button type="button" variant="outline" onClick={addCustomCat}>إضافة</Button>
                <Button type="button" variant="ghost" onClick={() => { setShowNewCat(false); setNewCatName(""); }}>إلغاء</Button>
              </div>
            )}
          </div>
          <div className="space-y-2"><Label>المبلغ (ج)</Label><Input type="number" min={0} dir="ltr" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="space-y-2"><Label>الوصف</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>العميل (اختياري)</Label>
            <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
              <SelectTrigger><SelectValue placeholder="بدون عميل" /></SelectTrigger>
              <SelectContent>
                {(contacts ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
