import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Phone, Mail, GraduationCap, Film, Briefcase, X, UserPlus, User, MessageCircle, Building2, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { contactSchema, validateForm } from "@/lib/validation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useContactImage } from "@/components/contact-image";

type Contact = {
  id: string; full_name: string; type: string;
  phone?: string | null; email?: string | null; created_at: string;
  tags?: string[] | null;
  avatar_url?: string | null; cover_url?: string | null;
  job_title?: string | null; city?: string | null; country?: string | null;
  lifecycle_stage?: string | null; priority_level?: string | null;
};

export function ContactsView({ title = "العملاء والمدرسين", subtitle = "قاعدة العملاء الموحّدة" }: { title?: string; subtitle?: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [bookingFilter, setBookingFilter] = useState<string>("all");

  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => (await supabase.from("contacts").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: bookingsAgg } = useQuery({
    queryKey: ["contacts-bookings-agg"],
    queryFn: async () => (await supabase.from("bookings")
      .select("contact_id, starts_at, status")).data ?? [],
  });

  const bookingMap = useMemo(() => {
    const m = new Map<string, { total: number; upcoming: number }>();
    const now = Date.now();
    for (const b of bookingsAgg ?? []) {
      if (!b.contact_id) continue;
      const cur = m.get(b.contact_id) ?? { total: 0, upcoming: 0 };
      cur.total += 1;
      if (b.status !== "cancelled" && new Date(b.starts_at).getTime() > now) cur.upcoming += 1;
      m.set(b.contact_id, cur);
    }
    return m;
  }, [bookingsAgg]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts ?? []) (c.tags ?? []).forEach((t: string) => s.add(t));
    return Array.from(s).sort();
  }, [contacts]);

  const filtered = (contacts ?? []).filter((c) => {
    if (filter !== "all" && c.type !== filter) return false;
    if (search && !`${c.full_name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (tagFilter !== "all" && !(c.tags ?? []).includes(tagFilter)) return false;
    if (bookingFilter !== "all") {
      const stats = bookingMap.get(c.id) ?? { total: 0, upcoming: 0 };
      if (bookingFilter === "active" && stats.total === 0) return false;
      if (bookingFilter === "none" && stats.total > 0) return false;
      if (bookingFilter === "upcoming" && stats.upcoming === 0) return false;
    }
    return true;
  });

  const hasActiveFilters = filter !== "all" || tagFilter !== "all" || bookingFilter !== "all" || search.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <NewContactDialog onCreated={() => qc.invalidateQueries({ queryKey: ["contacts"] })} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pr-9" placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="teacher">مدرسين</TabsTrigger>
              <TabsTrigger value="reel_client">ريلز</TabsTrigger>
              <TabsTrigger value="service_client">خدمات</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="التاج" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التاجز</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={bookingFilter} onValueChange={setBookingFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="حالة الحجز" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="upcoming">لديه حجز قادم</SelectItem>
              <SelectItem value="active">لديه حجوزات</SelectItem>
              <SelectItem value="none">بدون حجوزات</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilter("all"); setTagFilter("all"); setBookingFilter("all"); }}>
              <X className="h-3.5 w-3.5 ml-1" /> مسح
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-3 tabular-nums">
          {filtered.length} عميل {hasActiveFilters && `(من ${(contacts ?? []).length})`}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا يوجد عملاء بعد. أضف أول عميل لبدء بناء قاعدة بياناتك.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => <ContactCard key={c.id} contact={c} stats={bookingMap.get(c.id)} />)}
        </div>
      )}
    </div>
  );
}

function ContactCard({ contact, stats }: { contact: Contact; stats?: { total: number; upcoming: number } }) {
  const Icon = contact.type === "teacher" ? GraduationCap : contact.type === "reel_client" ? Film : Briefcase;
  const cover = useContactImage(contact.cover_url);
  const avatar = useContactImage(contact.avatar_url);
  const priorityTone: Record<string, string> = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-amber-500 text-white",
    medium: "bg-blue-500 text-white",
    low: "bg-muted text-muted-foreground",
  };
  const location = [contact.city, contact.country].filter(Boolean).join("، ");
  const stopBubble = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <Link to="/reception/clients/$id" params={{ id: contact.id }} className="block group">
      <Card className="overflow-hidden hover:shadow-[var(--shadow-elegant)] hover:border-primary/30 transition-all cursor-pointer h-full flex flex-col">
        {/* Cover strip */}
        <div className="h-20 relative overflow-hidden">
          {cover ? (
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-l from-primary/70 via-primary/60 to-primary/40">
              <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_50%,white,transparent_45%)]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card/95 via-card/10 to-transparent" />
          {stats && stats.upcoming > 0 && (
            <Badge className="absolute top-2 left-2 bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] shadow-md">
              {stats.upcoming} قادم
            </Badge>
          )}
          {contact.priority_level && contact.priority_level !== "low" && (
            <Badge className={`absolute top-2 right-2 text-[10px] shadow-md ${priorityTone[contact.priority_level] ?? ""}`}>
              {contact.priority_level}
            </Badge>
          )}
        </div>

        <div className="px-4 pb-4 -mt-8 flex-1 flex flex-col">
          <div className="flex items-end gap-3">
            <Avatar className="h-14 w-14 border-4 border-card shadow-md ring-1 ring-border">
              {avatar && <AvatarImage src={avatar} alt={contact.full_name} />}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold">
                {contact.full_name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span>{typeAr(contact.type)}</span>
            </div>
          </div>

          <div className="mt-2 min-w-0">
            <div className="font-semibold truncate leading-tight">{contact.full_name}</div>
            {(contact.job_title || location) && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {contact.job_title}{contact.job_title && location ? " · " : ""}{location}
              </div>
            )}
          </div>

          {(contact.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {contact.tags!.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{t}</Badge>
              ))}
              {contact.tags!.length > 3 && (
                <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">+{contact.tags!.length - 3}</Badge>
              )}
            </div>
          )}

          {/* Quick actions */}
          {(contact.phone || contact.email) && (
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              {contact.phone && (
                <a onClick={stopBubble} href={`tel:${contact.phone}`}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border py-1.5 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors">
                  <Phone className="h-3 w-3" /> اتصال
                </a>
              )}
              {contact.phone && (
                <a onClick={stopBubble} href={`https://wa.me/${contact.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border py-1.5 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-600 transition-colors">
                  <MessageCircle className="h-3 w-3" /> واتساب
                </a>
              )}
              {contact.email && !contact.phone && (
                <a onClick={stopBubble} href={`mailto:${contact.email}`}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border py-1.5 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors">
                  <Mail className="h-3 w-3" /> بريد
                </a>
              )}
            </div>
          )}

          <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>منذ {format(new Date(contact.created_at), "yyyy/MM/dd")}</span>
            {stats && stats.total > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {stats.total} حجز
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function typeAr(t: string) {
  return ({ teacher: "مدرس", reel_client: "عميل ريلز", service_client: "عميل خدمات" } as Record<string, string>)[t] ?? t;
}

function NewContactDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const initial = {
    full_name: "", type: "teacher", job_title: "", industry: "",
    phone: "", whatsapp: "", email: "", website: "",
    city: "", country: "", address: "",
    instagram: "", facebook: "", linkedin: "", tiktok: "",
    gender: "", nationality: "", birthday: "", national_id: "",
    lifecycle_stage: "", priority_level: "", source: "",
    billing_company_name: "", billing_tax_id: "", billing_address: "",
    notes: "",
  };
  const [form, setForm] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const v = validateForm(contactSchema, {
      full_name: form.full_name,
      phone: form.phone,
      email: form.email,
      notes: form.notes,
    });
    if (!v.ok) return;
    setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(form)) {
      payload[k] = val === "" ? null : val;
    }
    payload.full_name = form.full_name;
    payload.type = form.type;
    payload.currency = "EGP";
    const { error } = await supabase.from("contacts").insert(payload as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إضافة العميل");
    setOpen(false);
    setForm(initial);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" /> عميل جديد</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[92vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-l from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center shadow-md">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">إضافة عميل جديد</DialogTitle>
              <DialogDescription>املأ البيانات الأساسية الآن، وباقي التفاصيل يمكن استكمالها من صفحة البروفايل.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="basic" className="flex-1 overflow-y-auto max-h-[calc(92vh-11rem)]">
          <div className="px-6 pt-4 sticky top-0 bg-background z-10 border-b">
            <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/60">
              <TabsTrigger value="basic" className="gap-1.5"><User className="h-3.5 w-3.5" /> أساسي</TabsTrigger>
              <TabsTrigger value="contact" className="gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> اتصال</TabsTrigger>
              <TabsTrigger value="social" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> سوشيال</TabsTrigger>
              <TabsTrigger value="personal" className="gap-1.5"><User className="h-3.5 w-3.5" /> شخصي</TabsTrigger>
              <TabsTrigger value="crm" className="gap-1.5">CRM</TabsTrigger>
              <TabsTrigger value="billing" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> فوترة</TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> ملاحظات</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="basic" className="mt-0 space-y-4">
              <SectionTitle icon={<User className="h-4 w-4" />} title="البيانات الأساسية" hint="الحقول المميزة بـ * مطلوبة" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FF label="الاسم الكامل" required full>
                  <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="مثال: أحمد محمد" />
                </FF>
                <FF label="النوع" required>
                  <Select value={form.type} onValueChange={(v) => set("type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">مدرس</SelectItem>
                      <SelectItem value="reel_client">عميل ريلز</SelectItem>
                      <SelectItem value="service_client">عميل خدمات</SelectItem>
                    </SelectContent>
                  </Select>
                </FF>
                <FF label="المسمى الوظيفي"><Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="مثال: مدرس رياضيات" /></FF>
                <FF label="المجال / الصناعة"><Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="تعليم، إعلانات، محتوى..." /></FF>
                <FF label="المصدر" full>
                  <Input placeholder="إعلانات / سوشيال ميديا / إحالة..." value={form.source} onChange={(e) => set("source", e.target.value)} />
                </FF>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="mt-0 space-y-4">
              <SectionTitle icon={<MessageCircle className="h-4 w-4" />} title="بيانات الاتصال والموقع" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FF label="الهاتف"><Input dir="ltr" placeholder="+20 100 000 0000" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></FF>
                <FF label="واتساب"><Input dir="ltr" placeholder="+20 100 000 0000" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></FF>
                <FF label="البريد الإلكتروني"><Input dir="ltr" type="email" placeholder="name@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} /></FF>
                <FF label="الموقع الإلكتروني"><Input dir="ltr" placeholder="https://" value={form.website} onChange={(e) => set("website", e.target.value)} /></FF>
                <FF label="المدينة"><Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="القاهرة" /></FF>
                <FF label="الدولة"><Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="مصر" /></FF>
                <FF label="العنوان التفصيلي" full><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></FF>
              </div>
            </TabsContent>

            <TabsContent value="social" className="mt-0 space-y-4">
              <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="حسابات التواصل الاجتماعي" hint="أدخل اسم المستخدم بدون @" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FF label="Instagram"><Input dir="ltr" placeholder="username" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} /></FF>
                <FF label="Facebook"><Input dir="ltr" placeholder="username" value={form.facebook} onChange={(e) => set("facebook", e.target.value)} /></FF>
                <FF label="TikTok"><Input dir="ltr" placeholder="username" value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)} /></FF>
                <FF label="LinkedIn"><Input dir="ltr" placeholder="username" value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} /></FF>
              </div>
            </TabsContent>

            <TabsContent value="personal" className="mt-0 space-y-4">
              <SectionTitle icon={<User className="h-4 w-4" />} title="بيانات شخصية" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FF label="تاريخ الميلاد"><Input type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} /></FF>
                <FF label="الجنس">
                  <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">ذكر</SelectItem>
                      <SelectItem value="female">أنثى</SelectItem>
                    </SelectContent>
                  </Select>
                </FF>
                <FF label="الجنسية"><Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="مصري" /></FF>
                <FF label="الرقم القومي"><Input dir="ltr" value={form.national_id} onChange={(e) => set("national_id", e.target.value)} /></FF>
              </div>
            </TabsContent>

            <TabsContent value="crm" className="mt-0 space-y-4">
              <SectionTitle title="تصنيف العميل (CRM)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FF label="مرحلة العميل">
                  <Select value={form.lifecycle_stage} onValueChange={(v) => set("lifecycle_stage", v)}>
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
                </FF>
                <FF label="الأولوية">
                  <Select value={form.priority_level} onValueChange={(v) => set("priority_level", v)}>
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                      <SelectItem value="critical">حرجة</SelectItem>
                    </SelectContent>
                  </Select>
                </FF>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="mt-0 space-y-4">
              <SectionTitle icon={<Building2 className="h-4 w-4" />} title="بيانات الفوترة" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FF label="اسم الشركة (للفاتورة)" full><Input value={form.billing_company_name} onChange={(e) => set("billing_company_name", e.target.value)} /></FF>
                <FF label="الرقم الضريبي" full><Input dir="ltr" value={form.billing_tax_id} onChange={(e) => set("billing_tax_id", e.target.value)} /></FF>
                <FF label="عنوان الفاتورة" full><Input value={form.billing_address} onChange={(e) => set("billing_address", e.target.value)} /></FF>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-4">
              <SectionTitle icon={<FileText className="h-4 w-4" />} title="ملاحظات إضافية" />
              <FF label="ملاحظات عامة عن العميل" full>
                <Textarea rows={5} value={form.notes} onChange={(e) => set("notes", e.target.value)}
                  placeholder="أي معلومات مفيدة عن العميل، تفضيلاته، ملاحظات مهمة..." />
              </FF>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2 sm:gap-2">
          <div className="text-xs text-muted-foreground me-auto flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            التغييرات تُحفظ عند الضغط على "حفظ"
          </div>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving || !form.full_name.trim()}>
            {saving ? "جاري الحفظ..." : "حفظ العميل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-1 border-b">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon && <span className="h-6 w-6 rounded-md bg-primary/10 text-primary grid place-items-center">{icon}</span>}
        {title}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function FF({ label, children, full, required }: { label: string; children: React.ReactNode; full?: boolean; required?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive mr-1">*</span>}
      </Label>
      {children}
    </div>
  );
}