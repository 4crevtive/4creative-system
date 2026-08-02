import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, Wallet, Printer,
  Camera, Megaphone, FileSpreadsheet, FileText, CalendarIcon, X, FileSearch, Trash2, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";
import { AddMovementDialog } from "@/components/admin/add-movement-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Scope = "all" | "studio" | "agency";
const SALARY_CATS = new Set(["salary", "salaries", "مرتبات"]);
const COMPANY_LABEL: Record<string, string> = { studio: "الاستوديو", agency: "4Creative" };

type Movement = {
  id: string; direction: "in" | "out"; amount: number; category: string | null;
  description: string | null; created_at: string; business_date: string; cashbox_id: string;
  contact_id: string | null; created_by: string | null;
  contact?: { full_name?: string } | null;
};

export function ConsolidatedFinance() {
  const today = new Date();
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: monthAgo, to: today });
  const [scope, setScope] = useState<Scope>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [contactFilter, setContactFilter] = useState<string>("all");

  const fromDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : format(monthAgo, "yyyy-MM-dd");
  const toDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : format(today, "yyyy-MM-dd");

  const { data: cashboxes } = useQuery({
    queryKey: ["cashboxes-all"],
    queryFn: async () => {
      const { data: companies } = await supabase.from("companies").select("id, code");
      if (!companies?.length) return [] as { id: string; company_id: string; company_code: string }[];
      const { data } = await supabase.from("cashboxes").select("id, company_id");
      return (data ?? []).map((cb) => {
        const co = companies.find((c) => c.id === cb.company_id);
        return { id: cb.id, company_id: cb.company_id, company_code: (co?.code as string) ?? "unknown" };
      });
    },
  });

  const boxIds = (cashboxes ?? []).map((c) => c.id);
  const boxToCompany = new Map<string, string>((cashboxes ?? []).map((c) => [c.id, c.company_code]));

  const { data: movements } = useQuery({
    queryKey: ["movements-consolidated", boxIds.join(","), fromDate, toDate],
    enabled: boxIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("cash_movements")
        .select("id, direction, amount, category, description, created_at, business_date, cashbox_id, contact_id, created_by, contact:contacts(full_name)")
        .in("cashbox_id", boxIds)
        .gte("business_date", fromDate).lte("business_date", toDate)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Movement[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => (await supabase.from("profiles").select("id, display_name").order("display_name")).data ?? [],
  });
  const profileName = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p.display_name || "—"])), [profiles]);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-lite-cf"],
    queryFn: async () => (await supabase.from("contacts").select("id, full_name").order("full_name")).data ?? [],
  });

  const withCompany = (movements ?? []).map((m) => ({ ...m, company: boxToCompany.get(m.cashbox_id) ?? "unknown" }));
  const categories = useMemo(() => {
    const s = new Set<string>();
    withCompany.forEach((m) => { if (m.category) s.add(m.category); });
    return Array.from(s).sort();
  }, [withCompany]);

  const applyFilters = (rows: typeof withCompany) => rows.filter((m) => {
    if (scope !== "all" && m.company !== scope) return false;
    if (categoryFilter !== "all" && (m.category || "") !== categoryFilter) return false;
    if (employeeFilter !== "all" && m.created_by !== employeeFilter) return false;
    if (contactFilter !== "all" && m.contact_id !== contactFilter) return false;
    return true;
  });

  const scoped = applyFilters(withCompany);

  const totalsFor = (rows: typeof withCompany) => rows.reduce(
    (acc, m) => {
      const cat = (m.category || "").toLowerCase();
      const amt = Number(m.amount);
      if (m.direction === "in") acc.in += amt;
      else { acc.out += amt; if (SALARY_CATS.has(cat)) acc.salaries += amt; else acc.expenses += amt; }
      return acc;
    },
    { in: 0, out: 0, expenses: 0, salaries: 0 },
  );

  // KPI cards reflect currently-applied filters (except scope tabs stay visual only for the list)
  const filteredIgnoringScope = withCompany.filter((m) => {
    if (categoryFilter !== "all" && (m.category || "") !== categoryFilter) return false;
    if (employeeFilter !== "all" && m.created_by !== employeeFilter) return false;
    if (contactFilter !== "all" && m.contact_id !== contactFilter) return false;
    return true;
  });
  const totalAll = totalsFor(filteredIgnoringScope);
  const totalStudio = totalsFor(filteredIgnoringScope.filter((m) => m.company === "studio"));
  const totalAgency = totalsFor(filteredIgnoringScope.filter((m) => m.company === "agency"));
  const profitAll = totalAll.in - totalAll.out;

  const resetFilters = () => {
    setCategoryFilter("all"); setEmployeeFilter("all"); setContactFilter("all");
    setDateRange({ from: monthAgo, to: today });
  };

  function exportExcel() {
    const rows = scoped.map((m) => ({
      "التاريخ": format(new Date(m.created_at), "yyyy/MM/dd HH:mm"),
      "الشركة": COMPANY_LABEL[m.company] ?? m.company,
      "النوع": m.direction === "in" ? "دخل" : "منصرف",
      "التصنيف": m.category ?? "",
      "الوصف": m.description ?? "",
      "العميل": m.contact?.full_name ?? "",
      "الموظف": m.created_by ? (profileName.get(m.created_by) ?? "") : "",
      "المبلغ (ج)": Number(m.amount),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الحركات");
    XLSX.writeFile(wb, `الحسابات-${fromDate}-الى-${toDate}.xlsx`);
  }

  function exportPDF() { window.print(); } // browser print → save as PDF

  return (
    <div dir="rtl" className="space-y-6 print:space-y-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">الحسابات الشاملة</h1>
          <p className="text-muted-foreground mt-1 text-sm">نظرة موحدة على حسابات الاستوديو و 4Creative · من {fromDate} إلى {toDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddMovementDialog />
          <Button variant="outline" onClick={() => window.print()} className="rounded-xl">
            <Printer className="h-4 w-4 ml-1" /> طباعة
          </Button>
          <Button onClick={exportExcel} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileSpreadsheet className="h-4 w-4 ml-1" /> تصدير Excel
          </Button>
          <Button onClick={exportPDF} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white">
            <FileText className="h-4 w-4 ml-1" /> تصدير PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-2xl print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">من / إلى</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full min-w-0 justify-start font-normal rounded-lg overflow-hidden", !dateRange?.from && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 ml-1 shrink-0 opacity-70" />
                  <span dir="ltr" className="truncate text-xs sm:text-sm tabular-nums">
                    {dateRange?.from ? (dateRange.to
                      ? `${format(dateRange.from, "yyyy/MM/dd")} → ${format(dateRange.to, "yyyy/MM/dd")}`
                      : format(dateRange.from, "yyyy/MM/dd"))
                      : "اختر الفترة"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">التصنيف</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">الموظف</Label>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموظفين</SelectItem>
                {(profiles ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name || "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">العميل</Label>
            <Select value={contactFilter} onValueChange={setContactFilter}>
              <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العملاء</SelectItem>
                {(contacts ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full rounded-lg" onClick={resetFilters}>
              <X className="h-4 w-4 ml-1" /> مسح الفلاتر
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiTile tone="emerald" icon={ArrowDownCircle} label="إجمالي الدخل" value={totalAll.in} />
        <KpiTile tone="rose" icon={TrendingDown} label="المصاريف" value={totalAll.expenses} />
        <KpiTile tone="amber" icon={Wallet} label="المرتبات" value={totalAll.salaries} />
        <KpiTile tone="slate" icon={ArrowUpCircle} label="إجمالي المنصرف" value={totalAll.out} />
        <div className="bg-indigo-600 dark:bg-indigo-500 p-5 rounded-3xl flex flex-col gap-2 shadow-lg shadow-indigo-100 dark:shadow-indigo-500/20 text-white">
          <div className="text-white/80 bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-1">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-indigo-100 text-sm font-medium">الربح الصافي</span>
          <div className="text-2xl font-bold tabular-nums">{profitAll.toLocaleString()} <span className="text-xs font-normal text-indigo-200">ج</span></div>
        </div>
      </div>

      {/* Company breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CompanyCard label={COMPANY_LABEL.studio} icon={Camera} totals={totalStudio} accent="text-indigo-500" />
        <CompanyCard label={COMPANY_LABEL.agency} icon={Megaphone} totals={totalAgency} accent="text-purple-500" />
      </div>

      {/* Movements */}
      <Card className="rounded-3xl overflow-hidden p-0">
        <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold">حركات {scope === "all" ? "الشركتين" : COMPANY_LABEL[scope]}</h2>
          <div className="flex bg-muted p-1 rounded-xl">
            {(["all","studio","agency"] as Scope[]).map((s) => {
              const count = s === "all" ? withCompany.length : withCompany.filter((m) => m.company === s).length;
              const active = scope === s;
              return (
                <button key={s} onClick={() => setScope(s)}
                  className={cn("px-4 md:px-6 py-2 text-xs font-bold rounded-lg transition-colors",
                    active ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {s === "all" ? "الكل" : COMPANY_LABEL[s]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {scoped.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground/60">
              <FileSearch className="h-8 w-8" />
            </div>
            <p className="text-muted-foreground font-medium">لا توجد حركات في هذه الفترة</p>
          </div>
        ) : (
          <div className="divide-y">
            {scoped.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                <div className={cn("h-9 w-9 rounded-xl grid place-items-center",
                  m.direction === "in"
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300")}>
                  {m.direction === "in" ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.description || m.category || (m.direction === "in" ? "إيراد" : "مصروف")}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                    <Badge variant="outline" className="text-[10px] rounded-md">{COMPANY_LABEL[m.company] ?? m.company}</Badge>
                    {m.category && <Badge variant="outline" className="text-[10px] rounded-md">{m.category}</Badge>}
                    {m.contact?.full_name && <span>· {m.contact.full_name}</span>}
                    {m.created_by && <span>· {profileName.get(m.created_by) ?? ""}</span>}
                    <span className="tabular-nums">· {format(new Date(m.created_at), "yyyy/MM/dd HH:mm")}</span>
                  </div>
                </div>
                <div className={cn("font-bold tabular-nums text-sm md:text-base",
                  m.direction === "in" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                  {m.direction === "in" ? "+" : "−"} {Number(m.amount).toLocaleString()} ج
                </div>
                <div className="flex items-center gap-0.5 print:hidden">
                  <AddMovementDialog
                    key={`edit-${m.id}`}
                    movement={{
                      id: m.id, cashbox_id: m.cashbox_id, direction: m.direction, amount: Number(m.amount),
                      category: m.category, description: m.description, business_date: m.business_date,
                      contact_id: m.contact_id, company: m.company,
                    }}
                  />
                  <DeleteMovementButton id={m.id} label={m.description || m.category || "حركة"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function DeleteMovementButton({ id, label }: { id: string; label: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cash_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الحركة");
      qc.invalidateQueries({ queryKey: ["movements-consolidated"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    },
    onError: (e: Error) => toast.error(e.message || "فشل حذف الحركة"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" aria-label="حذف الحركة">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>حذف الحركة؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيتم حذف «{label}» نهائيًا من الحسابات. لا يمكن التراجع عن هذه الخطوة.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => { e.preventDefault(); del.mutate(); }}
            disabled={del.isPending}
          >
            {del.isPending && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function KpiTile({
  tone, icon: Icon, label, value,
}: { tone: "emerald" | "rose" | "amber" | "slate"; icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  const map = {
    emerald: {
      bg: "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20",
      chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
    },
    rose: {
      bg: "bg-rose-50/60 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20",
      chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
    },
    amber: {
      bg: "bg-amber-50/60 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20",
      chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
    },
    slate: {
      bg: "bg-slate-100 border-slate-200 dark:bg-slate-500/10 dark:border-slate-500/20",
      chip: "bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
    },
  } as const;
  const t = map[tone];
  return (
    <div className={cn("p-5 rounded-3xl border flex flex-col gap-2", t.bg)}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-1", t.chip)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
      <div className="text-2xl font-bold tabular-nums text-foreground">
        {value.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ج</span>
      </div>
    </div>
  );
}

function CompanyCard({
  label, icon: Icon, totals, accent,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  totals: { in: number; out: number; expenses: number; salaries: number };
  accent: string;
}) {
  const profit = totals.in - totals.out;
  return (
    <Card className="rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center border">
            <Icon className={cn("w-5 h-5", accent)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">شركة</p>
            <h3 className="text-lg font-bold">{label}</h3>
          </div>
        </div>
        <div className={cn("px-3 py-1 rounded-full text-xs font-bold",
          profit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          صافي: {profit.toLocaleString()} ج
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MiniStat label="الدخل" value={totals.in} />
        <MiniStat label="إجمالي المنصرف" value={totals.out} />
        <MiniStat label="المصاريف" value={totals.expenses} labelClass="text-rose-500" valueClass="text-rose-600" />
        <MiniStat label="المرتبات" value={totals.salaries} labelClass="text-amber-500" valueClass="text-amber-600" />
      </div>
    </Card>
  );
}

function MiniStat({ label, value, labelClass, valueClass }: { label: string; value: number; labelClass?: string; valueClass?: string }) {
  return (
    <div className="p-4 bg-muted/40 rounded-2xl">
      <span className={cn("text-xs block mb-1", labelClass ?? "text-muted-foreground")}>{label}</span>
      <span className={cn("text-lg font-bold tabular-nums", valueClass ?? "text-foreground")}>{value.toLocaleString()} ج</span>
    </div>
  );
}
