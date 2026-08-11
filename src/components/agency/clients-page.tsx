import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Users, PlusCircle, Search, Phone, Mail, Wallet, TrendingUp, TrendingDown,
  Briefcase, Pencil, Trash2, ArrowUpRight, Building2, UserCircle2,
} from "lucide-react";

export const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("en-US")} ج`;
export const initials = (s?: string | null) =>
  (s ?? "؟").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

export type AgencyClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

/* ── data ─────────────────────────────────────────────── */

export function useAgencyClients() {
  return useQuery({
    queryKey: ["agency_clients"],
    queryFn: async () =>
      ((await supabase.from("agency_clients").select("*").order("name")).data ?? []) as AgencyClientRow[],
  });
}

type ProjectLite = {
  id: string; name: string; client_id: string | null; status: string; type: string;
  engagement_model: string; budget: number | null; monthly_retainer: number | null;
  start_date: string | null; due_date: string | null; created_at: string;
};

export function useAgencyProjectsLite() {
  return useQuery({
    queryKey: ["agency_projects_lite"],
    queryFn: async () =>
      ((await supabase.from("agency_projects")
        .select("id,name,client_id,status,type,engagement_model,budget,monthly_retainer,start_date,due_date,created_at")
        .order("created_at", { ascending: false })).data ?? []) as ProjectLite[],
  });
}

type ExpenseLite = { id: string; project_id: string; amount: number; kind: string; expense_date: string; title: string };

export function useAgencyExpensesLite() {
  return useQuery({
    queryKey: ["agency_expenses_lite"],
    queryFn: async () =>
      ((await supabase.from("project_expenses")
        .select("id,project_id,amount,kind,expense_date,title")
        .order("expense_date", { ascending: false })).data ?? []) as ExpenseLite[],
  });
}

const STATUS_LABEL: Record<string, string> = {
  planned: "مخطط", in_progress: "قيد التنفيذ", on_hold: "متوقف",
  delivered: "تم التسليم", cancelled: "ملغي",
};

export function clientFinancials(
  clientId: string,
  projects: ProjectLite[],
  expenses: ExpenseLite[],
) {
  const mine = projects.filter((p) => p.client_id === clientId);
  const ids = new Set(mine.map((p) => p.id));
  const income = mine.reduce(
    (s, p) => s + Number(p.budget ?? 0) + Number(p.monthly_retainer ?? 0),
    0,
  );
  const cost = expenses.filter((e) => ids.has(e.project_id)).reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const active = mine.filter((p) => p.status === "in_progress").length;
  return { projects: mine, income, cost, net: income - cost, active };
}

/* ── client form dialog ───────────────────────────────── */

function ClientDialog({ client, trigger }: { client?: AgencyClientRow; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: client?.name ?? "",
    contact_name: client?.contact_name ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    notes: client?.notes ?? "",
    is_active: client?.is_active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (form.name.trim().length < 2) throw new Error("اسم العميل مطلوب");
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };
      if (client) {
        const { error } = await supabase.from("agency_clients").update(payload).eq("id", client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agency_clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency_clients"] });
      toast.success(client ? "تم تحديث بيانات العميل" : "تمت إضافة العميل");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "فشل الحفظ"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2"><PlusCircle className="h-4 w-4" /> عميل جديد</Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{client ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>اسم العميل / الشركة *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>مسؤول التواصل</Label>
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>الهاتف</Label>
              <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>البريد</Label>
              <Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>ملاحظات</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">عميل نشط</span>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteClientButton({ client }: { client: AgencyClientRow }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agency_clients").delete().eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency_clients"] });
      toast.success("تم حذف العميل");
    },
    onError: (e: Error) => toast.error(e.message || "لا يمكن الحذف — العميل مرتبط بمشاريع"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-500">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>حذف العميل؟</AlertDialogTitle>
          <AlertDialogDescription>سيتم حذف «{client.name}» نهائيًا.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={() => del.mutate()}>حذف</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── KPI tile ─────────────────────────────────────────── */

function Kpi({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: React.ElementType;
  tone: "emerald" | "rose" | "sky" | "amber";
}) {
  const tones = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  } as const;
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 grid place-items-center rounded-xl border", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}

/* ── list page ────────────────────────────────────────── */

export function AgencyClientsPage() {
  const { data: clients = [], isLoading } = useAgencyClients();
  const { data: projects = [] } = useAgencyProjectsLite();
  const { data: expenses = [] } = useAgencyExpensesLite();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients
      .filter((c) => !term || [c.name, c.contact_name, c.email, c.phone].some((v) => (v ?? "").toLowerCase().includes(term)))
      .map((c) => ({ client: c, fin: clientFinancials(c.id, projects, expenses) }))
      .sort((a, b) => b.fin.income - a.fin.income);
  }, [clients, projects, expenses, q]);

  const totals = rows.reduce(
    (a, r) => ({ income: a.income + r.fin.income, cost: a.cost + r.fin.cost }),
    { income: 0, cost: 0 },
  );

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> عملاء الماركتنج والبرمجة
          </h1>
          <p className="text-sm text-muted-foreground">قاعدة بيانات العملاء — بروفايل كامل، مشاريع، ودخل كل عميل</p>
        </div>
        <ClientDialog />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="عدد العملاء" value={String(clients.length)} icon={Users} tone="sky" />
        <Kpi label="إجمالي الدخل" value={fmtMoney(totals.income)} icon={TrendingUp} tone="emerald" />
        <Kpi label="إجمالي المصروفات" value={fmtMoney(totals.cost)} icon={TrendingDown} tone="rose" />
        <Kpi label="الصافي" value={fmtMoney(totals.income - totals.cost)} icon={Wallet} tone="amber" />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pr-9" placeholder="ابحث بالاسم، الهاتف، البريد..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">جارٍ التحميل...</Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">لا يوجد عملاء بعد — ابدأ بإضافة عميل.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ client, fin }) => (
            <Card key={client.id} className="p-4 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(client.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/agency/clients/$id"
                    params={{ id: client.id }}
                    className="font-semibold hover:text-primary transition-colors truncate block"
                  >
                    {client.name}
                  </Link>
                  <div className="text-xs text-muted-foreground truncate">
                    {client.contact_name || "بدون مسؤول تواصل"}
                  </div>
                </div>
                {!client.is_active && <Badge variant="outline">غير نشط</Badge>}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-[11px] text-muted-foreground">مشاريع</div>
                  <div className="font-bold tabular-nums">{fin.projects.length}</div>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <div className="text-[11px] text-muted-foreground">دخل</div>
                  <div className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(fin.income)}</div>
                </div>
                <div className="rounded-lg bg-rose-500/10 p-2">
                  <div className="text-[11px] text-muted-foreground">مصروف</div>
                  <div className="font-bold tabular-nums text-rose-600 dark:text-rose-400">{fmtMoney(fin.cost)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
                  {client.phone && <span className="flex items-center gap-1 truncate" dir="ltr"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
                  {client.email && <span className="flex items-center gap-1 truncate" dir="ltr"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <ClientDialog
                    client={client}
                    trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>}
                  />
                  <DeleteClientButton client={client} />
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                    <Link to="/agency/clients/$id" params={{ id: client.id }}><ArrowUpRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── profile page ─────────────────────────────────────── */

export function AgencyClientProfile({ clientId }: { clientId: string }) {
  const { data: clients = [], isLoading } = useAgencyClients();
  const { data: projects = [] } = useAgencyProjectsLite();
  const { data: expenses = [] } = useAgencyExpensesLite();

  const client = clients.find((c) => c.id === clientId);
  const fin = clientFinancials(clientId, projects, expenses);
  const projectIds = new Set(fin.projects.map((p) => p.id));
  const clientExpenses = expenses.filter((e) => projectIds.has(e.project_id));

  if (isLoading) return <Card className="p-10 text-center text-muted-foreground" dir="rtl">جارٍ التحميل...</Card>;
  if (!client) return <Card className="p-10 text-center text-muted-foreground" dir="rtl">العميل غير موجود</Card>;

  return (
    <div dir="rtl" className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{initials(client.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold truncate">{client.name}</h1>
              <Badge variant={client.is_active ? "default" : "outline"}>
                {client.is_active ? "نشط" : "غير نشط"}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><UserCircle2 className="h-4 w-4" />{client.contact_name || "—"}</span>
              <span className="flex items-center gap-1.5" dir="ltr"><Phone className="h-4 w-4" />{client.phone || "—"}</span>
              <span className="flex items-center gap-1.5" dir="ltr"><Mail className="h-4 w-4" />{client.email || "—"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ClientDialog client={client} trigger={<Button variant="outline" className="gap-2"><Pencil className="h-4 w-4" /> تعديل</Button>} />
            <Button asChild variant="ghost"><Link to="/agency/clients">رجوع للعملاء</Link></Button>
          </div>
        </div>
        {client.notes && (
          <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{client.notes}</p>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="عدد المشاريع" value={String(fin.projects.length)} icon={Briefcase} tone="sky" />
        <Kpi label="الدخل من العميل" value={fmtMoney(fin.income)} icon={TrendingUp} tone="emerald" />
        <Kpi label="مصروفات مشاريعه" value={fmtMoney(fin.cost)} icon={TrendingDown} tone="rose" />
        <Kpi label="الصافي" value={fmtMoney(fin.net)} icon={Wallet} tone="amber" />
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> مشاريع العميل</h2>
        {fin.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد مشاريع لهذا العميل.</p>
        ) : (
          <div className="divide-y">
            {fin.projects.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link to="/agency/projects/$id" params={{ id: p.id }} className="font-medium hover:text-primary truncate block">
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {STATUS_LABEL[p.status] ?? p.status}
                    {p.engagement_model === "retainer" ? " • عقد مستمر" : " • مشروع لحظي"}
                    {p.start_date ? ` • من ${p.start_date}` : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtMoney(Number(p.budget ?? 0) + Number(p.monthly_retainer ?? 0))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><TrendingDown className="h-4 w-4 text-rose-500" /> مصروفات مرتبطة بالعميل</h2>
        {clientExpenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد مصروفات مسجّلة.</p>
        ) : (
          <div className="divide-y">
            {clientExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.expense_date}</div>
                </div>
                <div className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">{fmtMoney(Number(e.amount))}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
