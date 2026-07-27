import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, CheckCheck, Volume2, VolumeX, Trash2, ExternalLink, Check,
  ListTodo, MessageSquare, CalendarClock, BellRing, AlertTriangle, Sparkles, Monitor, MonitorOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  kind: string | null;
  category: string | null;
  priority: string | null;
  task_id: string | null;
};

type Bucket = "all" | "unread" | "today" | "yesterday" | "older";
type CategoryFilter = "all" | "task" | "system";

function iconFor(n: Notif) {
  const k = (n.kind ?? "").toLowerCase();
  if (k.includes("reminder")) return BellRing;
  if (k.includes("comment")) return MessageSquare;
  if (k.includes("deadline")) return CalendarClock;
  if (k.includes("assigned") || k.includes("reassigned")) return ListTodo;
  if (k.includes("rejected")) return AlertTriangle;
  if (k.includes("approved") || k.includes("completed")) return Sparkles;
  return Bell;
}

function priorityTone(p: string | null) {
  switch (p) {
    case "critical":
    case "urgent":
      return "border-rose-500/40 bg-rose-500/5";
    case "high":
      return "border-amber-500/40 bg-amber-500/5";
    default:
      return "";
  }
}

export function NotificationsBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [bucket, setBucket] = useState<Bucket>("unread");
  const [category, setCategory] = useState<CategoryFilter>("all");

  // Preferences (persisted)
  const [soundOn, setSoundOn] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("notif-sound") !== "off" : true,
  );
  const [desktopOn, setDesktopOn] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("notif-desktop") === "on" : false,
  );
  const soundRef = useRef(soundOn);
  const desktopRef = useRef(desktopOn);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  useEffect(() => { desktopRef.current = desktopOn; }, [desktopOn]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  // Load recent notifications (last 60) + unread count separately (so badge
  // reflects total unread, not just what's rendered).
  const { data: items = [] } = useQuery({
    queryKey: ["notifications", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, link, is_read, created_at, kind, category, priority, task_id")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(60);
      return (data ?? []) as Notif[];
    },
    refetchInterval: 60_000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread-count", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid!)
        .eq("is_read", false);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  function playPing(priority?: string | null) {
    if (!soundRef.current) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const now = ctx.currentTime;
      const strong = priority === "critical" || priority === "urgent";
      const notes = strong ? [1200, 900, 1400] : [880, 1320];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.12;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(strong ? 0.35 : 0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.24);
      });
      setTimeout(() => ctx.close().catch(() => {}), 900);
    } catch { /* ignore */ }
  }

  // Realtime: play sound, refresh, in-app toast + desktop notification
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`notif-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications", uid] });
          qc.invalidateQueries({ queryKey: ["notifications-unread-count", uid] });
          if (payload.eventType === "INSERT") {
            const n = payload.new as Notif;
            playPing(n.priority);
            // In-app popup
            toast(n.title, {
              description: n.body ?? undefined,
              action: n.link ? {
                label: "فتح",
                onClick: () => { navigate({ to: n.link as string }); },
              } : undefined,
            });
            // Desktop notification
            if (desktopRef.current && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                const dn = new Notification(n.title, { body: n.body ?? "", tag: n.id });
                dn.onclick = () => {
                  window.focus();
                  if (n.link) navigate({ to: n.link as string });
                  dn.close();
                };
              } catch { /* ignore */ }
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, qc, navigate]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    try { window.localStorage.setItem("notif-sound", next ? "on" : "off"); } catch { /* ignore */ }
    if (next) playPing();
  }

  async function toggleDesktop() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("المتصفح لا يدعم إشعارات سطح المكتب");
      return;
    }
    if (desktopOn) {
      setDesktopOn(false);
      try { window.localStorage.setItem("notif-desktop", "off"); } catch { /* ignore */ }
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") { toast.error("لم يتم منح إذن الإشعارات"); return; }
    setDesktopOn(true);
    try { window.localStorage.setItem("notif-desktop", "on"); } catch { /* ignore */ }
    try { new Notification("تم تفعيل إشعارات سطح المكتب"); } catch { /* ignore */ }
  }

  async function markAll() {
    if (!uid) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", uid).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications", uid] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count", uid] });
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", uid] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count", uid] });
  }

  async function del(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", uid] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count", uid] });
  }

  async function openNotif(n: Notif) {
    if (!n.is_read) await markRead(n.id);
    if (n.link) { setOpen(false); navigate({ to: n.link }); }
  }

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (bucket === "unread" && n.is_read) return false;
      if (bucket === "today" && !isToday(new Date(n.created_at))) return false;
      if (bucket === "yesterday" && !isYesterday(new Date(n.created_at))) return false;
      if (bucket === "older") {
        const d = new Date(n.created_at);
        if (isToday(d) || isYesterday(d)) return false;
      }
      if (category !== "all") {
        const c = (n.category ?? n.kind ?? "").toLowerCase();
        if (category === "task" && !c.startsWith("task")) return false;
        if (category === "system" && c.startsWith("task")) return false;
      }
      return true;
    });
  }, [items, bucket, category]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <>
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-background" />
              <Badge
                className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 text-[10px] grid place-items-center"
                variant="destructive"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(380px,calc(100vw-40px))] p-0" sideOffset={10} collisionPadding={20}>
        <div dir="rtl" className="flex items-center justify-between px-3 py-2 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">الإشعارات</div>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5">{unreadCount} جديد</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleSound}
              title={soundOn ? "كتم الصوت" : "تفعيل الصوت"}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={toggleDesktop}
              title={desktopOn ? "إيقاف إشعارات سطح المكتب" : "تفعيل إشعارات سطح المكتب"}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              {desktopOn ? <Monitor className="h-3.5 w-3.5" /> : <MonitorOff className="h-3.5 w-3.5" />}
            </button>
            {unreadCount > 0 && (
              <button onClick={markAll} title="تعليم الكل كمقروء" className="p-1.5 rounded hover:bg-accent text-primary flex items-center gap-1 text-xs">
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div dir="rtl" className="px-2 pt-2 border-b bg-card">
          <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
            <TabsList className="grid grid-cols-5 h-8 w-full">
              <TabsTrigger value="unread" className="text-[11px] px-1">غير مقروء</TabsTrigger>
              <TabsTrigger value="all" className="text-[11px] px-1">الكل</TabsTrigger>
              <TabsTrigger value="today" className="text-[11px] px-1">اليوم</TabsTrigger>
              <TabsTrigger value="yesterday" className="text-[11px] px-1">أمس</TabsTrigger>
              <TabsTrigger value="older" className="text-[11px] px-1">أقدم</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1 mt-2 mb-2 flex-wrap">
            {(["all", "task", "system"] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] border transition-colors",
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:bg-accent",
                )}
              >
                {c === "all" ? "الكل" : c === "task" ? "التاسكات" : "النظام"}
              </button>
            ))}
          </div>
        </div>

        <div dir="rtl" className="max-h-[440px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Bell className="h-8 w-8 opacity-30" />
              لا توجد إشعارات هنا
            </div>
          ) : filtered.map((n) => {
            const Icon = iconFor(n);
            const tone = priorityTone(n.priority);
            return (
              <div
                key={n.id}
                className={cn(
                  "group relative px-3 py-2.5 border-b last:border-0 hover:bg-accent/40 cursor-pointer border-r-2",
                  !n.is_read ? "bg-primary/5 border-r-primary" : "border-r-transparent",
                  tone,
                )}
                onClick={() => openNotif(n)}
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                    !n.is_read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("text-sm truncate", !n.is_read && "font-semibold")}>{n.title}</div>
                      {(n.priority === "urgent" || n.priority === "critical") && (
                        <Badge variant="destructive" className="text-[9px] h-4 px-1">عاجل</Badge>
                      )}
                    </div>
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1 tabular-nums flex items-center gap-2">
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar })}</span>
                      {n.link && (
                        <span className="inline-flex items-center gap-0.5 text-primary">
                          <ExternalLink className="h-2.5 w-2.5" /> فتح
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Quick actions */}
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {!n.is_read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                      title="تعليم كمقروء"
                      className="h-6 w-6 grid place-items-center rounded hover:bg-primary/10 text-primary bg-background/80 border"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); del(n.id); }}
                    title="حذف"
                    className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/10 text-destructive bg-background/80 border"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
