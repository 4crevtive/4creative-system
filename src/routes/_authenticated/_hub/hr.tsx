import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, LogIn, LogOut, History, Search, Trophy, User, FileDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { format, differenceInSeconds } from "date-fns";

const fmtTimeEG = (d: Date) =>
  d.toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
const fmtDateTimeEG = (d: Date) =>
  `${d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" })} ${d.toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: true })}`;
import { toast } from "sonner";
import { adminCheckIn, adminCheckOut, listUserAttendance } from "@/lib/attendance.functions";

export const Route = createFileRoute("/_authenticated/_hub/hr")({
  head: () => ({ meta: [{ title: "الموارد البشرية — 4Creative" }] }),
  component: HRPage,
});

type Profile = { id: string; username: string | null; email: string | null; display_name: string | null; name_ar: string | null; is_active: boolean | null };
type Log = { id: string; user_id: string; work_date: string; check_in: string; check_out: string | null; notes: string | null };

function fmtDuration(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}س ${m.toString().padStart(2, "0")}د ${sec.toString().padStart(2, "0")}ث`;
}

const MAX_SESSION_SECS = 12 * 3600; // safety cap: no single session > 12h
const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/** Session length in seconds. Open sessions only count if today; capped at 12h. */
function sessionSecs(l: { check_in: string; check_out: string | null; work_date: string }) {
  const start = new Date(l.check_in);
  if (l.check_out) {
    return Math.min(MAX_SESSION_SECS, Math.max(0, differenceInSeconds(new Date(l.check_out), start)));
  }
  // open — only count if it's today (otherwise it's a stale unclosed log)
  if (l.work_date !== TODAY_ISO()) return 0;
  return Math.min(MAX_SESSION_SECS, Math.max(0, differenceInSeconds(new Date(), start)));
}

function HRPage() {
  const today = new Date().toISOString().slice(0, 10);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [historyUser, setHistoryUser] = useState<Profile | null>(null);

  const checkIn = useServerFn(adminCheckIn);
  const checkOut = useServerFn(adminCheckOut);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () =>
      ((await supabase.from("profiles").select("id, username, email, display_name, name_ar, is_active").order("display_name")).data ?? []) as Profile[],
  });

  const { data: todayLogs } = useQuery({
    queryKey: ["hr-attendance-today", today],
    queryFn: async () =>
      ((await supabase.from("attendance_logs").select("*").eq("work_date", today).order("check_in", { ascending: false })).data ?? []) as Log[],
  });

  const openByUser = new Map<string, Log>();
  const todayByUser = new Map<string, Log[]>();
  (todayLogs ?? []).forEach((l) => {
    const arr = todayByUser.get(l.user_id) ?? [];
    arr.push(l);
    todayByUser.set(l.user_id, arr);
    if (!l.check_out && !openByUser.has(l.user_id)) openByUser.set(l.user_id, l);
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr-attendance-today"] });
    qc.invalidateQueries({ queryKey: ["user-attendance"] });
  };

  const inMut = useMutation({
    mutationFn: (user_id: string) => checkIn({ data: { user_id } }),
    onSuccess: () => { toast.success("تم تسجيل الحضور"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const outMut = useMutation({
    mutationFn: (user_id: string) => checkOut({ data: { user_id } }),
    onSuccess: () => { toast.success("تم تسجيل الانصراف"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (profiles ?? []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.display_name ?? "").toLowerCase().includes(q) ||
      (p.name_ar ?? "").toLowerCase().includes(q) ||
      (p.username ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الموارد البشرية</h1>
          <p className="text-muted-foreground mt-1">سجّل حضور وانصراف الموظفين وراجع سجل كل موظف</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن موظف..." className="pr-9" />
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> الموظفين</h3>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">لا يوجد موظفين</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const open = openByUser.get(p.id);
              const logs = todayByUser.get(p.id) ?? [];
              const totalSecs = logs.reduce((acc, l) => acc + sessionSecs(l), 0);
              const name = p.name_ar ?? p.display_name ?? p.username ?? "؟";
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground truncate" dir="ltr">{p.username ?? p.email}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {logs.length === 0 ? (
                      <Badge variant="outline">لم يحضر</Badge>
                    ) : (
                      <>
                        {(() => {
                          const first = logs[logs.length - 1];
                          const last = logs[0];
                          return (
                            <>
                              <Badge variant="outline" className="tabular-nums gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                <LogIn className="h-3 w-3" /> {fmtTimeEG(new Date(first.check_in))}
                              </Badge>
                              {last.check_out ? (
                                <Badge variant="outline" className="tabular-nums gap-1 border-rose-500/40 text-rose-600 dark:text-rose-400">
                                  <LogOut className="h-3 w-3" /> {fmtTimeEG(new Date(last.check_out))}
                                </Badge>
                              ) : (
                                <Badge className="tabular-nums gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">
                                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                                  داخل الآن
                                </Badge>
                              )}
                              <Badge variant="secondary" className="tabular-nums gap-1"><Clock className="h-3 w-3" /> {fmtDuration(totalSecs)}</Badge>
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {open ? (
                      <Button size="sm" variant="secondary" onClick={() => outMut.mutate(p.id)} disabled={outMut.isPending}>
                        <LogOut className="h-4 w-4 ml-1" /> انصراف
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => inMut.mutate(p.id)} disabled={inMut.isPending}>
                        <LogIn className="h-4 w-4 ml-1" /> حضور
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setHistoryUser(p)}>
                      <History className="h-4 w-4 ml-1" /> السجل
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/profile/$userId" params={{ userId: p.id }}>
                        <User className="h-4 w-4 ml-1" /> البروفايل
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <HistoryDialog user={historyUser} onClose={() => setHistoryUser(null)} />

      <Leaderboard profiles={profiles ?? []} />
    </div>
  );
}

function HistoryDialog({ user, onClose }: { user: Profile | null; onClose: () => void }) {
  const listFn = useServerFn(listUserAttendance);
  const { data, isLoading } = useQuery({
    queryKey: ["user-attendance", user?.id],
    queryFn: () => listFn({ data: { user_id: user!.id, limit: 200 } }),
    enabled: !!user,
  });

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const rows = (data ?? []).filter((l) => {
    if (fromDate && l.work_date < fromDate) return false;
    if (toDate && l.work_date > toDate) return false;
    return true;
  });

  const totalSecs = rows.reduce((a, l) => a + sessionSecs(l), 0);
  const daysAttended = new Set(rows.map((l) => l.work_date)).size;
  const completed = rows.filter((l) => l.check_out).length;
  const openCount = rows.filter((l) => !l.check_out).length;
  const employeeName = user?.name_ar ?? user?.display_name ?? user?.username ?? "موظف";

  function exportPdf() {
    const rangeLabel = (fromDate || toDate)
      ? `من ${fromDate || "البداية"} إلى ${toDate || "اليوم"}`
      : "كل الفترات";
    const rowsHtml = rows.map((l) => {
      const secs = sessionSecs(l);
      return `<tr>
        <td>${l.work_date}</td>
        <td>${fmtTimeEG(new Date(l.check_in))}</td>
        <td>${l.check_out ? fmtTimeEG(new Date(l.check_out)) : "—"}</td>
        <td>${l.check_out ? fmtDuration(secs) : "مفتوحة"}</td>
      </tr>`;
    }).join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>سجل الحضور - ${employeeName}</title>
      <style>
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
        .foot { color: #9ca3af; font-size: 11px; margin-top: 20px; text-align: center; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>سجل الحضور — ${employeeName}</h1>
      <div class="sub">الفترة: ${rangeLabel} · تم الإصدار في ${fmtDateTimeEG(new Date())}</div>
      <div class="stats">
        <div class="stat"><div class="l">إجمالي الساعات</div><div class="v">${fmtDuration(totalSecs)}</div></div>
        <div class="stat"><div class="l">أيام الحضور</div><div class="v">${daysAttended}</div></div>
        <div class="stat"><div class="l">جلسات مكتملة</div><div class="v">${completed}</div></div>
        <div class="stat"><div class="l">جلسات مفتوحة</div><div class="v">${openCount}</div></div>
      </div>
      <table>
        <thead><tr><th>التاريخ</th><th>حضور</th><th>انصراف</th><th>المدة</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:24px">لا توجد سجلات</td></tr>`}</tbody>
      </table>
      <div class="foot">4Creative — تقرير سجل الحضور</div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("افتح النوافذ المنبثقة لتحميل الـ PDF"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>سجل الحضور — {user?.name_ar ?? user?.display_name ?? user?.username}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-muted/40 border">
          <div className="space-y-1.5">
            <Label className="text-xs">من تاريخ</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">إلى تاريخ</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
          {(fromDate || toDate) && (
            <Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); }}>مسح</Button>
          )}
          <div className="ms-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{rows.length} سجل حضور · {fmtDuration(totalSecs)}</span>
            <Button size="sm" onClick={exportPdf} className="gap-2">
              <FileDown className="h-4 w-4" /> تحميل PDF
            </Button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">جارٍ التحميل...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">لا يوجد سجلات</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الحضور</TableHead>
                  <TableHead className="text-right">الانصراف</TableHead>
                  <TableHead className="text-right">المدة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => {
                  const end = l.check_out ? new Date(l.check_out) : null;
                  const isToday = l.work_date === TODAY_ISO();
                  const secs = sessionSecs(l);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="tabular-nums">{l.work_date}</TableCell>
                      <TableCell className="tabular-nums">{fmtTimeEG(new Date(l.check_in))}</TableCell>
                      <TableCell className="tabular-nums">
                        {end ? fmtTimeEG(end) : isToday
                          ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">داخل الآن</Badge>
                          : <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">لم يسجّل انصراف</Badge>}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {end ? fmtDuration(secs) : isToday ? fmtDuration(secs) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Range = "today" | "week" | "month" | "all";

function rangeStart(r: Range): string | null {
  if (r === "all") return null;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (r === "week") d.setDate(d.getDate() - 7);
  else if (r === "month") d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function Leaderboard({ profiles }: { profiles: Profile[] }) {
  const [range, setRange] = useState<Range>("week");
  const [search, setSearch] = useState("");
  const start = rangeStart(range);

  const { data: logs } = useQuery({
    queryKey: ["hr-leaderboard", range],
    queryFn: async () => {
      let q = supabase.from("attendance_logs").select("user_id, check_in, check_out, work_date");
      if (start) q = q.gte("work_date", start);
      return ((await q).data ?? []) as Log[];
    },
  });

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const totals = new Map<string, number>();
  (logs ?? []).forEach((l) => {
    totals.set(l.user_id, (totals.get(l.user_id) ?? 0) + sessionSecs(l));
  });

  const rows = Array.from(totals.entries())
    .map(([user_id, secs]) => ({ user: profileById.get(user_id), secs }))
    .filter((r) => r.user)
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const u = r.user!;
      return (
        (u.display_name ?? "").toLowerCase().includes(q) ||
        (u.name_ar ?? "").toLowerCase().includes(q) ||
        (u.username ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.secs - a.secs);

  const max = rows[0]?.secs ?? 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> ترتيب الموظفين حسب ساعات الحضور</h3>
        <div className="flex flex-wrap gap-2">
          {(["today","week","month","all"] as Range[]).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
              {r === "today" ? "اليوم" : r === "week" ? "آخر 7 أيام" : r === "month" ? "آخر 30 يوم" : "الكل"}
            </Button>
          ))}
        </div>
      </div>
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن موظف..." className="pr-9" />
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">لا توجد سجلات حضور في هذه الفترة</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const u = r.user!;
            const name = u.name_ar ?? u.display_name ?? u.username ?? "؟";
            const pct = max > 0 ? (r.secs / max) * 100 : 0;
            return (
              <Link key={u.id} to="/profile/$userId" params={{ userId: u.id }}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center shrink-0">{i + 1}</div>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{name}</div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <Badge className="tabular-nums">{fmtDuration(r.secs)}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}