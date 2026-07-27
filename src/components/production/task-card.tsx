import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Clock, Calendar, CalendarClock, Film, Image, Camera, PlayCircle, CheckCircle2, Send, Eye, AlertCircle, ExternalLink, UserPlus, MapPin, BellRing } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { TaskDetailView } from "@/components/production/task-detail-view";

export type ProdTask = {
  id: string; title: string; description: string | null;
  type: "shooting" | "editing" | "design" | "programming" | "marketing";
  status: "pending" | "accepted" | "started" | "progress_50" | "in_review" | "submitted" | "approved" | "rejected" | "archived" | "shooting_started" | "shooting_done" | "uploaded" | "completed";
  priority: number; due_at: string | null;
  video_duration_pre_seconds: number | null; video_duration_post_seconds: number | null;
  started_at: string | null; submitted_at: string | null; approved_at: string | null;
  created_at: string;
  created_by?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  shooting_room_id?: string | null; shooting_location?: string | null; shooting_external_address?: string | null; shooting_notes?: string | null;
  contact?: { full_name: string } | null;
  creator?: { display_name: string | null; email: string | null } | null;
  room?: { name: string | null; code: string | null } | null;
};

const STATUS_AR: Record<string, string> = {
  pending: "في الانتظار", accepted: "تم القبول", started: "تم البدء", progress_50: "50% منجز",
  in_review: "مراجعة داخلية", submitted: "تم التسليم (بانتظار الاعتماد)",
  shooting_started: "بدء التصوير", shooting_done: "انتهى التصوير", uploaded: "تم الرفع",
  approved: "معتمد", completed: "مكتمل", rejected: "مرفوض", archived: "مؤرشف",
};

const TYPE_AR: Record<string, string> = {
  shooting: "تصوير", editing: "مونتاج", design: "ديزاين",
  programming: "برمجة", marketing: "ماركتنج",
};
const TYPE_TONE: Record<string, string> = {
  shooting: "bg-blue-500/15 text-blue-700",
  editing: "bg-violet-500/15 text-violet-700",
  design: "bg-pink-500/15 text-pink-700",
  programming: "bg-emerald-500/15 text-emerald-700",
  marketing: "bg-amber-500/15 text-amber-700",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  accepted: "bg-sky-500/15 text-sky-700",
  started: "bg-blue-500/15 text-blue-700",
  progress_50: "bg-amber-500/15 text-amber-700",
  in_review: "bg-purple-500/15 text-purple-700",
  submitted: "bg-orange-500/15 text-orange-700",
  shooting_started: "bg-blue-500/15 text-blue-700",
  shooting_done: "bg-purple-500/15 text-purple-700",
  uploaded: "bg-purple-500/15 text-purple-700",
  approved: "bg-emerald-500/15 text-emerald-700",
  completed: "bg-emerald-500/15 text-emerald-700",
  rejected: "bg-rose-500/15 text-rose-700",
  archived: "bg-muted text-muted-foreground",
};

function typeIcon(t: string) {
  if (t === "shooting") return Camera;
  if (t === "editing") return Film;
  if (t === "design") return Image;
  return PlayCircle;
}

function fmtDur(s: number | null) {
  if (!s) return null;
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export async function changeStatus(taskId: string, from: string, to: string, extra?: Record<string, unknown>, note?: string) {
  const { data: u } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = { status: to, ...(extra ?? {}) };
  const { error } = await supabase.from("tasks").update(patch as never).eq("id", taskId);
  if (error) { toast.error(error.message); return false; }
  await supabase.from("task_status_history").insert({
    task_id: taskId, from_status: from as never, to_status: to as never,
    changed_by: u.user?.id, notes: note ?? null,
  } as never);
  return true;
}

export function TaskCard({ task, onChanged, adminMode = false }: {
  task: ProdTask; onChanged: () => void; adminMode?: boolean;
}) {
  const Icon = typeIcon(task.type);
  const [busy, setBusy] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const isShooting = task.type === "shooting";
  const overdue = task.due_at && new Date(task.due_at) < new Date() && !["approved", "archived"].includes(task.status);

  async function act(to: string, extra?: Record<string, unknown>) {
    setBusy(true);
    const ok = await changeStatus(task.id, task.status, to, extra);
    setBusy(false);
    if (ok) { toast.success("تم التحديث"); onChanged(); }
  }

  const [remindBusy, setRemindBusy] = useState(false);
  async function sendReminder() {
    setRemindBusy(true);
    const { data, error } = await supabase.rpc("send_task_reminder", { _task_id: task.id });
    setRemindBusy(false);
    if (error) { toast.error(error.message); return; }
    const n = typeof data === "number" ? data : 0;
    toast.success(n > 0 ? `تم إرسال التذكير إلى ${n} مستخدم` : "تم إرسال التذكير");
  }

  const nextActions: { label: string; to: string; extra?: Record<string, unknown>; icon: React.ComponentType<{ className?: string }>; variant?: "default" | "outline" | "secondary" }[] = [];

  if (!adminMode) {
    if (task.status === "pending") nextActions.push({ label: "ابدأ", to: "started", extra: { started_at: new Date().toISOString() }, icon: PlayCircle });
    if (isShooting) {
      if (task.status === "started") nextActions.push({ label: "تم الانتهاء", to: "submitted", extra: { submitted_at: new Date().toISOString() }, icon: CheckCircle2 });
    } else {
      if (task.status === "started") nextActions.push({ label: "وصلت 50%", to: "progress_50", icon: PlayCircle, variant: "outline" });
      if (["started", "progress_50"].includes(task.status)) nextActions.push({ label: "للمراجعة", to: "in_review", icon: Eye, variant: "outline" });
      if (["started", "progress_50", "in_review"].includes(task.status)) nextActions.push({ label: "تسليم نهائي", to: "submitted", extra: { submitted_at: new Date().toISOString() }, icon: Send });
    }
  }

  return (
    <Card className={`p-4 ${overdue ? "border-rose-300 bg-rose-50/30" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold truncate">{task.title}</h4>
            <Badge className={`text-xs ${TYPE_TONE[task.type] ?? ""}`}>{TYPE_AR[task.type] ?? task.type}</Badge>
            <Badge className={`text-xs ${STATUS_TONE[task.status]}`}>{STATUS_AR[task.status]}</Badge>
            {task.priority <= 2 && <Badge variant="destructive" className="text-xs">عاجل</Badge>}
            {overdue && <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 ml-0.5" /> متأخر</Badge>}
          </div>
          {task.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            {task.contact?.full_name && <span>👤 {task.contact.full_name}</span>}
            {(task.creator?.display_name || task.creator?.email) && (
              <span className="flex items-center gap-1">
                <UserPlus className="h-3 w-3" /> أسندها: {task.creator?.display_name || task.creator?.email}
              </span>
            )}
            <span className="flex items-center gap-1 tabular-nums">
              <CalendarClock className="h-3 w-3" /> أُسندت {format(new Date(task.created_at), "yyyy/MM/dd HH:mm")}
            </span>
            {(task.room?.name || task.shooting_location || task.shooting_external_address || task.project_name) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {task.room?.name || task.shooting_location || task.shooting_external_address || task.project_name}
              </span>
            )}
            {task.started_at && (
              <span className="flex items-center gap-1 tabular-nums text-emerald-700 dark:text-emerald-400">
                <CalendarClock className="h-3 w-3" /> بدء {format(new Date(task.started_at), "yyyy/MM/dd HH:mm")}
              </span>
            )}
            {task.due_at && (
              <span className="flex items-center gap-1 tabular-nums">
                <Calendar className="h-3 w-3" /> تسليم {format(new Date(task.due_at), "yyyy/MM/dd HH:mm")}
              </span>
            )}
            {(task.video_duration_pre_seconds || task.video_duration_post_seconds) && (
              <span className="flex items-center gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {fmtDur(task.video_duration_pre_seconds) ?? "—"} ← {fmtDur(task.video_duration_post_seconds) ?? "؟"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress for editing/design */}
      {!isShooting && !["approved", "archived"].includes(task.status) && (
        <div className="mt-3">
          <ProgressTrack status={task.status} />
        </div>
      )}

      {/* Footer actions */}
      {!adminMode && nextActions.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap pt-3 border-t items-center">
          {nextActions.map((a) => {
            const A = a.icon;
            return (
              <Button key={a.to} size="sm" variant={a.variant ?? "default"} disabled={busy}
                onClick={() => act(a.to, a.extra)}>
                <A className="h-3.5 w-3.5 ml-1" /> {a.label}
              </Button>
            );
          })}
          <Button size="sm" variant="outline" disabled={remindBusy} onClick={sendReminder} title="إرسال تذكير للمكلفين والمراقبين">
            <BellRing className="h-3.5 w-3.5 ml-1" /> تذكير
          </Button>
          <Button size="sm" variant="ghost" className="mr-auto" onClick={() => setOpenDetails(true)}>
            <ExternalLink className="h-3.5 w-3.5 ml-1" /> تفاصيل
          </Button>
        </div>
      )}

      {!adminMode && task.status === "submitted" && nextActions.length === 0 && (
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> بانتظار اعتماد الإدارة...
          <Button size="sm" variant="ghost" className="mr-auto" onClick={() => setOpenDetails(true)}>
            <ExternalLink className="h-3.5 w-3.5 ml-1" /> تفاصيل
          </Button>
        </div>
      )}

      {adminMode && task.status === "submitted" && (
        <div className="mt-3 flex gap-2 pt-3 border-t items-center">
          <Button size="sm" disabled={busy}
            onClick={() => act("approved", { approved_at: new Date().toISOString() })}>
            <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> اعتماد التسليم
          </Button>
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => act("rejected")}>
            رفض وإرجاع
          </Button>
          <Button size="sm" variant="outline" disabled={remindBusy} onClick={sendReminder}>
            <BellRing className="h-3.5 w-3.5 ml-1" /> تذكير
          </Button>
          <Button size="sm" variant="ghost" className="mr-auto" onClick={() => setOpenDetails(true)}>
            <ExternalLink className="h-3.5 w-3.5 ml-1" /> تفاصيل
          </Button>
        </div>
      )}

      {adminMode && task.status !== "submitted" && (
        <div className="mt-3 pt-3 border-t flex items-center">
          <Button size="sm" variant="outline" disabled={remindBusy} onClick={sendReminder}>
            <BellRing className="h-3.5 w-3.5 ml-1" /> تذكير
          </Button>
          <Button size="sm" variant="ghost" className="mr-auto" onClick={() => setOpenDetails(true)}>
            <ExternalLink className="h-3.5 w-3.5 ml-1" /> تفاصيل
          </Button>
        </div>
      )}

      <Sheet open={openDetails} onOpenChange={setOpenDetails}>
        <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto" dir="rtl">
          <TaskDetailView id={task.id} initialTask={task} />
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function ProgressTrack({ status }: { status: string }) {
  const steps = ["started", "progress_50", "in_review", "submitted"];
  const labels = ["بدأ", "50%", "مراجعة", "تسليم"];
  const idx = steps.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className="flex-1 flex items-center gap-1">
          <div className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
          <span className={`text-[10px] tabular-nums ${i <= idx ? "text-primary font-medium" : "text-muted-foreground"}`}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}