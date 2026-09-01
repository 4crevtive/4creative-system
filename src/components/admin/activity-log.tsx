import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, History, Plus, Pencil, Trash2, Search } from "lucide-react";

type AuditRow = {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  table_name: string;
  record_label: string | null;
  changed_fields: Record<string, { from: unknown; to: unknown }> | null;
  created_at: string;
};

const tableLabels: Record<string, string> = {
  tasks: "المهام",
  contacts: "جهات الاتصال",
  agency_clients: "عملاء الشركة",
  agency_projects: "مشاريع الشركة",
  cash_movements: "الحركات المالية",
  studio_packages: "باقات العملاء",
  package_offerings: "كتالوج الباقات",
  freelancers: "الفريلانسرز",
  bookings: "الحجوزات",
  invoices: "الفواتير",
  payments: "المدفوعات",
  user_roles: "أدوار المستخدمين",
  project_expenses: "مصروفات المشاريع",
  project_members: "أعضاء المشاريع",
};

const roleLabels: Record<string, string> = {
  super_admin: "أدمن أعلى",
  admin: "أدمن",
  dept_manager: "مدير قسم",
  dept_assistant: "مساعد مدير",
  staff: "موظف",
  reception: "استقبال",
  editor: "مونتاج",
  designer: "ديزاين",
  photographer: "تصوير",
  viewer: "مشاهدة",
};

const fieldLabels: Record<string, string> = {
  status: "الحالة",
  title: "العنوان",
  name: "الاسم",
  full_name: "الاسم",
  amount: "المبلغ",
  price: "السعر",
  priority: "الأولوية",
  assignee_id: "المسؤول",
  due_at: "موعد التسليم",
  due_date: "تاريخ الاستحقاق",
  paid: "المدفوع",
  paid_amount: "المدفوع",
  is_active: "مُفعّل",
  notes: "ملاحظات",
  description: "الوصف",
  role: "الدور",
  budget: "الميزانية",
  total_hours: "إجمالي الساعات",
  used_hours: "الساعات المستخدمة",
};

const actionMeta: Record<
  string,
  { label: string; icon: typeof Plus; className: string }
> = {
  insert: {
    label: "أضاف",
    icon: Plus,
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  update: {
    label: "عدّل",
    icon: Pencil,
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  delete: {
    label: "حذف",
    icon: Trash2,
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ActivityLog() {
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(
          "id, actor_name, actor_email, actor_role, action, table_name, record_label, changed_fields, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (tableFilter !== "all" && r.table_name !== tableFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!q) return true;
      return [r.actor_name, r.actor_email, r.record_label, tableLabels[r.table_name]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [data, search, tableFilter, actionFilter]);

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">سجل النشاط</h1>
            <p className="text-sm text-muted-foreground">
              كل تعديل أو إضافة أو حذف في النظام ومن نفّذه
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          تحديث
        </Button>
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">تصفية</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو العنصر…"
              className="pr-9"
            />
          </div>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {Object.entries(tableLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="نوع العملية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العمليات</SelectItem>
              <SelectItem value="insert">إضافة</SelectItem>
              <SelectItem value="update">تعديل</SelectItem>
              <SelectItem value="delete">حذف</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">
            لا يوجد نشاط مطابق للتصفية
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const meta = actionMeta[r.action] ?? actionMeta["update"]!;
            const Icon = meta.icon;
            const changes = Object.entries(r.changed_fields ?? {});
            return (
              <Collapsible key={r.id}>
                <Card className="border-border/60 bg-card/60 transition-colors hover:bg-accent/30">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                      <span className="text-sm">
                        <span className="font-semibold">
                          {r.actor_name ?? r.actor_email ?? "النظام"}
                        </span>
                        {r.actor_role ? (
                          <span className="text-muted-foreground">
                            {" "}
                            ({roleLabels[r.actor_role] ?? r.actor_role})
                          </span>
                        ) : null}
                        <span className="text-muted-foreground"> — </span>
                        <span>{tableLabels[r.table_name] ?? r.table_name}</span>
                        {r.record_label ? (
                          <span className="font-medium"> «{r.record_label}»</span>
                        ) : null}
                      </span>
                      <span className="ms-auto text-xs text-muted-foreground">
                        {fmtTime(r.created_at)}
                      </span>
                      {changes.length > 0 && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1">
                            {changes.length} تغيير
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>
                    <CollapsibleContent>
                      <div className="mt-3 space-y-1.5 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
                        {changes.map(([field, val]) => (
                          <div key={field} className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {fieldLabels[field] ?? field}:
                            </span>
                            <span className="text-muted-foreground line-through">
                              {fmtValue(val?.from)}
                            </span>
                            <span className="text-muted-foreground">←</span>
                            <span className="text-foreground">{fmtValue(val?.to)}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
