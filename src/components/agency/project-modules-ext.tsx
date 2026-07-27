// Extra workspace modules: Notes, Chat, Notifications, Settings
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { arSA } from "date-fns/locale";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  StickyNote, Plus, Pin, PinOff, Trash2, MessageSquare, Send, Bell, BellOff,
  Settings as SettingsIcon, Save, Reply, X, CheckCheck, ExternalLink, Info,
} from "lucide-react";

const initials = (s?: string) =>
  (s ?? "؟").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

const NOTE_COLORS: Record<string, string> = {
  default: "bg-card border-border",
  amber:   "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60",
  sky:     "bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-900/60",
  violet:  "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900/60",
  emerald: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/60",
  rose:    "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/60",
};
const COLOR_KEYS = Object.keys(NOTE_COLORS);

/* ═══════════════════════════════════════════════════════════
   NOTES
   ═══════════════════════════════════════════════════════════ */
export function NotesSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["ws_notes", projectId],
    queryFn: async () => (await supabase.from("project_notes")
      .select("*").eq("project_id", projectId)
      .order("pinned", { ascending: false }).order("updated_at", { ascending: false })).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("project_notes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["ws_notes", projectId] }); },
  });
  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("project_notes").update({ pinned: !pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ws_notes", projectId] }),
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><StickyNote className="h-4 w-4 text-amber-500" /> ملاحظات المشروع</h2>
          <p className="text-xs text-muted-foreground mt-0.5">لوحة ملاحظات مشتركة لأعضاء الفريق</p>
        </div>
        <Button size="sm" className="rounded-lg" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 ml-1" /> ملاحظة جديدة
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Card key={i} className="h-40 animate-pulse bg-muted/40" />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="لا توجد ملاحظات بعد" hint="ابدأ بإضافة أول ملاحظة للمشروع" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {notes.map((n: any) => (
            <Card
              key={n.id}
              className={cn("group relative p-4 border rounded-xl transition-all hover:shadow-md cursor-pointer animate-fade-in",
                NOTE_COLORS[n.color] ?? NOTE_COLORS.default)}
              onClick={() => { setEditing(n); setOpen(true); }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm truncate flex-1">{n.title}</h3>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); togglePin.mutate({ id: n.id, pinned: n.pinned }); }}>
                    {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={(e) => { e.stopPropagation(); del.mutate(n.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {n.content && <p className="text-xs text-muted-foreground line-clamp-6 whitespace-pre-wrap">{n.content}</p>}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                <span>{formatDistanceToNow(new Date(n.updated_at), { addSuffix: true, locale: arSA })}</span>
                {n.pinned && <Badge variant="secondary" className="h-4 px-1.5 text-[9px] gap-1"><Pin className="h-2.5 w-2.5" /> مثبتة</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <NoteDialog open={open} onOpenChange={setOpen} projectId={projectId} note={editing} />
    </div>
  );
}

function NoteDialog({ open, onOpenChange, projectId, note }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string; note: any | null }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("default");

  useEffect(() => {
    if (open) {
      setTitle(note?.title ?? "");
      setContent(note?.content ?? "");
      setColor(note?.color ?? "default");
    }
  }, [open, note]);

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("العنوان مطلوب");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("مطلوب تسجيل دخول");
      if (note?.id) {
        const { error } = await supabase.from("project_notes").update({ title, content, color }).eq("id", note.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_notes").insert({ project_id: projectId, author_id: user.id, title, content, color });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["ws_notes", projectId] }); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>{note ? "تعديل ملاحظة" : "ملاحظة جديدة"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الملاحظة" /></div>
          <div><Label>المحتوى</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="اكتب هنا..." /></div>
          <div>
            <Label>اللون</Label>
            <div className="flex items-center gap-2 mt-1.5">
              {COLOR_KEYS.map((k) => (
                <button key={k} type="button" onClick={() => setColor(k)}
                  className={cn("h-8 w-8 rounded-lg border-2 transition-all", NOTE_COLORS[k], color === k ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-110")} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 ml-1" /> حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHAT (realtime)
   ═══════════════════════════════════════════════════════════ */
export function ChatSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const { data: messages = [] } = useQuery({
    queryKey: ["ws_chat", projectId],
    queryFn: async () => (await supabase.from("project_chat_messages")
      .select("*, author:profiles!project_chat_messages_author_id_fkey(display_name, avatar_url)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(200)).data ?? [],
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_chat_messages", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["ws_chat", projectId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async () => {
      const txt = input.trim();
      if (!txt) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("مطلوب تسجيل دخول");
      const { error } = await supabase.from("project_chat_messages").insert({ project_id: projectId, author_id: user.id, content: txt });
      if (error) throw error;
      setInput("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("project_chat_messages").delete().eq("id", id); if (error) throw error; },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden" dir="rtl">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">شات المشروع</div>
            <div className="text-[10px] text-muted-foreground">مباشر · {messages.length} رسالة</div>
          </div>
        </div>
        <Badge variant="outline" className="gap-1 text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Realtime</Badge>
      </div>

      <div ref={scrollRef} className="h-[480px] overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-muted/10 to-transparent">
        {messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-muted-foreground text-sm">
            <div>
              <MessageSquare className="h-10 w-10 mx-auto opacity-30 mb-2" />
              لا توجد رسائل بعد — ابدأ المحادثة!
            </div>
          </div>
        ) : messages.map((m: any) => {
          const mine = m.author_id === me;
          const name = m.author?.display_name ?? "عضو";
          return (
            <div key={m.id} className={cn("flex gap-2 group animate-fade-in", mine ? "flex-row-reverse" : "flex-row")}>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 text-white">{initials(name)}</AvatarFallback>
              </Avatar>
              <div className={cn("max-w-[75%] space-y-0.5", mine ? "items-end" : "items-start", "flex flex-col")}>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                  <span className="font-medium">{name}</span>
                  <span>·</span>
                  <span>{format(new Date(m.created_at), "HH:mm")}</span>
                </div>
                <div className={cn("px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap",
                  mine ? "bg-primary text-primary-foreground rounded-bl-2xl rounded-br-md"
                       : "bg-muted text-foreground rounded-br-2xl rounded-bl-md")}>
                  {m.content}
                </div>
              </div>
              {mine && (
                <button onClick={() => del.mutate(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity self-center text-muted-foreground hover:text-rose-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t bg-background flex items-center gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.mutate(); } }}
          placeholder="اكتب رسالة... (Enter للإرسال)"
          rows={1}
          className="resize-none min-h-[40px] max-h-32"
        />
        <Button onClick={() => send.mutate()} disabled={!input.trim() || send.isPending} className="rounded-lg shrink-0 h-10">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════════ */
export function NotificationsSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifs = [] } = useQuery({
    queryKey: ["ws_notifs", projectId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("notifications")
        .select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => filter === "unread" ? notifs.filter((n) => !n.is_read) : notifs, [notifs, filter]);
  const unreadCount = notifs.filter((n) => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => { await supabase.from("notifications").update({ is_read: true }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ws_notifs", projectId] }),
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["ws_notifs", projectId] }); },
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" /> الإشعارات
            {unreadCount > 0 && <Badge className="bg-rose-500 hover:bg-rose-500">{unreadCount}</Badge>}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">آخر إشعاراتك الخاصة</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="h-9 w-32 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="unread">غير مقروء</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4 ml-1" /> تعليم الكل مقروء
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BellOff} title="لا توجد إشعارات" hint={filter === "unread" ? "كل شيء مقروء" : "ستظهر الإشعارات هنا"} />
      ) : (
        <Card className="rounded-xl border overflow-hidden">
          <div className="divide-y">
            {filtered.map((n) => (
              <div key={n.id}
                className={cn("p-3 hover:bg-muted/40 transition-colors cursor-pointer flex items-start gap-3 group animate-fade-in",
                  !n.is_read && "bg-primary/5")}
                onClick={() => {
                  if (!n.is_read) markRead.mutate(n.id);
                  if (n.link) navigate({ to: n.link as any });
                }}
              >
                <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0",
                  !n.is_read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm truncate">{n.title}</div>
                    {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  </div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: arSA })}
                  </div>
                </div>
                {n.link && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 self-center" />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════ */
export function SettingsSection({ projectId, project }: { projectId: string; project: any }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    budget: String(project?.budget ?? 0),
    start_date: project?.start_date ?? "",
    due_date: project?.due_date ?? "",
    status: project?.status ?? "planned",
    type: project?.type ?? "marketing",
  });

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name ?? "",
        description: project.description ?? "",
        budget: String(project.budget ?? 0),
        start_date: project.start_date ?? "",
        due_date: project.due_date ?? "",
        status: project.status ?? "planned",
        type: project.type ?? "marketing",
      });
    }
  }, [project]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agency_projects").update({
        name: form.name,
        description: form.description || null,
        budget: Number(form.budget) || 0,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        status: form.status as any,
        type: form.type as any,
      }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      qc.invalidateQueries({ queryKey: ["agency_project_full", projectId] });
      qc.invalidateQueries({ queryKey: ["agency_projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agency_projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المشروع");
      qc.invalidateQueries({ queryKey: ["agency_projects"] });
      navigate({ to: "/agency/projects" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-3xl" dir="rtl">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="h-4 w-4 text-slate-500" /> إعدادات المشروع</h2>
        <p className="text-xs text-muted-foreground mt-0.5">تعديل التفاصيل الأساسية والإجراءات الحرجة</p>
      </div>

      {/* General */}
      <Card className="p-5 rounded-xl border space-y-4">
        <div className="text-sm font-semibold border-b pb-2">التفاصيل العامة</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label>اسم المشروع</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>الوصف</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <Label>النوع</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="marketing">ماركتنج</SelectItem>
                <SelectItem value="programming">برمجة</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الحالة</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">مخطط</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="on_hold">متوقف</SelectItem>
                <SelectItem value="delivered">تم التسليم</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>الميزانية (ج)</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          <div><Label>تاريخ البدء</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>تاريخ التسليم</Label><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
        </div>
        <div className="flex justify-end pt-2 border-t">
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 ml-1" /> حفظ التغييرات</Button>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-5 rounded-xl border space-y-4">
        <div className="text-sm font-semibold border-b pb-2">التفضيلات</div>
        <PreferenceRow icon={Bell} title="إشعارات المشروع" desc="استقبل تنبيهات عند تحديثات المهام والمصروفات" storageKey={`ws_pref_notif_${projectId}`} />
        <PreferenceRow icon={MessageSquare} title="إشعارات الشات" desc="نبّهني عند وصول رسائل جديدة" storageKey={`ws_pref_chat_${projectId}`} />
        <PreferenceRow icon={StickyNote} title="ملخص يومي" desc="ابعتلي ملخص يومي عن نشاط المشروع" storageKey={`ws_pref_daily_${projectId}`} />
      </Card>

      {/* Danger zone */}
      <Card className="p-5 rounded-xl border-2 border-destructive/40 space-y-3 bg-destructive/5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-destructive/15 text-destructive grid place-items-center shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-destructive">منطقة خطر</div>
            <p className="text-xs text-muted-foreground mt-0.5">حذف المشروع سيمسح المهام، المصروفات، الأعضاء، الملاحظات، والرسائل نهائيًا.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="shrink-0"><Trash2 className="h-4 w-4 ml-1" /> حذف المشروع</Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>تأكيد حذف المشروع</AlertDialogTitle>
                <AlertDialogDescription>
                  هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بيانات المشروع "{project?.name}" نهائيًا.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={() => del.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف نهائي</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}

function PreferenceRow({ icon: Icon, title, desc, storageKey }:
  { icon: any; title: string; desc: string; storageKey: string }) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(storageKey) !== "0";
  });
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-muted grid place-items-center shrink-0"><Icon className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); localStorage.setItem(storageKey, v ? "1" : "0"); }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <Card className="p-10 text-center rounded-xl border-dashed">
      <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
      <div className="font-medium text-sm">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}