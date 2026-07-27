import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Camera, MapPin, Phone, Mail, Calendar, Briefcase, Clock, CheckCircle2, ListTodo, Sparkles, Cake, Shield, Pencil, ArrowRight, AtSign, Users, FileDown } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";

const fmtTimeEG = (d: Date) =>
  d.toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
const fmtDateTimeEG = (d: Date) =>
  `${d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" })} ${d.toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: true })}`;
import { toast } from "sonner";
import { getEmployeeProfile, getEmployeeTasks, updateOwnProfile } from "@/lib/profile.functions";
import { listUserAttendance } from "@/lib/attendance.functions";
import { useAvatarSrc } from "@/components/avatar-image";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/profile/$userId")({
  head: () => ({ meta: [{ title: "بروفايل الموظف — 4Creative" }] }),
  component: ProfilePage,
});

function fmtHMS(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}س ${m.toString().padStart(2, "0")}د ${sec.toString().padStart(2, "0")}ث`;
}

const MAX_SESSION_SECS = 12 * 3600;
const TODAY_ISO = () => new Date().toISOString().slice(0, 10);
function sessionSecs(l: { check_in: string; check_out: string | null; work_date: string }) {
  const start = new Date(l.check_in);
  if (l.check_out) return Math.min(MAX_SESSION_SECS, Math.max(0, differenceInSeconds(new Date(l.check_out), start)));
  if (l.work_date !== TODAY_ISO()) return 0;
  return Math.min(MAX_SESSION_SECS, Math.max(0, differenceInSeconds(new Date(), start)));
}

type AttPeriod = "day" | "week" | "month" | "year" | "all";
function periodStart(p: AttPeriod): string | null {
  if (p === "all") return null;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === "week") d.setDate(d.getDate() - 7);
  else if (p === "month") d.setDate(d.getDate() - 30);
  else if (p === "year") d.setDate(d.getDate() - 365);
  return d.toISOString().slice(0, 10);
}

const roleLabels: Record<string, string> = {
  super_admin: "مدير عام",
  admin: "مدير",
  dept_manager: "مدير قسم",
  dept_assistant: "مساعد قسم",
  reception: "استقبال",
  staff: "موظف",
  viewer: "مشاهد",
  editor: "مونتير",
  designer: "مصمم",
  photographer: "مصور",
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار", started: "قيد التنفيذ", progress_50: "50٪", in_review: "قيد المراجعة",
  submitted: "مُرسل", approved: "معتمد", rejected: "مرفوض", archived: "مؤرشف",
  accepted: "مقبول", shooting_started: "بدأ التصوير", shooting_done: "انتهى التصوير",
  uploaded: "تم الرفع", completed: "مكتمل",
};

function ProfilePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUid(data.user?.id ?? null));
  }, []);

  const getProfileFn = useServerFn(getEmployeeProfile);
  const getTasksFn = useServerFn(getEmployeeTasks);
  const listAttFn = useServerFn(listUserAttendance);

  const { data: pdata, isLoading, error } = useQuery({
    queryKey: ["employee-profile", userId],
    queryFn: () => getProfileFn({ data: { user_id: userId } }),
  });

  const { data: tasks } = useQuery({
    queryKey: ["employee-tasks", userId],
    queryFn: () => getTasksFn({ data: { user_id: userId, limit: 100 } }),
    enabled: !!pdata,
  });

  const { data: attendance } = useQuery({
    queryKey: ["employee-attendance", userId],
    queryFn: () => listAttFn({ data: { user_id: userId, limit: 200 } }),
    enabled: !!pdata && (currentUid === userId || (pdata && "profile" in pdata)),
  });

  const avatarSrc = useAvatarSrc(pdata?.profile?.avatar_url ?? null);
  const coverSrc = useAvatarSrc(pdata?.profile?.cover_url ?? null);

  if (isLoading) {
    return <div className="text-center py-16 text-muted-foreground">جارٍ تحميل البروفايل...</div>;
  }
  if (error || !pdata) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-destructive">{(error as Error)?.message ?? "تعذّر تحميل البروفايل"}</p>
        <Button variant="outline" onClick={() => navigate({ to: "/hr" })}>العودة للموارد البشرية</Button>
      </div>
    );
  }

  const p = pdata.profile;
  const name = p.name_ar ?? p.display_name ?? p.username ?? "موظف";
  const isSelf = currentUid === userId;

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header Card: cover + identity */}
      <Card className="overflow-hidden p-0 rounded-3xl border-white/10 dark:border-white/5 shadow-xl bg-card/60 backdrop-blur-xl relative">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative h-44 md:h-56" style={{
          background: coverSrc
            ? `url(${coverSrc}) center/cover`
            : "linear-gradient(135deg, hsl(var(--primary)/0.95), hsl(var(--primary)/0.55))",
        }}>
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.35),transparent_60%)]" />
          <Button variant="ghost" size="sm"
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white border border-white/25 rounded-xl shadow-lg"
            onClick={() => navigate({ to: "/hr" })}>
            <ArrowRight className="h-4 w-4 ml-1" /> رجوع
          </Button>
        </div>

        <div className="px-6 md:px-8 pb-7 -mt-16 md:-mt-20 relative">
          <div className="flex flex-col md:flex-row md:items-end gap-5">
            <div className="relative">
              <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-br from-primary/60 via-violet-500/50 to-primary/30 blur-md opacity-70" />
              <Avatar className="relative h-28 w-28 md:h-36 md:w-36 rounded-3xl ring-4 ring-card/80 shadow-2xl backdrop-blur-xl">
                {avatarSrc ? <AvatarImage src={avatarSrc} alt={name} className="rounded-3xl" /> : null}
                <AvatarFallback className="rounded-3xl bg-primary/10 text-primary text-3xl font-bold">
                  {name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {p.is_active !== false && (
                <span className="absolute bottom-2 right-2 h-5 w-5 rounded-full bg-emerald-500 ring-4 ring-card shadow-lg shadow-emerald-500/40" />
              )}
            </div>

            <div className="flex-1 min-w-0 md:pb-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{name}</h1>
                {pdata.roles.map((r) => (
                  <Badge key={r} variant="secondary"
                    className="rounded-full bg-primary/10 text-primary border border-primary/20 gap-1 px-3 py-0.5 font-semibold">
                    <Shield className="h-3 w-3" /> {roleLabels[r] ?? r}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {p.job_title ?? pdata.department?.name_ar ?? "موظف في 4Creative"}
                </span>
                {p.username && (
                  <>
                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span className="flex items-center gap-1 text-primary/80" dir="ltr">
                      <AtSign className="h-3.5 w-3.5" />{p.username}
                    </span>
                  </>
                )}
                {pdata.department && (
                  <>
                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />{pdata.department.name_ar}
                    </span>
                  </>
                )}
                {p.is_active === false && <Badge variant="destructive">معطّل</Badge>}
              </div>
            </div>

            {isSelf && (
              <Button onClick={() => setEditOpen(true)} className="md:mb-2 rounded-xl shadow-sm gap-2">
                <Pencil className="h-4 w-4" /> تعديل البروفايل
              </Button>
            )}
          </div>

          {p.bio && (
            <p className="mt-5 text-sm leading-relaxed text-foreground/80 max-w-3xl p-4 rounded-2xl bg-muted/40 border border-white/5 backdrop-blur-sm">{p.bio}</p>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ListTodo} label="إجمالي المهام" value={pdata.task_stats.total} tone="primary" />
        <StatCard icon={CheckCircle2} label="مهام مكتملة" value={pdata.task_stats.completed} tone="emerald" />
        <StatCard icon={Clock} label="إجمالي ساعات العمل" value={fmtHMS(pdata.attendance_stats.total_seconds)} small tone="amber" />
        <StatCard icon={Calendar} label="أيام حضور" value={pdata.attendance_stats.days_attended} tone="violet" />
      </div>

      <Tabs defaultValue="about" className="space-y-4">
        <TabsList className="relative w-full h-auto p-1.5 bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-2xl border border-white/10 rounded-2xl justify-start gap-1 shadow-lg shadow-primary/5 overflow-hidden">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-violet-500/20 blur-3xl" />
          <TabsTrigger
            value="about"
            className="relative z-10 flex-1 sm:flex-none rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground gap-2 shadow-none transition-all duration-300 hover:text-foreground hover:bg-white/5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-violet-600 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/40 data-[state=active]:scale-[1.02]"
          ><Sparkles className="h-4 w-4" />نظرة عامة</TabsTrigger>
          <TabsTrigger
            value="tasks"
            className="relative z-10 flex-1 sm:flex-none rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground gap-2 shadow-none transition-all duration-300 hover:text-foreground hover:bg-white/5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-violet-600 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/40 data-[state=active]:scale-[1.02]"
          ><ListTodo className="h-4 w-4" />المهام</TabsTrigger>
          <TabsTrigger
            value="attendance"
            className="relative z-10 flex-1 sm:flex-none rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground gap-2 shadow-none transition-all duration-300 hover:text-foreground hover:bg-white/5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-violet-600 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/40 data-[state=active]:scale-[1.02]"
          ><Clock className="h-4 w-4" />سجل الحضور</TabsTrigger>
        </TabsList>

        <TabsContent value="about" className="mt-0">
          <Card className="p-6 md:p-8 rounded-3xl border-white/10 shadow-xl bg-card/60 backdrop-blur-xl">
            <div className="grid gap-x-10 gap-y-7 md:grid-cols-2">
              <InfoRow icon={Mail} label="البريد الإلكتروني" value={p.email} dir="ltr" />
              <InfoRow icon={Phone} label="الهاتف" value={p.phone} dir="ltr" />
              <InfoRow icon={Briefcase} label="المسمى الوظيفي" value={p.job_title} />
              <InfoRow icon={Calendar} label="تاريخ الالتحاق" value={p.join_date} />
              <InfoRow icon={Cake} label="تاريخ الميلاد" value={p.birthday} />
              <InfoRow icon={MapPin} label="العنوان" value={p.address} />
              <InfoRow icon={Phone} label="جهة اتصال طوارئ" value={p.emergency_contact} dir="ltr" />
              <InfoRow
                icon={Sparkles}
                label="المهارات"
                value={p.skills?.length ? undefined : null}
                custom={p.skills?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.skills.map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : undefined}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-0">
          <Card className="p-6 rounded-3xl border-white/10 shadow-xl bg-card/60 backdrop-blur-xl">
            <div className="mb-3 text-xs text-muted-foreground">
              عرض للقراءة فقط — لا يمكن إضافة أو تعديل المهام من هنا.
            </div>
            {!tasks || tasks.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">لا توجد مهام</div>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.project_name ?? t.client_name ?? "—"} · {t.type}
                      </div>
                    </div>
                    {t.due_at && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtDateTimeEG(new Date(t.due_at))}
                      </span>
                    )}
                    <Badge variant="secondary">{statusLabels[t.status] ?? t.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-0">
          <AttendanceHistory logs={attendance ?? []} employeeName={name} />
        </TabsContent>
      </Tabs>

      {isSelf && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={p}
          userId={userId}
          currentAvatar={p.avatar_url}
          currentCover={p.cover_url}
        />
      )}
    </div>
  );
}

const toneMap = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
} as const;

function StatCard({ icon: Icon, label, value, small, tone = "primary" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; small?: boolean;
  tone?: keyof typeof toneMap;
}) {
  return (
    <Card className="p-5 rounded-3xl border-white/10 shadow-lg bg-card/60 backdrop-blur-xl hover:shadow-xl hover:-translate-y-0.5 transition-all">
      <div className="flex items-center gap-4">
        <div className={`h-12 w-12 rounded-2xl grid place-items-center shrink-0 border border-white/10 backdrop-blur ${toneMap[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={small ? "text-base font-bold tabular-nums mt-1 truncate" : "text-2xl font-bold tabular-nums mt-0.5 truncate"}>{value}</div>
        </div>
      </div>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value, dir, custom }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value?: string | null; dir?: string; custom?: React.ReactNode;
}) {
  const hasValue = custom !== undefined ? true : Boolean(value);
  return (
    <div className="flex items-start gap-4">
      <div className="h-11 w-11 rounded-2xl bg-muted/60 grid place-items-center shrink-0 text-muted-foreground border border-border/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        {custom !== undefined ? (
          custom ?? <div className="text-sm italic text-muted-foreground/60">غير متوفر</div>
        ) : (
          <div className={hasValue ? "text-sm font-semibold text-foreground truncate" : "text-sm italic text-muted-foreground/60"} dir={dir}>
            {value || "غير متوفر"}
          </div>
        )}
      </div>
    </div>
  );
}

type AttLog = { id: string; user_id: string; work_date: string; check_in: string; check_out: string | null; notes: string | null };

function AttendanceHistory({ logs, employeeName }: { logs: AttLog[]; employeeName: string }) {
  const [period, setPeriod] = useState<AttPeriod>("month");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const usingCustom = Boolean(fromDate || toDate);
  const start = usingCustom ? (fromDate || null) : periodStart(period);
  const end = usingCustom ? (toDate || null) : null;
  const filtered = logs.filter((l) => {
    if (start && l.work_date < start) return false;
    if (end && l.work_date > end) return false;
    return true;
  });

  const daysAttended = new Set(filtered.map((l) => l.work_date)).size;
  const totalSecs = filtered.reduce((a, l) => a + sessionSecs(l), 0);
  const completed = filtered.filter((l) => l.check_out).length;
  const openCount = filtered.filter((l) => !l.check_out).length;

  function exportPdf() {
    const rangeLabel = usingCustom
      ? `من ${fromDate || "البداية"} إلى ${toDate || "اليوم"}`
      : period === "day" ? "اليوم"
      : period === "week" ? "آخر 7 أيام"
      : period === "month" ? "آخر 30 يوم"
      : period === "year" ? "آخر سنة"
      : "كل الفترات";
    const rows = filtered.map((l) => {
      const secs = sessionSecs(l);
      return `
        <tr>
          <td>${l.work_date}</td>
          <td>${fmtTimeEG(new Date(l.check_in))}</td>
          <td>${l.check_out ? fmtTimeEG(new Date(l.check_out)) : "—"}</td>
          <td>${l.check_out ? fmtHMS(secs) : "مفتوحة"}</td>
        </tr>`;
    }).join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>سجل الحضور - ${employeeName}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; padding: 32px; color: #111; }
        h1 { margin: 0 0 4px; font-size: 22px; }
        .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0 24px; }
        .stat { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
        .stat .l { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        .stat .v { font-weight: 700; font-size: 16px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: right; }
        thead { background: #f9fafb; }
        tfoot td { font-weight: 700; background: #f9fafb; }
        .foot { color: #9ca3af; font-size: 11px; margin-top: 20px; text-align: center; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>سجل الحضور — ${employeeName}</h1>
      <div class="sub">الفترة: ${rangeLabel} · تم الإصدار في ${fmtDateTimeEG(new Date())}</div>
      <div class="stats">
        <div class="stat"><div class="l">إجمالي الساعات</div><div class="v">${fmtHMS(totalSecs)}</div></div>
        <div class="stat"><div class="l">أيام الحضور</div><div class="v">${daysAttended}</div></div>
        <div class="stat"><div class="l">جلسات مكتملة</div><div class="v">${completed}</div></div>
        <div class="stat"><div class="l">جلسات مفتوحة</div><div class="v">${openCount}</div></div>
      </div>
      <table>
        <thead><tr><th>التاريخ</th><th>حضور</th><th>انصراف</th><th>المدة</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:24px">لا توجد سجلات في هذه الفترة</td></tr>`}</tbody>
      </table>
      <div class="foot">4Creative — تقرير سجل الحضور</div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("افتح النوافذ المنبثقة لتحميل الـ PDF"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  return (
    <Card className="p-6 rounded-3xl border-border/60 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-muted/60 border border-border/60">
          {(["day","week","month","year","all"] as AttPeriod[]).map((p) => {
            const active = !usingCustom && period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => { setPeriod(p); setFromDate(""); setToDate(""); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "day" ? "اليوم" : p === "week" ? "الأسبوع" : p === "month" ? "الشهر" : p === "year" ? "السنة" : "الكل"}
              </button>
            );
          })}
        </div>
        <Button size="sm" onClick={exportPdf} className="rounded-xl gap-2">
          <FileDown className="h-4 w-4" /> تحميل PDF
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-muted/40 border border-border/60">
        <div className="space-y-1.5">
          <Label className="text-xs">من تاريخ</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">إلى تاريخ</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
        </div>
        {usingCustom && (
          <Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); }} className="rounded-xl">
            مسح
          </Button>
        )}
        <div className="ms-auto text-xs text-muted-foreground">
          {filtered.length} جلسة · {daysAttended} يوم حضور
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="إجمالي الساعات" value={fmtHMS(totalSecs)} tone="primary" />
        <MiniStat label="أيام الحضور" value={String(daysAttended)} tone="emerald" />
        <MiniStat label="جلسات مكتملة" value={String(completed)} tone="violet" />
        <MiniStat label="جلسات مفتوحة" value={String(openCount)} tone="amber" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">لا يوجد سجلات في هذه الفترة</div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">حضور</TableHead>
                <TableHead className="text-right">انصراف</TableHead>
                <TableHead className="text-right">المدة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const secs = sessionSecs(l);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="tabular-nums">{l.work_date}</TableCell>
                    <TableCell className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmtTimeEG(new Date(l.check_in))}</TableCell>
                    <TableCell className="tabular-nums text-rose-600 dark:text-rose-400">{l.check_out ? fmtTimeEG(new Date(l.check_out)) : "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {l.check_out ? fmtHMS(secs) : <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">مفتوحة</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "primary"|"emerald"|"amber"|"violet" }) {
  const cardCls = tone === "primary" ? "bg-primary/5 border-primary/20"
    : tone === "emerald" ? "bg-emerald-500/5 border-emerald-500/20"
    : tone === "amber" ? "bg-amber-500/5 border-amber-500/20"
    : "bg-violet-500/5 border-violet-500/20";
  const labelCls = tone === "primary" ? "text-primary"
    : tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400"
    : "text-violet-600 dark:text-violet-400";
  return (
    <div className={`rounded-2xl p-4 border ${cardCls}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1 text-foreground">{value}</div>
    </div>
  );
}

type ProfileRow = {
  display_name: string | null; name_ar: string | null; phone: string | null; bio: string | null;
  job_title: string | null; join_date: string | null; birthday: string | null; address: string | null;
  emergency_contact: string | null; skills: string[] | null; avatar_url: string | null; cover_url: string | null;
};

function EditProfileDialog({ open, onOpenChange, profile, userId, currentAvatar, currentCover }: {
  open: boolean; onOpenChange: (v: boolean) => void; profile: ProfileRow; userId: string;
  currentAvatar: string | null; currentCover: string | null;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateOwnProfile);
  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      display_name: profile.display_name ?? "",
      name_ar: profile.name_ar ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      job_title: profile.job_title ?? "",
      join_date: profile.join_date ?? "",
      birthday: profile.birthday ?? "",
      address: profile.address ?? "",
      emergency_contact: profile.emergency_contact ?? "",
      skills: (profile.skills ?? []).join(", "),
      avatar_url: currentAvatar ?? "",
      cover_url: currentCover ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      display_name: profile.display_name ?? "",
      name_ar: profile.name_ar ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      job_title: profile.job_title ?? "",
      join_date: profile.join_date ?? "",
      birthday: profile.birthday ?? "",
      address: profile.address ?? "",
      emergency_contact: profile.emergency_contact ?? "",
      skills: (profile.skills ?? []).join(", "),
      avatar_url: currentAvatar ?? "",
      cover_url: currentCover ?? "",
    });
  }, [profile, currentAvatar, currentCover, form]);

  const [uploadingKey, setUploadingKey] = useState<"avatar" | "cover" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarPreview = useAvatarSrc(form.watch("avatar_url") || null);

  async function uploadFile(file: File, kind: "avatar" | "cover") {
    setUploadingKey(kind);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      form.setValue(kind === "avatar" ? "avatar_url" : "cover_url", path);
      toast.success("تم رفع الصورة");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingKey(null);
    }
  }

  const mut = useMutation({
    mutationFn: async (values: ProfileUpdateInput) =>
      updateFn({
        data: {
          display_name: values.display_name || undefined,
          name_ar: values.name_ar || null,
          phone: values.phone || null,
          bio: values.bio || null,
          job_title: values.job_title || null,
          join_date: values.join_date || null,
          birthday: values.birthday || null,
          address: values.address || null,
          emergency_contact: values.emergency_contact || null,
          skills: (values.skills || "").split(",").map((s: string) => s.trim()).filter(Boolean),
          avatar_url: values.avatar_url || null,
          cover_url: values.cover_url || null,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ البروفايل");
      qc.invalidateQueries({ queryKey: ["employee-profile", userId] });
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>تعديل البروفايل</DialogTitle></DialogHeader>

        <Form {...form}>
          <form id="edit-profile-form" onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <div className="flex items-center gap-4 py-2">
              <Avatar className="h-20 w-20 ring-2 ring-border">
                {avatarPreview ? <AvatarImage src={avatarPreview} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary">{(form.watch("display_name") ?? "").substring(0, 2).toUpperCase() || "؟"}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <input ref={avatarInput} type="file" accept="image/*" hidden
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "avatar")} />
                <input ref={coverInput} type="file" accept="image/*" hidden
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "cover")} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => avatarInput.current?.click()}
                    disabled={uploadingKey !== null}>
                    <Camera className="h-4 w-4 ml-1" /> {uploadingKey === "avatar" ? "جارٍ..." : "تغيير الصورة"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => coverInput.current?.click()}
                    disabled={uploadingKey !== null}>
                    <Camera className="h-4 w-4 ml-1" /> {uploadingKey === "cover" ? "جارٍ..." : "تغيير الغلاف"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name_ar"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">الاسم بالعربي</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">الاسم بالإنجليزي</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="job_title"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">المسمى الوظيفي</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">الهاتف</FormLabel>
                    <FormControl><Input dir="ltr" placeholder="01xxxxxxxxx" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="join_date"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">تاريخ الالتحاق</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthday"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">تاريخ الميلاد</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 space-y-1.5">
                    <FormLabel className="text-xs">العنوان</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergency_contact"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 space-y-1.5">
                    <FormLabel className="text-xs">جهة اتصال طوارئ</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skills"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 space-y-1.5">
                    <FormLabel className="text-xs">مهارات (افصل بفاصلة)</FormLabel>
                    <FormControl><Input {...field} placeholder="Photoshop, Premiere, ..." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 space-y-1.5">
                    <FormLabel className="text-xs">نبذة عني</FormLabel>
                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button type="submit" form="edit-profile-form" disabled={mut.isPending || form.formState.isSubmitting}>
            {mut.isPending ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}