import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PlusCircle, Search, Pencil, Trash2, Star, Phone, Mail, X, User, Briefcase, Wallet, Link2, StickyNote, Camera, Trash } from "lucide-react";
import { freelancerSchema, validateForm } from "@/lib/validation";
import { FreelancerProfileDialog, ActiveToggle } from "./freelancer-profile-dialog";

export type FreelancerScope = "studio" | "agency" | "both";

export const SPECIALTIES = [
  { value: "programming", label: "برمجة" },
  { value: "design", label: "ديزاين" },
  { value: "montage", label: "مونتاج" },
  { value: "writing", label: "كتابة" },
  { value: "ads", label: "إعلانات" },
  { value: "photography", label: "تصوير" },
  { value: "other", label: "أخرى" },
];

const RATE_KINDS = [
  { value: "per_project", label: "لكل مشروع" },
  { value: "hourly", label: "بالساعة" },
  { value: "per_month", label: "شهرياً" },
];

const SCOPE_LABELS: Record<FreelancerScope, string> = {
  studio: "استوديو",
  agency: "أجنسي",
  both: "الاثنين",
};

const CURRENCIES = ["EGP", "SAR", "USD", "AED", "EUR"];

export const PAYMENT_METHODS = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "bank", label: "تحويل بنكي" },
] as const;

import vodafoneLogo from "@/assets/wallets/vodafone.svg";
import orangeLogo from "@/assets/wallets/orange.svg";
import etisalatLogo from "@/assets/wallets/etisalat.svg";
import weLogo from "@/assets/wallets/we.svg";
import instapayLogo from "@/assets/wallets/instapay.svg";

export const WALLETS = [
  { value: "vodafone_cash", label: "فودافون كاش", logo: vodafoneLogo, bg: "#ffffff" },
  { value: "orange_cash",   label: "اورنج كاش",   logo: orangeLogo,   bg: "#ffffff" },
  { value: "etisalat_cash", label: "اتصالات كاش", logo: etisalatLogo, bg: "#ffffff" },
  { value: "we_cash",       label: "وي",          logo: weLogo,       bg: "#ffffff" },
  { value: "instapay",      label: "انستا باي",   logo: instapayLogo, bg: "#ffffff" },
] as const;

export function WalletLogo({ provider, size = 32 }: { provider: string; size?: number }) {
  const w = WALLETS.find((x) => x.value === provider);
  if (!w) return null;
  return (
    <span
      className="inline-flex items-center justify-center rounded-md shrink-0 ring-1 ring-black/5 bg-white p-1"
      style={{ height: size, minWidth: size }}
      aria-label={w.label}
    >
      <img src={w.logo} alt={w.label} className="h-full w-auto max-w-[64px] object-contain" />
    </span>
  );
}

const CONTACT_METHODS = [
  { value: "whatsapp", label: "واتساب" },
  { value: "email", label: "إيميل" },
  { value: "phone", label: "اتصال" },
];

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
};

/** Reusable freelancers management panel. Scope filter defaults per-context. */
export function FreelancersManager({
  scopeFilter = "all",
  defaultScope = "agency",
  title = "الفريلانسرز",
  subtitle = "إدارة الفريلانسرز والمتعاونين",
  allowScopeChange = true,
}: {
  scopeFilter?: FreelancerScope | "all";
  defaultScope?: FreelancerScope;
  title?: string;
  subtitle?: string;
  allowScopeChange?: boolean;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState<string>("all");
  const [editing, setEditing] = useState<Freelancer | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const { data: freelancers = [] } = useQuery({
    queryKey: ["freelancers", scopeFilter],
    queryFn: async () => {
      let q = supabase.from("freelancers").select("*").order("created_at", { ascending: false });
      if (scopeFilter !== "all") q = q.or(`scope.eq.${scopeFilter},scope.eq.both`);
      return ((await q).data ?? []) as Freelancer[];
    },
  });

  const filtered = freelancers.filter((f) => {
    if (specialty !== "all" && f.specialty !== specialty) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (f.full_name ?? "").toLowerCase().includes(q) || (f.phone ?? "").includes(q) || (f.email ?? "").toLowerCase().includes(q);
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("freelancers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["freelancers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (p: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("freelancers").update({ is_active: p.is_active }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["freelancers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <FreelancerDialog defaultScope={defaultScope} allowScopeChange={allowScopeChange} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الهاتف أو الإيميل" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التخصصات</SelectItem>
            {SPECIALTIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا يوجد فريلانسرز</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((f) => (
            <FreelancerCard
              key={f.id}
              f={f}
              onOpen={() => setViewingId(f.id)}
              onEdit={() => setEditing(f)}
              onDelete={() => { if (confirm(`حذف ${f.full_name}؟`)) remove.mutate(f.id); }}
              onToggleActive={() => toggleActive.mutate({ id: f.id, is_active: !f.is_active })}
            />
          ))}
        </div>
      )}

      {editing && <FreelancerDialog editing={editing} onClose={() => setEditing(null)} defaultScope={defaultScope} allowScopeChange={allowScopeChange} />}
      <FreelancerProfileDialog
        freelancer={freelancers.find((f) => f.id === viewingId) ?? null}
        open={!!viewingId}
        onOpenChange={(v) => !v && setViewingId(null)}
      />
    </div>
  );
}

function FreelancerCard({ f, onOpen, onEdit, onDelete, onToggleActive }: {
  f: Freelancer;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const initials = (f.full_name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const specialtyLabel = SPECIALTIES.find((s) => s.value === f.specialty)?.label ?? f.specialty;
  return (
    <Card className="overflow-hidden group relative hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/60">
      <button onClick={onOpen} className="block w-full text-right">
        {/* Cover */}
        <div className="h-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,#a78bfa_0%,transparent_50%),radial-gradient(circle_at_75%_35%,#f472b6_0%,transparent_50%),linear-gradient(135deg,#6366f1,#8b5cf6_45%,#ec4899)]" />
          <div className="absolute inset-0 opacity-25 mix-blend-overlay" style={{backgroundImage:"radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize:"10px 10px"}} />
          <div className="absolute top-2 left-2 flex gap-1">
            <Badge variant="secondary" className="text-[10px] bg-white/95 text-slate-700 border-0 backdrop-blur shadow-sm">{SCOPE_LABELS[f.scope]}</Badge>
          </div>
          {f.rating ? (
            <div className="absolute top-2 right-2 flex items-center gap-0.5 text-[10px] bg-white/95 text-amber-600 rounded-full px-1.5 py-0.5 shadow-sm font-semibold">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{f.rating}
            </div>
          ) : null}
        </div>
        <div className="px-4 pb-3 -mt-10">
          <div className="relative inline-block">
            {f.avatar_url ? (
              <img src={f.avatar_url} alt="" className="w-20 h-20 rounded-2xl object-cover border-4 border-background shadow-md ring-1 ring-black/5" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold border-4 border-background shadow-md ring-1 ring-black/5">
                {initials || "؟"}
              </div>
            )}
          </div>
          <div className="mt-2.5">
            <div className="font-bold text-base truncate leading-tight">{f.full_name}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
              <span>{specialtyLabel}</span>
              {f.city && <><span className="text-muted-foreground/40">•</span><span>{f.city}</span></>}
            </div>
          </div>
          {f.skills && f.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5 min-h-[22px]">
              {f.skills.slice(0, 3).map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{s}</Badge>
              ))}
              {f.skills.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{f.skills.length - 3}</Badge>}
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed">
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">السعر</div>
              <div className="tabular-nums font-bold text-emerald-600 text-sm truncate">
                {f.rate_amount ? `${Number(f.rate_amount).toLocaleString("en-US")} ${f.currency || "EGP"}` : "—"}
              </div>
            </div>
            {f.years_experience != null && (
              <div className="text-left min-w-0">
                <div className="text-[10px] text-muted-foreground">خبرة</div>
                <div className="font-bold text-sm tabular-nums">{f.years_experience} سنة</div>
              </div>
            )}
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between border-t bg-muted/40 px-2 py-1.5">
        <ActiveToggle active={f.is_active} onToggle={onToggleActive} size="sm" />
        <div className="flex">
          {f.phone && (
            <a href={`https://wa.me/${f.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-emerald-600" title="واتساب"><Phone className="h-3.5 w-3.5" /></Button>
            </a>
          )}
          {f.email && (
            <a href={`mailto:${f.email}`} onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-blue-600" title="إيميل"><Mail className="h-3.5 w-3.5" /></Button>
            </a>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete} title="حذف"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      </div>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, tone }: { icon: React.ElementType; title: string; tone: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-border/60">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="font-bold text-sm">{title}</h3>
    </div>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => onChange(value === n ? 0 : n)}
          className="transition-transform hover:scale-110"
          aria-label={`تقييم ${n}`}
        >
          <Star className={`h-6 w-6 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

function FreelancerDialog({
  editing, onClose, defaultScope = "agency", allowScopeChange = true,
}: { editing?: Freelancer; onClose?: () => void; defaultScope?: FreelancerScope; allowScopeChange?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(!!editing);
  const empty = {
    full_name: "", specialty: "programming", scope: defaultScope as FreelancerScope,
    rate_kind: "per_project", rate_amount: "", phone: "", email: "",
    rating: 0, notes: "",
    city: "", country: "", years_experience: "", availability: "available",
    portfolio_url: "", linkedin_url: "", instagram_url: "", behance_url: "",
    skills: [] as string[], languages: "",
    currency: "EGP", payment_method: "", preferred_contact: "whatsapp",
    wallet_provider: "", wallet_number: "",
    bank_name: "", iban: "", bank_account_holder: "", bank_account_number: "", bank_branch: "",
    avatar_url: "", is_active: true,
  };
  const [form, setForm] = useState(
    editing
      ? {
          full_name: editing.full_name, specialty: editing.specialty, scope: editing.scope, rate_kind: editing.rate_kind,
          rate_amount: editing.rate_amount?.toString() ?? "", phone: editing.phone ?? "", email: editing.email ?? "",
          rating: editing.rating ?? 0, notes: editing.notes ?? "",
          city: editing.city ?? "", country: editing.country ?? "",
          years_experience: editing.years_experience?.toString() ?? "",
          availability: editing.availability ?? "available",
          portfolio_url: editing.portfolio_url ?? "", linkedin_url: editing.linkedin_url ?? "",
          instagram_url: editing.instagram_url ?? "", behance_url: editing.behance_url ?? "",
          skills: editing.skills ?? [], languages: editing.languages ?? "",
          currency: editing.currency ?? "EGP",
          payment_method: editing.payment_method ?? "",
          wallet_provider: editing.wallet_provider ?? "",
          wallet_number: editing.wallet_number ?? "",
          bank_name: editing.bank_name ?? "",
          iban: editing.iban ?? "",
          bank_account_holder: editing.bank_account_holder ?? "",
          bank_account_number: editing.bank_account_number ?? "",
          bank_branch: editing.bank_branch ?? "",
          preferred_contact: editing.preferred_contact ?? "whatsapp",
          avatar_url: editing.avatar_url ?? "", is_active: editing.is_active,
        }
      : empty,
  );
  const [skillInput, setSkillInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("اختر ملف صورة"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("الحجم أكبر من 5 ميجا"); return; }
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error("فشل قراءة الصورة"));
        r.readAsDataURL(file);
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("صورة غير صالحة")); });
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      setForm((f) => ({ ...f, avatar_url: canvas.toDataURL("image/jpeg", 0.82) }));
    } catch (e) { toast.error((e as Error).message); }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || form.skills.includes(s)) return;
    setForm({ ...form, skills: [...form.skills, s] });
    setSkillInput("");
  };
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); }
  };
  const removeSkill = (s: string) => setForm({ ...form, skills: form.skills.filter((x) => x !== s) });

  const save = useMutation({
    mutationFn: async () => {
      const v = validateForm(freelancerSchema, {
        full_name: form.full_name, phone: form.phone, email: form.email,
        specialty: form.specialty, hourly_rate: form.rate_amount, notes: form.notes,
      });
      if (!v.ok) throw new Error(v.message);
      const payload = {
        full_name: form.full_name, specialty: form.specialty as never, scope: form.scope as never,
        rate_kind: form.rate_kind as never,
        rate_amount: form.rate_amount ? parseFloat(form.rate_amount) : null,
        phone: form.phone || null, email: form.email || null,
        rating: form.rating || null, notes: form.notes || null,
        city: form.city || null, country: form.country || null,
        years_experience: form.years_experience ? parseInt(form.years_experience) : null,
        availability: form.availability,
        portfolio_url: form.portfolio_url || null, linkedin_url: form.linkedin_url || null,
        instagram_url: form.instagram_url || null, behance_url: form.behance_url || null,
        skills: form.skills.length ? form.skills : null, languages: form.languages || null,
        currency: form.currency || null,
        payment_method: form.payment_method || null,
        wallet_provider: form.payment_method === "wallet" ? (form.wallet_provider || null) : null,
        wallet_number: form.payment_method === "wallet" ? (form.wallet_number || null) : null,
        bank_name: form.payment_method === "bank" ? (form.bank_name || null) : null,
        iban: form.payment_method === "bank" ? (form.iban || null) : null,
        bank_account_holder: form.payment_method === "bank" ? (form.bank_account_holder || null) : null,
        bank_account_number: form.payment_method === "bank" ? (form.bank_account_number || null) : null,
        bank_branch: form.payment_method === "bank" ? (form.bank_branch || null) : null,
        preferred_contact: form.preferred_contact || null,
        avatar_url: form.avatar_url || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("freelancers").update(payload as never).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("freelancers").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم الحفظ" : "تمت الإضافة");
      setOpen(false); onClose?.();
      if (!editing) setForm(empty);
      qc.invalidateQueries({ queryKey: ["freelancers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOpen = (v: boolean) => { setOpen(v); if (!v) onClose?.(); };

  const initials = form.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "؟";

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!editing && (
        <DialogTrigger asChild>
          <Button className="rounded-lg gap-1"><PlusCircle className="h-4 w-4" /> فريلانسر جديد</Button>
        </DialogTrigger>
      )}
      <DialogContent dir="rtl" className="max-w-3xl p-0 gap-0 max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl">{editing ? "تعديل بيانات الفريلانسر" : "إضافة فريلانسر جديد"}</DialogTitle>
              <DialogDescription>أدخل بيانات المحترف المهنية والمالية لبناء قاعدة بيانات كاملة.</DialogDescription>
            </div>
            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.is_active ? "bg-emerald-500/10 border-emerald-200 text-emerald-700" : "bg-muted border-border text-muted-foreground"}`}>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-xs font-semibold">{form.is_active ? "نشط" : "متوقف"}</span>
            </label>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-6 space-y-8 flex-1">
          {/* Personal */}
          <section>
            <SectionHeader icon={User} title="البيانات الشخصية" tone="bg-indigo-500/10 text-indigo-600" />
            <div className="flex flex-col md:flex-row gap-5 items-start">
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-md group">
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                      {initials}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                  >
                    <Camera className="h-6 w-6" />
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickAvatar(f); e.target.value = ""; }}
                />
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => fileRef.current?.click()}>
                    <Camera className="h-3 w-3" />
                    {form.avatar_url ? "تغيير" : "رفع صورة"}
                  </Button>
                  {form.avatar_url && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setForm({ ...form, avatar_url: "" })}>
                      <Trash className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">الاسم الكامل *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="مثلاً: محمد أحمد" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">التليفون</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01xxxxxxxxx" dir="ltr" className="text-right" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">الإيميل</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" dir="ltr" className="text-right" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">المدينة</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="القاهرة" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">الدولة</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="مصر" />
                </div>
              </div>
            </div>
          </section>

          {/* Professional */}
          <section>
            <SectionHeader icon={Briefcase} title="البيانات المهنية" tone="bg-emerald-500/10 text-emerald-600" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">التخصص</Label>
                <Select value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {allowScopeChange && (
                <div>
                  <Label className="text-xs mb-1.5 block">نطاق العمل</Label>
                  <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as FreelancerScope })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="studio">استوديو فقط</SelectItem>
                      <SelectItem value="agency">أجنسي فقط</SelectItem>
                      <SelectItem value="both">الاثنين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs mb-1.5 block">سنوات الخبرة</Label>
                <Input type="number" min={0} value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} placeholder="0" />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs mb-1.5 block">اللغات</Label>
                <Input value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} placeholder="العربية، الإنجليزية" />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs mb-1.5 block">المهارات</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[42px] items-center bg-background">
                  {form.skills.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1 pr-2 pl-1">
                      {s}
                      <button type="button" onClick={() => removeSkill(s)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                  <input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={onSkillKey}
                    onBlur={addSkill}
                    placeholder={form.skills.length ? "أضف مهارة..." : "اكتب مهارة واضغط Enter"}
                    className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Rates & Payment */}
          <section>
            <SectionHeader icon={Wallet} title="التسعير والدفع" tone="bg-amber-500/10 text-amber-600" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">نوع التسعير</Label>
                <Select value={form.rate_kind} onValueChange={(v) => setForm({ ...form, rate_kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RATE_KINDS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">المبلغ</Label>
                <Input type="number" value={form.rate_amount} onChange={(e) => setForm({ ...form, rate_amount: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">العملة</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs mb-1.5 block">وسيلة الدفع</Label>
                <div className="flex gap-2 flex-wrap">
                  {PAYMENT_METHODS.map((p) => {
                    const active = form.payment_method === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setForm({ ...form, payment_method: active ? "" : p.value })}
                        className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background hover:bg-muted border-input"}`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.payment_method === "wallet" && (
                <>
                  <div className="md:col-span-3">
                    <Label className="text-xs mb-1.5 block">نوع المحفظة</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {WALLETS.map((w) => {
                        const active = form.wallet_provider === w.value;
                        return (
                          <button
                            key={w.value}
                            type="button"
                            onClick={() => setForm({ ...form, wallet_provider: w.value })}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all ${active ? "border-primary ring-2 ring-primary/25 bg-primary/5" : "border-input hover:bg-muted"}`}
                          >
                            <span className="h-9 flex items-center justify-center bg-white rounded-md ring-1 ring-black/5 px-2 py-1 w-full">
                              <img src={w.logo} alt={w.label} className="max-h-7 max-w-full object-contain" />
                            </span>
                            <span className="text-xs font-medium text-center leading-tight">{w.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs mb-1.5 block">رقم المحفظة</Label>
                    <Input
                      value={form.wallet_number}
                      onChange={(e) => setForm({ ...form, wallet_number: e.target.value })}
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                      className="text-right font-mono"
                    />
                  </div>
                </>
              )}

              {form.payment_method === "bank" && (
                <>
                  <div>
                    <Label className="text-xs mb-1.5 block">اسم البنك</Label>
                    <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="مثال: البنك الأهلي" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">اسم صاحب الحساب</Label>
                    <Input value={form.bank_account_holder} onChange={(e) => setForm({ ...form, bank_account_holder: e.target.value })} placeholder="الاسم كما هو بالحساب" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">الفرع</Label>
                    <Input value={form.bank_branch} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} placeholder="اسم الفرع" />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs mb-1.5 block">رقم الحساب</Label>
                    <Input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} placeholder="0000000000" dir="ltr" className="text-right font-mono" />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs mb-1.5 block">رقم الآيبان (IBAN)</Label>
                    <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="EG00 0000 0000 ..." dir="ltr" className="text-right font-mono" />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Links & Contact */}
          <section>
            <SectionHeader icon={Link2} title="الروابط والتواصل" tone="bg-blue-500/10 text-blue-600" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs mb-1.5 block">رابط معرض الأعمال (Portfolio)</Label>
                <Input value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} placeholder="https://behance.net/username" dir="ltr" className="text-right" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">LinkedIn</Label>
                <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="linkedin.com/in/..." dir="ltr" className="text-right" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Instagram</Label>
                <Input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} placeholder="@username" dir="ltr" className="text-right" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs mb-1.5 block">وسيلة التواصل المفضلة</Label>
                <div className="flex gap-2 flex-wrap">
                  {CONTACT_METHODS.map((m) => (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => setForm({ ...form, preferred_contact: m.value })}
                      className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                        form.preferred_contact === m.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Notes & Rating */}
          <section>
            <SectionHeader icon={StickyNote} title="تقييم وملاحظات" tone="bg-purple-500/10 text-purple-600" />
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1.5 block">التقييم</Label>
                <StarInput value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">ملاحظات إضافية</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="أي تفاصيل أخرى عن الفريلانسر..." />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="min-w-[140px]">
            {save.isPending ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إضافة الفريلانسر"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}