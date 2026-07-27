import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Star, Phone, Mail, MapPin, Globe, Linkedin, Instagram, Briefcase, MessageCircle,
  Wallet, CheckCircle2, Clock, ListTodo, TrendingUp, Building2, Languages, Calendar,
  CreditCard, Hash, Copy, User as UserIcon, StickyNote, Sparkles, Send, Power, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { SPECIALTIES, type FreelancerScope } from "./freelancers-manager";
import { WALLETS, WalletLogo } from "./freelancers-manager";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "كاش",
  wallet: "محفظة إلكترونية",
  bank: "تحويل بنكي",
};

type Freelancer = {
  id: string; full_name: string; specialty: string; scope: FreelancerScope;
  rate_kind: string; rate_amount: number | null; phone: string | null; email: string | null;
  rating: number | null; notes: string | null; is_active: boolean;
  avatar_url?: string | null; city?: string | null; country?: string | null;
  years_experience?: number | null; availability?: string | null;
  portfolio_url?: string | null; linkedin_url?: string | null; instagram_url?: string | null; behance_url?: string | null;
  skills?: string[] | null; languages?: string | null;
  currency?: string | null; bank_name?: string | null; iban?: string | null;
  payment_method?: string | null; preferred_contact?: string | null;
  wallet_provider?: string | null; wallet_number?: string | null;
  bank_account_holder?: string | null; bank_account_number?: string | null; bank_branch?: string | null;
  created_at?: string;
};

const STATUS_AR: Record<string, { label: string; tone: string }> = {
  pending: { label: "بانتظار البدء", tone: "bg-slate-500/10 text-slate-600" },
  accepted: { label: "مقبول", tone: "bg-blue-500/10 text-blue-600" },
  started: { label: "بدأ", tone: "bg-cyan-500/10 text-cyan-600" },
  progress_50: { label: "50%", tone: "bg-indigo-500/10 text-indigo-600" },
  in_review: { label: "مراجعة", tone: "bg-violet-500/10 text-violet-600" },
  submitted: { label: "تم التسليم", tone: "bg-amber-500/10 text-amber-600" },
  shooting_started: { label: "تصوير جاري", tone: "bg-cyan-500/10 text-cyan-600" },
  shooting_done: { label: "انتهى التصوير", tone: "bg-teal-500/10 text-teal-600" },
  uploaded: { label: "تم الرفع", tone: "bg-sky-500/10 text-sky-600" },
  approved: { label: "معتمد", tone: "bg-emerald-500/10 text-emerald-600" },
  completed: { label: "مكتمل", tone: "bg-emerald-500/10 text-emerald-600" },
  rejected: { label: "مرفوض", tone: "bg-rose-500/10 text-rose-600" },
  archived: { label: "مؤرشف", tone: "bg-muted text-muted-foreground" },
};

const DONE_STATUSES = new Set(["approved", "completed", "archived"]);

const SCOPE_LABELS: Record<FreelancerScope, string> = {
  studio: "استوديو",
  agency: "أجنسي",
  both: "الاثنين",
};

const CONTACT_LABELS: Record<string, string> = {
  whatsapp: "واتساب", email: "إيميل", phone: "اتصال",
};

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "؟";
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return "—"; }
}

function copyText(text: string, label: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(`تم نسخ ${label}`),
    () => toast.error("فشل النسخ"),
  );
}

export function FreelancerProfileDialog({ freelancer, open, onOpenChange }: {
  freelancer: Freelancer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const id = freelancer?.id;
  const qc = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: async (next: boolean) => {
      if (!id) return;
      const { error } = await supabase.from("freelancers").update({ is_active: next }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (next: boolean) => {
      if (!id) return;
      await qc.cancelQueries({ queryKey: ["freelancers"] });
      const snapshots = qc.getQueriesData<Freelancer[]>({ queryKey: ["freelancers"] });
      snapshots.forEach(([key, list]) => {
        if (!list) return;
        qc.setQueryData<Freelancer[]>(key, list.map((f) => (f.id === id ? { ...f, is_active: next } : f)));
      });
      return { snapshots };
    },
    onError: (e: Error, _v, ctx) => {
      ctx?.snapshots.forEach(([key, list]) => qc.setQueryData(key, list));
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["freelancers"] }),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["freelancer-tasks", id],
    enabled: !!id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,status,type,due_at,created_at,project_name,client_name")
        .eq("freelancer_id", id!)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["freelancer-payments", id],
    enabled: !!id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_expenses")
        .select("id,title,amount,kind,expense_date,notes")
        .eq("freelancer_id", id!)
        .order("expense_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  if (!freelancer) return null;
  const f = freelancer;

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => DONE_STATUSES.has(t.status as string)).length;
  const activeTasks = tasks.filter((t) => !DONE_STATUSES.has(t.status as string) && t.status !== "rejected").length;
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const currency = f.currency || "EGP";
  const specialty = SPECIALTIES.find((s) => s.value === f.specialty)?.label ?? f.specialty;
  const lastPayment = payments[0];
  const lastTask = tasks[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-5xl p-0 gap-0 max-h-[94vh] flex flex-col overflow-hidden">
        <DialogTitle className="sr-only">بروفايل {f.full_name}</DialogTitle>

        {/* Cover + Header */}
        <div className="relative shrink-0">
          <div className="h-36 bg-[radial-gradient(circle_at_20%_20%,#a78bfa_0%,transparent_45%),radial-gradient(circle_at_80%_30%,#f472b6_0%,transparent_45%),linear-gradient(135deg,#6366f1,#8b5cf6_45%,#ec4899)]">
            <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{backgroundImage:"radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)", backgroundSize:"14px 14px"}} />
          </div>
          <div className="absolute inset-x-0 -bottom-16 px-6 flex items-end gap-4">
            <div className="w-28 h-28 rounded-2xl border-4 border-background shadow-xl overflow-hidden bg-background shrink-0 ring-1 ring-black/5">
              {f.avatar_url ? (
                <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
                  {initialsOf(f.full_name)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pt-20 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold leading-tight">{f.full_name}</h2>
                <ActiveToggle
                  active={f.is_active}
                  loading={toggleActive.isPending}
                  onToggle={() => toggleActive.mutate(!f.is_active)}
                />
                <Badge variant="outline">{SCOPE_LABELS[f.scope]}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap">
                <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{specialty}</span>
                {(f.city || f.country) && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[f.city, f.country].filter(Boolean).join("، ")}</span>
                )}
                {f.years_experience != null && (
                  <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />{f.years_experience} سنة خبرة</span>
                )}
                {f.rating ? (
                  <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{f.rating}/5
                  </span>
                ) : null}
                {f.preferred_contact && (
                  <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />يفضل {CONTACT_LABELS[f.preferred_contact] ?? f.preferred_contact}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {f.phone && (
                <a href={`https://wa.me/${f.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  <Button size="sm" className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm">
                    <Send className="h-3.5 w-3.5" />واتساب
                  </Button>
                </a>
              )}
              {f.phone && (
                <a href={`tel:${f.phone}`}><Button size="sm" variant="outline" className="gap-1.5"><Phone className="h-3.5 w-3.5" />اتصال</Button></a>
              )}
              {f.email && (
                <a href={`mailto:${f.email}`}><Button size="sm" variant="outline" className="gap-1.5"><Mail className="h-3.5 w-3.5" />إيميل</Button></a>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-4 shrink-0">
          <StatCard icon={ListTodo} label="إجمالي التاسكات" value={totalTasks} tone="from-indigo-500/15 to-indigo-500/5 text-indigo-600" />
          <StatCard icon={Clock} label="قيد التنفيذ" value={activeTasks} tone="from-amber-500/15 to-amber-500/5 text-amber-600" />
          <StatCard icon={CheckCircle2} label="مكتمل" value={doneTasks} tone="from-emerald-500/15 to-emerald-500/5 text-emerald-600" />
          <StatCard icon={Wallet} label={`إجمالي المدفوع (${currency})`} value={totalPaid.toLocaleString("en-US")} tone="from-purple-500/15 to-purple-500/5 text-purple-600" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className="mx-6 self-start shrink-0">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="tasks">التاسكات ({totalTasks})</TabsTrigger>
            <TabsTrigger value="payments">المدفوعات ({payments.length})</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="overview" className="px-6 py-4 m-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Contact */}
                <Section icon={Phone} title="التواصل" tone="bg-blue-500/10 text-blue-600">
                  <DataLine icon={Phone} label="التليفون" value={f.phone} copyable dir="ltr" />
                  <DataLine icon={Mail} label="الإيميل" value={f.email} copyable dir="ltr" />
                  <DataLine icon={MessageCircle} label="الوسيلة المفضلة" value={f.preferred_contact ? (CONTACT_LABELS[f.preferred_contact] ?? f.preferred_contact) : null} />
                </Section>

                {/* Personal */}
                <Section icon={UserIcon} title="بيانات شخصية" tone="bg-indigo-500/10 text-indigo-600">
                  <DataLine icon={MapPin} label="المدينة" value={f.city} />
                  <DataLine icon={Globe} label="الدولة" value={f.country} />
                  <DataLine icon={Languages} label="اللغات" value={f.languages} />
                  <DataLine icon={Calendar} label="عضو منذ" value={formatDate(f.created_at)} />
                </Section>

                {/* Professional */}
                <Section icon={Briefcase} title="مهني" tone="bg-emerald-500/10 text-emerald-600">
                  <DataLine icon={Sparkles} label="التخصص" value={specialty} />
                  <DataLine icon={Briefcase} label="نطاق العمل" value={SCOPE_LABELS[f.scope]} />
                  <DataLine icon={TrendingUp} label="سنوات الخبرة" value={f.years_experience != null ? `${f.years_experience} سنة` : null} />
                  <DataLine icon={Star} label="التقييم" value={f.rating ? `${f.rating}/5` : null} />
                </Section>

                {/* Payment */}
                <Section icon={Wallet} title="التسعير والدفع" tone="bg-amber-500/10 text-amber-600">
                  <DataLine icon={Wallet} label="السعر" value={f.rate_amount ? `${Number(f.rate_amount).toLocaleString("en-US")} ${currency} / ${rateLabel(f.rate_kind)}` : null} />
                  <DataLine icon={CreditCard} label="وسيلة الدفع" value={PAYMENT_LABELS[f.payment_method ?? ""] ?? f.payment_method} />
                  {f.payment_method === "wallet" && (
                    <>
                      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-dashed last:border-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Wallet className="h-3.5 w-3.5" />
                          <span>المحفظة</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {f.wallet_provider && <WalletLogo provider={f.wallet_provider} size={24} />}
                          <span className="text-sm font-medium">
                            {WALLETS.find((w) => w.value === f.wallet_provider)?.label ?? "—"}
                          </span>
                        </div>
                      </div>
                      <DataLine icon={Phone} label="رقم المحفظة" value={f.wallet_number} copyable dir="ltr" mono />
                    </>
                  )}
                  {f.payment_method === "bank" && (
                    <>
                      <DataLine icon={Building2} label="البنك" value={f.bank_name} />
                      <DataLine icon={UserIcon} label="صاحب الحساب" value={f.bank_account_holder} />
                      <DataLine icon={MapPin} label="الفرع" value={f.bank_branch} />
                      <DataLine icon={Hash} label="رقم الحساب" value={f.bank_account_number} copyable dir="ltr" mono />
                      <DataLine icon={Hash} label="IBAN" value={f.iban} copyable dir="ltr" mono />
                    </>
                  )}
                </Section>

                {/* Skills */}
                {f.skills && f.skills.length > 0 && (
                  <Section icon={Sparkles} title="المهارات" tone="bg-purple-500/10 text-purple-600" className="md:col-span-2">
                    <div className="flex flex-wrap gap-1.5">
                      {f.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs px-2.5 py-1 bg-purple-500/10 text-purple-700 border-purple-200">{s}</Badge>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Links */}
                {(f.portfolio_url || f.linkedin_url || f.instagram_url || f.behance_url) && (
                  <Section icon={Globe} title="الروابط الاجتماعية" tone="bg-cyan-500/10 text-cyan-600" className="md:col-span-2">
                    <div className="flex flex-wrap gap-2">
                      {f.portfolio_url && <SocialLink href={f.portfolio_url} icon={Globe} label="Portfolio" />}
                      {f.linkedin_url && <SocialLink href={f.linkedin_url} icon={Linkedin} label="LinkedIn" />}
                      {f.instagram_url && <SocialLink href={f.instagram_url} icon={Instagram} label="Instagram" />}
                      {f.behance_url && <SocialLink href={f.behance_url} icon={Globe} label="Behance" />}
                    </div>
                  </Section>
                )}

                {/* Notes */}
                {f.notes && (
                  <Section icon={StickyNote} title="ملاحظات" tone="bg-rose-500/10 text-rose-600" className="md:col-span-2">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{f.notes}</p>
                  </Section>
                )}

                {/* Activity Snapshot */}
                {(lastTask || lastPayment) && (
                  <Section icon={Clock} title="آخر نشاط" tone="bg-slate-500/10 text-slate-600" className="md:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {lastTask && (
                        <div className="rounded-lg border p-2.5 bg-muted/30">
                          <div className="text-[10px] text-muted-foreground mb-0.5">آخر تاسك</div>
                          <div className="text-sm font-medium truncate">{lastTask.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{formatDate(lastTask.created_at)}</div>
                        </div>
                      )}
                      {lastPayment && (
                        <div className="rounded-lg border p-2.5 bg-muted/30">
                          <div className="text-[10px] text-muted-foreground mb-0.5">آخر دفعة</div>
                          <div className="text-sm font-medium truncate">{Number(lastPayment.amount).toLocaleString("en-US")} {currency}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{formatDate(lastPayment.expense_date)}</div>
                        </div>
                      )}
                    </div>
                  </Section>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="px-6 py-4 m-0">
              {tasks.length === 0 ? (
                <EmptyState icon={ListTodo} text="لا توجد تاسكات مرتبطة بهذا الفريلانسر" />
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => {
                    const st = STATUS_AR[t.status as string] ?? { label: t.status as string, tone: "bg-muted text-muted-foreground" };
                    return (
                      <Card key={t.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{t.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            {t.project_name && <span>{t.project_name}</span>}
                            {t.client_name && <span>• {t.client_name}</span>}
                            {t.due_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(t.due_at)}</span>}
                          </div>
                        </div>
                        <Badge className={st.tone} variant="outline">{st.label}</Badge>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="px-6 py-4 m-0">
              {payments.length === 0 ? (
                <EmptyState icon={Wallet} text="لا توجد مدفوعات مسجلة" />
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <Card key={p.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(p.expense_date)}</span>
                          <Badge variant="outline" className="text-[10px]">{p.kind}</Badge>
                        </div>
                      </div>
                      <div className="text-emerald-600 font-bold tabular-nums whitespace-nowrap">
                        {Number(p.amount).toLocaleString("en-US")} {currency}
                      </div>
                    </Card>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t mt-3">
                    <span className="text-sm font-semibold">الإجمالي</span>
                    <span className="text-lg font-bold text-emerald-600 tabular-nums">{totalPaid.toLocaleString("en-US")} {currency}</span>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function rateLabel(kind: string) {
  return ({ per_project: "مشروع", hourly: "ساعة", per_month: "شهر" } as Record<string, string>)[kind] ?? kind;
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string | number; tone: string }) {
  return (
    <Card className={`p-3 flex items-center gap-3 bg-gradient-to-br ${tone} border-transparent`}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-background/80 shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight tabular-nums truncate text-foreground">{value}</div>
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      </div>
    </Card>
  );
}

function Section({ icon: Icon, title, tone, className = "", children }: {
  icon: React.ElementType; title: string; tone: string; className?: string; children: React.ReactNode;
}) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </Card>
  );
}

function DataLine({ icon: Icon, label, value, copyable, dir, mono }: {
  icon: React.ElementType; label: string; value: string | number | null | undefined;
  copyable?: boolean; dir?: "ltr" | "rtl"; mono?: boolean;
}) {
  const shown = value === null || value === undefined || value === "" ? null : String(value);
  return (
    <div className="flex items-center gap-2 group py-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground min-w-[80px]">{label}</span>
      <span className={`text-sm flex-1 truncate ${shown ? "text-foreground" : "text-muted-foreground/50"} ${mono ? "font-mono" : ""}`} dir={dir}>
        {shown ?? "—"}
      </span>
      {shown && copyable && (
        <button
          type="button"
          onClick={() => copyText(shown, label)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          aria-label={`نسخ ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SocialLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs hover:bg-primary hover:text-primary-foreground transition-colors">
        <Icon className="h-3.5 w-3.5" />{label}
      </Button>
    </a>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-10 w-10 mb-2 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function ActiveToggle({ active, loading, onToggle, size = "md" }: {
  active: boolean;
  loading?: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!loading) onToggle(); }}
      disabled={loading}
      aria-pressed={active}
      title={active ? "الفريلانسر نشط — اضغط للإيقاف" : "الفريلانسر متوقف — اضغط للتفعيل"}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all select-none",
        isSm ? "text-[10px] pr-2 pl-1 py-0.5" : "text-xs pr-3 pl-1.5 py-1",
        active
          ? "bg-emerald-500/10 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20 shadow-sm shadow-emerald-500/10"
          : "bg-muted text-muted-foreground border-border hover:bg-muted/70",
        loading && "opacity-60 cursor-wait",
      ].filter(Boolean).join(" ")}
    >
      <span
        className={[
          "flex items-center justify-center rounded-full transition-colors",
          isSm ? "w-3 h-3" : "w-4 h-4",
          active ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/40" : "bg-muted-foreground/20 text-muted-foreground",
        ].join(" ")}
      >
        {loading ? (
          <Loader2 className={isSm ? "h-2 w-2 animate-spin" : "h-2.5 w-2.5 animate-spin"} />
        ) : (
          <Power className={isSm ? "h-2 w-2" : "h-2.5 w-2.5"} strokeWidth={3} />
        )}
      </span>
      <span className="flex items-center gap-1">
        {active && !loading && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
        {active ? "نشط" : "متوقف"}
      </span>
    </button>
  );
}