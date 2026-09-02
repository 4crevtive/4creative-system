import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Phone, Mail, MapPin, Building2, FileText, Pencil, ArrowRight, Calendar, Wallet,
  Package, MessagesSquare, Plus, X, Printer, Globe, Instagram, Facebook, Linkedin,
  Youtube, Cake, IdCard, Flag, Briefcase, Languages, Star, TrendingUp, AlertCircle,
  CheckCircle2, Sparkles, MessageCircle, Copy, ExternalLink, Clock, User, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, differenceInYears } from "date-fns";
import { ar } from "date-fns/locale";
import { contactSchema, validateForm } from "@/lib/validation";
import { useContactImage, ImageUploadButton } from "@/components/contact-image";
import { UsageLogsSection } from "@/components/studio/usage-logs-section";


export const Route = createFileRoute("/_authenticated/reception/clients/$id")({
  component: ClientProfilePage,
});

type Contact = {
  id: string; full_name: string; type: string;
  phone: string | null; email: string | null; address: string | null;
  social_handle: string | null; avatar_url: string | null; cover_url: string | null;
  source: string | null; notes: string | null; internal_notes: string | null;
  billing_company_name: string | null; billing_tax_id: string | null; billing_address: string | null;
  tags: string[]; first_contact_date: string | null; created_at: string;
  job_title: string | null; industry: string | null; city: string | null; country: string | null;
  birthday: string | null; gender: string | null; nationality: string | null; national_id: string | null;
  website: string | null; whatsapp: string | null;
  instagram: string | null; facebook: string | null; linkedin: string | null; tiktok: string | null; youtube: string | null;
  preferred_contact_method: string | null; preferred_language: string | null;
  lifecycle_stage: string | null; lead_status: string | null; priority_level: string | null;
  rating: number | null; account_manager_id: string | null;
  credit_limit: number | null; payment_terms: string | null; discount_pct: number | null; currency: string | null;
};

const TYPE_AR: Record<string, string> = { teacher: "مدرس", reel_client: "عميل ريلز", service_client: "عميل خدمات" };
const LIFECYCLE_AR: Record<string, string> = { lead: "عميل محتمل", prospect: "مهتم", customer: "عميل", loyal: "عميل دائم", vip: "VIP", inactive: "غير نشط" };
const PRIORITY_AR: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", critical: "حرجة" };
const PRIORITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  critical: "bg-destructive/10 text-destructive",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`تم نسخ ${label}`));
}

function ClientProfilePage() {
  const { id } = useParams({ from: "/_authenticated/reception/clients/$id" });
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => (await supabase.from("contacts").select("*").eq("id", id).maybeSingle()).data as Contact | null,
  });

  const { data: bookings } = useQuery({
    queryKey: ["contact-bookings", id],
    queryFn: async () => (await supabase.from("bookings")
      .select("id, starts_at, ends_at, status, room:rooms(name_ar)")
      .eq("contact_id", id).order("starts_at", { ascending: false })).data ?? [],
  });

  const { data: payments } = useQuery({
    queryKey: ["contact-payments", id],
    queryFn: async () => (await supabase.from("payments")
      .select("id, amount, paid_at, method, notes").eq("contact_id", id).order("paid_at", { ascending: false })).data ?? [],
  });

  const { data: invoices } = useQuery({
    queryKey: ["contact-invoices", id],
    queryFn: async () => (await supabase.from("invoices")
      .select("id, invoice_number, issue_date, total, paid, status").eq("contact_id", id).order("issue_date", { ascending: false })).data ?? [],
  });

  const { data: packages } = useQuery({
    queryKey: ["contact-packages", id],
    queryFn: async () => (await supabase.from("studio_packages")
      .select("*").eq("contact_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: history } = useQuery({
    queryKey: ["contact-history", id],
    queryFn: async () => (await supabase.from("contact_history")
      .select("*").eq("contact_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const stats = useMemo(() => {
    const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const invoiced = (invoices ?? []).reduce((s, i) => s + Number(i.total), 0);
    const activeBookings = (bookings ?? []).filter((b) => !["cancelled","no_show","completed"].includes(String(b.status))).length;
    const upcomingBooking = (bookings ?? [])
      .filter((b) => new Date(b.starts_at).getTime() > Date.now() && b.status !== "cancelled")
      .sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
    return { paid, invoiced, outstanding: invoiced - paid, activeBookings, upcomingBooking };
  }, [payments, invoices, bookings]);

  if (isLoading) return <div className="text-center text-muted-foreground py-20">جاري التحميل...</div>;
  if (!contact) return <div className="text-center text-muted-foreground py-20">العميل غير موجود</div>;

  const currency = contact.currency ?? "EGP";
  const age = contact.birthday ? differenceInYears(new Date(), new Date(contact.birthday)) : null;
  const clientSince = formatDistanceToNow(new Date(contact.first_contact_date ?? contact.created_at), { locale: ar, addSuffix: false });
  const lastActivity = history?.[0]?.created_at ?? contact.created_at;
  const rating = contact.rating ?? 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <Link to="/reception/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> العودة للعملاء
        </Link>
        <div className="flex gap-2">
          {contact.phone && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${contact.phone}`}><Phone className="h-4 w-4 ml-1" /> اتصال</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://wa.me/${(contact.whatsapp ?? contact.phone).replace(/\D/g,"")}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 ml-1" /> واتساب
                </a>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
            <Plus className="h-4 w-4 ml-1" /> سجل تواصل
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 ml-1" /> تعديل
          </Button>
        </div>
      </div>

      {/* HERO */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <ClientCover contact={contact} onChanged={() => qc.invalidateQueries({ queryKey: ["contact", id] })} />
        <div className="px-6 pb-6 -mt-14">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div className="flex items-end gap-4">
              <ClientAvatar contact={contact} onChanged={() => qc.invalidateQueries({ queryKey: ["contact", id] })} />
              <div className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-bold tracking-tight">{contact.full_name}</h1>
                  {contact.priority_level && (
                    <Badge className={`${PRIORITY_TONE[contact.priority_level] ?? ""} border-0`}>
                      <AlertCircle className="h-3 w-3 ml-1" />
                      {PRIORITY_AR[contact.priority_level] ?? contact.priority_level}
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                  {contact.job_title && <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{contact.job_title}</span>}
                  {contact.job_title && contact.industry && <span>·</span>}
                  {contact.industry && <span>{contact.industry}</span>}
                  {(contact.city || contact.country) && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[contact.city, contact.country].filter(Boolean).join("، ")}</span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-normal">{TYPE_AR[contact.type] ?? contact.type}</Badge>
                  {contact.lifecycle_stage && (
                    <Badge variant="outline" className="bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                      <Sparkles className="h-3 w-3 ml-1" /> {LIFECYCLE_AR[contact.lifecycle_stage] ?? contact.lifecycle_stage}
                    </Badge>
                  )}
                  {(contact.tags ?? []).map((t) => (
                    <Badge key={t} variant="outline" className="bg-primary/5 border-primary/20">{t}</Badge>
                  ))}
                  {rating > 0 && (
                    <div className="flex items-center gap-0.5 pr-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-left pb-2 space-y-0.5">
              <div className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> عميل منذ {clientSince}</div>
              <div>آخر نشاط: {format(new Date(lastActivity), "d MMM yyyy", { locale: ar })}</div>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="border-t grid grid-cols-2 md:grid-cols-5 divide-x divide-x-reverse">
          <Kpi icon={<Calendar className="h-4 w-4" />} label="حجوزات نشطة" value={stats.activeBookings} sub={`${(bookings ?? []).length} إجمالي`} />
          <Kpi icon={<Wallet className="h-4 w-4" />} label="إجمالي مدفوع" value={`${stats.paid.toLocaleString()} ${currency}`} tone="ok" />
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="إجمالي الفواتير" value={`${stats.invoiced.toLocaleString()} ${currency}`} />
          <Kpi icon={<AlertCircle className="h-4 w-4" />} label="مستحق" value={`${stats.outstanding.toLocaleString()} ${currency}`} tone={stats.outstanding > 0 ? "warn" : "ok"} />
          <Kpi icon={<Package className="h-4 w-4" />} label="باقات" value={(packages ?? []).length} sub={`${(packages ?? []).filter((p) => p.is_active).length} نشطة`} />
        </div>
      </Card>

      {/* Upcoming banner */}
      {stats.upcomingBooking && (
        <Card className="p-4 bg-primary/5 border-primary/20 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">حجز قادم</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {format(new Date(stats.upcomingBooking.starts_at), "EEEE d MMMM yyyy — HH:mm", { locale: ar })}
              {(stats.upcomingBooking as { room?: { name_ar?: string } }).room?.name_ar &&
                ` · ${(stats.upcomingBooking as { room?: { name_ar?: string } }).room?.name_ar}`}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Sidebar with details */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-5">
            <SectionHeader icon={<User className="h-4 w-4" />} title="بيانات الاتصال" />
            <div className="space-y-2 text-sm">
              <ContactRow icon={<Phone className="h-3.5 w-3.5" />} value={contact.phone} ltr copyable label="هاتف" />
              <ContactRow icon={<MessageCircle className="h-3.5 w-3.5" />} value={contact.whatsapp} ltr copyable label="واتساب" href={contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g,"")}` : undefined} />
              <ContactRow icon={<Mail className="h-3.5 w-3.5" />} value={contact.email} ltr copyable label="بريد" href={contact.email ? `mailto:${contact.email}` : undefined} />
              <ContactRow icon={<Globe className="h-3.5 w-3.5" />} value={contact.website} ltr label="موقع" href={contact.website ?? undefined} />
              <ContactRow icon={<MapPin className="h-3.5 w-3.5" />} value={contact.address} label="عنوان" />
              <ContactRow icon={<Languages className="h-3.5 w-3.5" />} value={contact.preferred_language} label="لغة مفضلة" />
              <ContactRow icon={<MessagesSquare className="h-3.5 w-3.5" />} value={contact.preferred_contact_method} label="وسيلة تواصل مفضلة" />
            </div>

            {(contact.instagram || contact.facebook || contact.linkedin || contact.tiktok || contact.youtube || contact.social_handle) && (
              <>
                <Separator className="my-4" />
                <SectionHeader icon={<Sparkles className="h-4 w-4" />} title="سوشيال ميديا" />
                <div className="flex flex-wrap gap-2">
                  <SocialLink icon={<Instagram className="h-3.5 w-3.5" />} handle={contact.instagram} prefix="https://instagram.com/" />
                  <SocialLink icon={<Facebook className="h-3.5 w-3.5" />} handle={contact.facebook} prefix="https://facebook.com/" />
                  <SocialLink icon={<Linkedin className="h-3.5 w-3.5" />} handle={contact.linkedin} prefix="https://linkedin.com/in/" />
                  <SocialLink icon={<Youtube className="h-3.5 w-3.5" />} handle={contact.youtube} prefix="https://youtube.com/@" />
                  <SocialLink icon={<Sparkles className="h-3.5 w-3.5" />} handle={contact.tiktok} prefix="https://tiktok.com/@" />
                  {contact.social_handle && <SocialLink icon={<MessagesSquare className="h-3.5 w-3.5" />} handle={contact.social_handle} />}
                </div>
              </>
            )}
          </Card>

          <Card className="p-5">
            <SectionHeader icon={<IdCard className="h-4 w-4" />} title="بيانات شخصية" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="الجنس" value={contact.gender === "male" ? "ذكر" : contact.gender === "female" ? "أنثى" : contact.gender} />
              <Field label="الجنسية" value={contact.nationality} icon={<Flag className="h-3 w-3" />} />
              <Field label="تاريخ الميلاد" value={contact.birthday ? format(new Date(contact.birthday), "d MMM yyyy", { locale: ar }) : null} icon={<Cake className="h-3 w-3" />} />
              <Field label="العمر" value={age ? `${age} سنة` : null} />
              <Field label="الرقم القومي" value={contact.national_id} ltr />
              <Field label="المصدر" value={contact.source} />
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader icon={<Building2 className="h-4 w-4" />} title="بيانات الفوترة" />
            <div className="space-y-2 text-sm">
              <Field label="اسم الشركة" value={contact.billing_company_name} block />
              <Field label="الرقم الضريبي" value={contact.billing_tax_id} ltr block />
              <Field label="عنوان الفاتورة" value={contact.billing_address} block />
              <div className="grid grid-cols-2 gap-3">
                <Field label="حد الائتمان" value={contact.credit_limit != null ? `${Number(contact.credit_limit).toLocaleString()} ${currency}` : null} />
                <Field label="شروط الدفع" value={contact.payment_terms} />
                <Field label="نسبة الخصم" value={contact.discount_pct != null ? `${contact.discount_pct}%` : null} />
                <Field label="العملة" value={currency} />
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT: Tabs */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <SectionHeader icon={<FileText className="h-4 w-4" />} title="ملاحظات عامة" />
            <p className="text-sm whitespace-pre-line text-foreground/80 min-h-[40px]">
              {contact.notes || <span className="text-muted-foreground">لا توجد ملاحظات.</span>}
            </p>
            {contact.internal_notes && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> ملاحظات داخلية (للفريق فقط)
                </div>
                <p className="text-sm whitespace-pre-line text-foreground/80">{contact.internal_notes}</p>
              </div>
            )}
          </Card>

          <Tabs defaultValue="bookings">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="bookings"><Calendar className="h-3.5 w-3.5 ml-1" /> الحجوزات ({(bookings ?? []).length})</TabsTrigger>
              <TabsTrigger value="payments"><Wallet className="h-3.5 w-3.5 ml-1" /> المالية</TabsTrigger>
              <TabsTrigger value="packages"><Package className="h-3.5 w-3.5 ml-1" /> الباقات ({(packages ?? []).length})</TabsTrigger>
              <TabsTrigger value="usage"><Activity className="h-3.5 w-3.5 ml-1" /> سجل الاستخدام</TabsTrigger>
              <TabsTrigger value="history"><MessagesSquare className="h-3.5 w-3.5 ml-1" /> سجل التواصل ({(history ?? []).length})</TabsTrigger>
            </TabsList>

            <TabsContent value="usage" className="mt-4">
              <UsageLogsSection contactId={id} />
            </TabsContent>

            <TabsContent value="bookings" className="mt-4">

              <Card className="p-0 overflow-hidden">
                {(bookings ?? []).length === 0 ? <Empty text="لا حجوزات بعد" /> : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr>
                        <th className="text-right p-3">التاريخ</th>
                        <th className="text-right p-3">الوقت</th>
                        <th className="text-right p-3">الغرفة</th>
                        <th className="text-right p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings!.map((b) => {
                        const room = (b as { room?: { name_ar?: string } }).room;
                        return (
                          <tr key={b.id} className="border-t hover:bg-muted/20 transition-colors">
                            <td className="p-3 tabular-nums">{format(new Date(b.starts_at), "d MMM yyyy", { locale: ar })}</td>
                            <td className="p-3 tabular-nums">{format(new Date(b.starts_at), "HH:mm")} - {format(new Date(b.ends_at), "HH:mm")}</td>
                            <td className="p-3">{room?.name_ar ?? "—"}</td>
                            <td className="p-3"><Badge variant="outline" className="text-xs">{b.status}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5">
                  <h4 className="font-semibold mb-3">الفواتير</h4>
                  {(invoices ?? []).length === 0 ? <Empty text="لا فواتير" /> : (
                    <div className="space-y-2">
                      {invoices!.map((i) => (
                        <div key={i.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/30 transition-colors">
                          <div>
                            <div className="text-sm font-medium">#{i.invoice_number}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{format(new Date(i.issue_date), "yyyy/MM/dd")}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-left">
                              <div className="font-semibold tabular-nums">{Number(i.total).toLocaleString()} {currency}</div>
                              <Badge variant="outline" className="text-xs">{i.status}</Badge>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => printInvoice(i, contact)} title="طباعة">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                <Card className="p-5">
                  <h4 className="font-semibold mb-3">الدفعات</h4>
                  {(payments ?? []).length === 0 ? <Empty text="لا دفعات" /> : (
                    <div className="space-y-2">
                      {payments!.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <div className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                              +{Number(p.amount).toLocaleString()} {currency}
                            </div>
                            {p.method && <div className="text-xs text-muted-foreground">{p.method}</div>}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">{format(new Date(p.paid_at), "yyyy/MM/dd")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="packages" className="mt-4">
              {(packages ?? []).length === 0 ? <Card className="p-12"><Empty text="لا توجد باقات" /></Card> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {packages!.map((p) => {
                    const remaining = Number(p.total_hours) - Number(p.used_hours);
                    const pct = Number(p.total_hours) > 0 ? (Number(p.used_hours) / Number(p.total_hours)) * 100 : 0;
                    return (
                      <Card key={p.id} className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                              {p.is_active ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : null}
                              {p.is_active ? "نشطة" : "منتهية"}
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="text-sm tabular-nums">{Number(p.paid_amount).toLocaleString()} / {Number(p.total_amount).toLocaleString()} {currency}</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span>الساعات المستهلكة</span>
                            <span className="tabular-nums">{Number(p.used_hours).toFixed(1)} / {Number(p.total_hours).toFixed(1)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-gradient-to-l from-primary to-primary/60" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 tabular-nums">المتبقي: {remaining.toFixed(1)} ساعة</div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card className="p-5">
                {(history ?? []).length === 0 ? <Empty text="لا تواصل مسجل" /> : (
                  <div className="relative space-y-4 before:absolute before:right-4 before:top-2 before:bottom-2 before:w-px before:bg-border">
                    {history!.map((h) => (
                      <div key={h.id} className="relative flex gap-3 pr-1">
                        <div className="relative z-10 h-8 w-8 rounded-full bg-primary/10 grid place-items-center text-primary shrink-0 ring-4 ring-background">
                          <MessagesSquare className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">{h.event_type}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{format(new Date(h.created_at), "yyyy/MM/dd HH:mm")}</div>
                          </div>
                          {h.description && <div className="text-sm text-muted-foreground mt-1">{h.description}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <EditDialog open={editOpen} onOpenChange={setEditOpen} contact={contact}
        onSaved={() => qc.invalidateQueries({ queryKey: ["contact", id] })} />
      <AddNoteDialog open={noteOpen} onOpenChange={setNoteOpen} contactId={id}
        onSaved={() => qc.invalidateQueries({ queryKey: ["contact-history", id] })} />
    </div>
  );
}

/* --------------------------- helpers --------------------------- */

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; tone?: "warn" | "ok" }) {
  const toneClass = tone === "warn" ? "text-destructive" : tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
  return (
    <div className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${toneClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
      <span className="h-6 w-6 rounded-md bg-primary/10 text-primary grid place-items-center">{icon}</span>
      {title}
    </div>
  );
}

function ContactRow({ icon, value, label, ltr, copyable, href }: { icon: React.ReactNode; value: string | null; label: string; ltr?: boolean; copyable?: boolean; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 group py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        {href ? (
          <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={`truncate hover:text-primary hover:underline ${ltr ? "" : ""}`} dir={ltr ? "ltr" : undefined}>{value}</a>
        ) : (
          <span className="truncate" dir={ltr ? "ltr" : undefined}>{value}</span>
        )}
      </div>
      {copyable && (
        <button onClick={() => copy(value, label)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0">
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function SocialLink({ icon, handle, prefix }: { icon: React.ReactNode; handle: string | null; prefix?: string }) {
  if (!handle) return null;
  const cleaned = handle.replace(/^@/, "");
  const href = prefix ? `${prefix}${cleaned}` : undefined;
  const content = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-muted/30 hover:bg-muted transition-colors text-xs">
      {icon}<span dir="ltr">@{cleaned}</span>
      {href && <ExternalLink className="h-2.5 w-2.5 opacity-50" />}
    </span>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer">{content}</a> : content;
}

function Field({ label, value, ltr, icon, block }: { label: string; value: string | null | undefined; ltr?: boolean; icon?: React.ReactNode; block?: boolean }) {
  if (block) {
    return (
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={ltr ? "text-left" : ""} dir={ltr ? "ltr" : undefined}>{value || <span className="text-muted-foreground/60">—</span>}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={`font-medium ${ltr ? "text-left" : ""}`} dir={ltr ? "ltr" : undefined}>{value || <span className="text-muted-foreground/60 font-normal">—</span>}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-muted-foreground py-10 text-sm">{text}</div>;
}

function ClientCover({ contact, onChanged }: { contact: Contact; onChanged: () => void }) {
  const src = useContactImage(contact.cover_url);
  return (
    <div className="h-40 md:h-48 relative overflow-hidden group">
      {src ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-l from-primary/80 via-primary to-primary/60">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_50%,white,transparent_40%)]" />
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_20%,white,transparent_50%)]" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ImageUploadButton contactId={contact.id} kind="cover" onUploaded={onChanged} />
      </div>
    </div>
  );
}

function ClientAvatar({ contact, onChanged }: { contact: Contact; onChanged: () => void }) {
  const src = useContactImage(contact.avatar_url);
  return (
    <div className="relative group">
      <Avatar className="h-28 w-28 border-4 border-background shadow-xl ring-2 ring-primary/20">
        {src && <AvatarImage src={src} alt={contact.full_name} />}
        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-3xl font-bold">
          {initials(contact.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="absolute -bottom-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <ImageUploadButton
          contactId={contact.id}
          kind="avatar"
          onUploaded={onChanged}
          label=""
          className="h-8 w-8 rounded-full grid place-items-center bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
        />
      </div>
    </div>
  );
}

function printInvoice(
  inv: { invoice_number: string; issue_date: string; total: number | string; paid: number | string; status: string },
  contact: Contact,
) {
  const total = Number(inv.total).toFixed(2);
  const paid = Number(inv.paid).toFixed(2);
  const due = (Number(inv.total) - Number(inv.paid)).toFixed(2);
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <title>فاتورة ${inv.invoice_number}</title>
    <style>
      body{font-family:system-ui,Tahoma,Arial;padding:40px;color:#111}
      h1{margin:0 0 4px;font-size:28px}
      .muted{color:#666;font-size:13px}
      .row{display:flex;justify-content:space-between;margin:8px 0}
      table{width:100%;border-collapse:collapse;margin-top:24px}
      th,td{padding:10px;border-bottom:1px solid #eee;text-align:right}
      th{background:#f7f7f7}
      .totals{margin-top:24px;width:280px;margin-inline-start:auto}
      .totals .row{padding:6px 0;border-bottom:1px solid #eee}
      .totals .grand{font-size:20px;font-weight:700;border-top:2px solid #111;padding-top:10px}
      .stamp{margin-top:40px;padding:10px;border:2px dashed #999;text-align:center;color:#666}
      @media print{button{display:none}}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>فاتورة</h1>
        <div class="muted">#${inv.invoice_number}</div>
        <div class="muted">تاريخ: ${format(new Date(inv.issue_date), "yyyy/MM/dd")}</div>
      </div>
      <div style="text-align:left">
        <div style="font-weight:700;font-size:18px">4Creative Studio</div>
        <div class="muted">إيصال دفع رسمي</div>
      </div>
    </div>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
    <div><strong>العميل:</strong> ${contact.full_name}</div>
    ${contact.phone ? `<div class="muted">هاتف: ${contact.phone}</div>` : ""}
    ${contact.billing_company_name ? `<div class="muted">شركة: ${contact.billing_company_name}</div>` : ""}
    ${contact.billing_tax_id ? `<div class="muted">رقم ضريبي: ${contact.billing_tax_id}</div>` : ""}
    ${contact.billing_address ? `<div class="muted">${contact.billing_address}</div>` : ""}
    <table>
      <thead><tr><th>البيان</th><th style="width:140px">المبلغ</th></tr></thead>
      <tbody>
        <tr><td>قيمة الفاتورة #${inv.invoice_number}</td><td>${total} ج</td></tr>
      </tbody>
    </table>
    <div class="totals">
      <div class="row"><span>الإجمالي</span><span>${total} ج</span></div>
      <div class="row"><span>المدفوع</span><span>${paid} ج</span></div>
      <div class="row grand"><span>المتبقي</span><span>${due} ج</span></div>
    </div>
    <div class="stamp">الحالة: ${inv.status}</div>
    <div style="margin-top:40px;text-align:center">
      <button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer">طباعة</button>
    </div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
    </body></html>`);
  w.document.close();
}

/* --------------------------- Edit Dialog --------------------------- */

function EditDialog({ open, onOpenChange, contact, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; contact: Contact; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Contact>>({});
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm({ ...contact }); }, [open, contact]);

  const tags = form.tags ?? [];
  const set = <K extends keyof Contact>(k: K, v: Contact[K] | string) => setForm({ ...form, [k]: v as Contact[K] });

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    setForm({ ...form, tags: [...tags, t] });
    setTagInput("");
  }

  async function save() {
    const v = validateForm(contactSchema, {
      full_name: form.full_name, phone: form.phone, email: form.email, notes: form.notes,
    });
    if (!v.ok) return;
    setSaving(true);
    const payload = {
      full_name: form.full_name, type: form.type, phone: form.phone, email: form.email,
      address: form.address, social_handle: form.social_handle, avatar_url: form.avatar_url,
      source: form.source, notes: form.notes, internal_notes: form.internal_notes, tags: form.tags ?? [],
      billing_company_name: form.billing_company_name, billing_tax_id: form.billing_tax_id, billing_address: form.billing_address,
      job_title: form.job_title, industry: form.industry, city: form.city, country: form.country,
      birthday: form.birthday || null, gender: form.gender, nationality: form.nationality, national_id: form.national_id,
      website: form.website, whatsapp: form.whatsapp,
      instagram: form.instagram, facebook: form.facebook, linkedin: form.linkedin, tiktok: form.tiktok, youtube: form.youtube,
      preferred_contact_method: form.preferred_contact_method, preferred_language: form.preferred_language,
      lifecycle_stage: form.lifecycle_stage, lead_status: form.lead_status, priority_level: form.priority_level,
      rating: form.rating != null ? Number(form.rating) : null,
      credit_limit: form.credit_limit != null && form.credit_limit !== ("" as unknown as number) ? Number(form.credit_limit) : null,
      payment_terms: form.payment_terms,
      discount_pct: form.discount_pct != null && form.discount_pct !== ("" as unknown as number) ? Number(form.discount_pct) : null,
      currency: form.currency ?? "EGP",
    };
    const { error } = await supabase.from("contacts").update(payload as never).eq("id", contact.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث البروفايل");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>تعديل بروفايل العميل</DialogTitle></DialogHeader>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="basic">أساسي</TabsTrigger>
            <TabsTrigger value="contact">اتصال وسوشيال</TabsTrigger>
            <TabsTrigger value="personal">شخصي</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="billing">فوترة</TabsTrigger>
            <TabsTrigger value="notes">ملاحظات</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="الاسم الكامل" full><Input value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></F>
              <F label="النوع">
                <Select value={form.type ?? "teacher"} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">مدرس</SelectItem>
                    <SelectItem value="reel_client">عميل ريلز</SelectItem>
                    <SelectItem value="service_client">عميل خدمات</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="المسمى الوظيفي"><Input value={form.job_title ?? ""} onChange={(e) => set("job_title", e.target.value)} /></F>
              <F label="المجال / الصناعة"><Input value={form.industry ?? ""} onChange={(e) => set("industry", e.target.value)} /></F>
              <F label="رابط صورة شخصية" full><Input dir="ltr" value={form.avatar_url ?? ""} onChange={(e) => set("avatar_url", e.target.value)} /></F>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="هاتف"><Input dir="ltr" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></F>
              <F label="واتساب"><Input dir="ltr" value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} /></F>
              <F label="بريد إلكتروني"><Input dir="ltr" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></F>
              <F label="موقع إلكتروني"><Input dir="ltr" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} /></F>
              <F label="المدينة"><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></F>
              <F label="الدولة"><Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} /></F>
              <F label="العنوان التفصيلي" full><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></F>
              <F label="وسيلة تواصل مفضلة">
                <Select value={form.preferred_contact_method ?? ""} onValueChange={(v) => set("preferred_contact_method", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">هاتف</SelectItem>
                    <SelectItem value="whatsapp">واتساب</SelectItem>
                    <SelectItem value="email">بريد</SelectItem>
                    <SelectItem value="in_person">شخصي</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="لغة مفضلة">
                <Select value={form.preferred_language ?? ""} onValueChange={(v) => set("preferred_language", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="العربية">العربية</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <div className="col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                <F label="Instagram"><Input dir="ltr" placeholder="@handle" value={form.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} /></F>
                <F label="Facebook"><Input dir="ltr" value={form.facebook ?? ""} onChange={(e) => set("facebook", e.target.value)} /></F>
                <F label="LinkedIn"><Input dir="ltr" value={form.linkedin ?? ""} onChange={(e) => set("linkedin", e.target.value)} /></F>
                <F label="TikTok"><Input dir="ltr" value={form.tiktok ?? ""} onChange={(e) => set("tiktok", e.target.value)} /></F>
                <F label="YouTube"><Input dir="ltr" value={form.youtube ?? ""} onChange={(e) => set("youtube", e.target.value)} /></F>
                <F label="سوشيال ميديا أخرى"><Input dir="ltr" value={form.social_handle ?? ""} onChange={(e) => set("social_handle", e.target.value)} /></F>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="personal" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="تاريخ الميلاد"><Input type="date" value={form.birthday ?? ""} onChange={(e) => set("birthday", e.target.value)} /></F>
              <F label="الجنس">
                <Select value={form.gender ?? ""} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="الجنسية"><Input value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} /></F>
              <F label="الرقم القومي"><Input dir="ltr" value={form.national_id ?? ""} onChange={(e) => set("national_id", e.target.value)} /></F>
              <F label="المصدر"><Input value={form.source ?? ""} onChange={(e) => set("source", e.target.value)} /></F>
            </div>
          </TabsContent>

          <TabsContent value="crm" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="مرحلة العميل">
                <Select value={form.lifecycle_stage ?? ""} onValueChange={(v) => set("lifecycle_stage", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">عميل محتمل</SelectItem>
                    <SelectItem value="prospect">مهتم</SelectItem>
                    <SelectItem value="customer">عميل</SelectItem>
                    <SelectItem value="loyal">عميل دائم</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="الأولوية">
                <Select value={form.priority_level ?? ""} onValueChange={(v) => set("priority_level", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="critical">حرجة</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="حالة الليد"><Input value={form.lead_status ?? ""} onChange={(e) => set("lead_status", e.target.value)} placeholder="مثال: قيد التواصل" /></F>
              <F label="تقييم (0-5)">
                <Input type="number" min={0} max={5} value={form.rating ?? ""} onChange={(e) => set("rating", e.target.value === "" ? null : Number(e.target.value))} />
              </F>
              <div className="col-span-2 space-y-2">
                <Label>تاجز</Label>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button onClick={() => setForm({ ...form, tags: tags.filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="VIP، عميل دائم..." value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                  <Button type="button" variant="outline" onClick={addTag}>إضافة</Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="اسم الشركة (للفاتورة)" full><Input value={form.billing_company_name ?? ""} onChange={(e) => set("billing_company_name", e.target.value)} /></F>
              <F label="الرقم الضريبي"><Input dir="ltr" value={form.billing_tax_id ?? ""} onChange={(e) => set("billing_tax_id", e.target.value)} /></F>
              <F label="العملة">
                <Select value={form.currency ?? "EGP"} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EGP">EGP · جنيه مصري</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="SAR">SAR</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="عنوان الفاتورة" full><Input value={form.billing_address ?? ""} onChange={(e) => set("billing_address", e.target.value)} /></F>
              <F label="حد الائتمان"><Input type="number" value={form.credit_limit ?? ""} onChange={(e) => set("credit_limit", e.target.value === "" ? null : Number(e.target.value))} /></F>
              <F label="شروط الدفع"><Input value={form.payment_terms ?? ""} onChange={(e) => set("payment_terms", e.target.value)} placeholder="Net 30..." /></F>
              <F label="نسبة الخصم %"><Input type="number" value={form.discount_pct ?? ""} onChange={(e) => set("discount_pct", e.target.value === "" ? null : Number(e.target.value))} /></F>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-3 mt-4">
            <F label="ملاحظات عامة (تظهر للجميع)" full>
              <Textarea rows={4} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </F>
            <F label="ملاحظات داخلية (للفريق فقط)" full>
              <Textarea rows={4} value={form.internal_notes ?? ""} onChange={(e) => set("internal_notes", e.target.value)} />
            </F>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-2 ${full ? "col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* --------------------------- Note Dialog --------------------------- */

function AddNoteDialog({ open, onOpenChange, contactId, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; contactId: string; onSaved: () => void;
}) {
  const [eventType, setEventType] = useState("call");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!description.trim()) { toast.error("اكتب وصف للتواصل"); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("contact_history").insert({
      contact_id: contactId, event_type: eventType, description, created_by: u.user?.id ?? null,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت إضافة السجل");
    setDescription(""); onOpenChange(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إضافة سجل تواصل</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>نوع التواصل</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">مكالمة</SelectItem>
                <SelectItem value="whatsapp">واتساب</SelectItem>
                <SelectItem value="email">إيميل</SelectItem>
                <SelectItem value="visit">زيارة</SelectItem>
                <SelectItem value="meeting">اجتماع</SelectItem>
                <SelectItem value="note">ملاحظة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>الوصف</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
