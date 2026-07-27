import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Camera, Smartphone, ChevronRight, ChevronLeft, Clock, Trash2, Search, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { addMinutes, addDays, format, startOfDay, endOfDay, startOfWeek, isSameDay, differenceInMinutes } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { bookingSchema, validateForm } from "@/lib/validation";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 24; // exclusive
const HOUR_PX = 56;
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const GRID_HEIGHT = TOTAL_HOURS * HOUR_PX;

type Booking = {
  id: string;
  room_id: string;
  starts_at: string;
  ends_at: string;
  capture_device: string;
  cameras_count: number;
  script_ready: boolean;
  editing_required: boolean;
  notes: string | null;
  status: string;
  contact?: { full_name?: string; type?: string } | null;
  room?: { code?: string; name_ar?: string } | null;
};

const ROOM_TONES: Record<string, { bg: string; ring: string; chip: string; text: string }> = {
  room_1: { bg: "bg-violet-500/15", ring: "ring-violet-500/40", chip: "bg-violet-500", text: "text-violet-700 dark:text-violet-300" },
  room_2: { bg: "bg-sky-500/15", ring: "ring-sky-500/40", chip: "bg-sky-500", text: "text-sky-700 dark:text-sky-300" },
  room_3: { bg: "bg-emerald-500/15", ring: "ring-emerald-500/40", chip: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
};
const DEFAULT_TONE = { bg: "bg-primary/15", ring: "ring-primary/40", chip: "bg-primary", text: "text-primary" };
const toneFor = (code?: string) => (code && ROOM_TONES[code]) || DEFAULT_TONE;

export function BookingsView({ title = "الحجوزات والمواعيد", subtitle = "تقويم الغرف الثلاث مع منع التعارض تلقائياً" }: { title?: string; subtitle?: string }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [createPrefill, setCreatePrefill] = useState<{ date: string; time: string; roomId?: string } | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  const rangeStart = view === "week" ? startOfWeek(anchor, { weekStartsOn: 6 /* Saturday */ }) : anchor;
  const rangeEnd = view === "week" ? addDays(rangeStart, 7) : addDays(anchor, 1);

  const days = useMemo(() => Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => addDays(rangeStart, i)), [rangeStart, view]);

  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await supabase.from("rooms").select("*").order("code")).data ?? [],
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => (await supabase.from("bookings")
      .select("*, contact:contacts(full_name, type), room:rooms(code, name_ar)")
      .gte("starts_at", rangeStart.toISOString())
      .lt("starts_at", rangeEnd.toISOString())
      .order("starts_at")).data as Booking[] ?? [],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["bookings"] });

  const openCreateAt = (date: Date, hour: number, minute = 0, roomId?: string) => {
    setCreatePrefill({
      date: format(date, "yyyy-MM-dd"),
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      roomId,
    });
    setOpenCreate(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Button onClick={() => { setCreatePrefill(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 ml-1" /> حجز جديد
        </Button>
      </div>

      <Card className="p-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>اليوم</Button>
          <div className="flex">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor(addDays(anchor, view === "week" ? -7 : -1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor(addDays(anchor, view === "week" ? 7 : 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-base md:text-lg font-semibold mr-2">
            {view === "week"
              ? `${format(rangeStart, "d MMM", { locale: ar })} – ${format(addDays(rangeStart, 6), "d MMM yyyy", { locale: ar })}`
              : format(anchor, "EEEE، d MMMM yyyy", { locale: ar })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            {(rooms ?? []).map((r) => {
              const t = toneFor(r.code);
              return <span key={r.id} className="inline-flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-full", t.chip)} />{r.name_ar}</span>;
            })}
          </div>
          <div className="inline-flex rounded-md border p-0.5">
            <button onClick={() => setView("day")} className={cn("px-3 py-1 text-xs rounded-sm", view === "day" && "bg-primary text-primary-foreground")}>يوم</button>
            <button onClick={() => setView("week")} className={cn("px-3 py-1 text-xs rounded-sm", view === "week" && "bg-primary text-primary-foreground")}>أسبوع</button>
          </div>
        </div>
      </Card>

      <AvailabilitySearch rooms={rooms ?? []} onJumpTo={(d: Date) => setAnchor(startOfDay(d))} />

      <Card className="p-0 overflow-hidden">
        <CalendarGrid
          days={days}
          rooms={rooms ?? []}
          bookings={bookings ?? []}
          view={view}
          onSlotClick={openCreateAt}
          onChanged={refresh}
        />
      </Card>

      <NewBookingDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        prefill={createPrefill}
        rooms={rooms ?? []}
        onCreated={refresh}
      />
    </div>
  );
}

function CalendarGrid({
  days, rooms, bookings, view, onSlotClick, onChanged,
}: {
  days: Date[];
  rooms: { id: string; code: string; name_ar: string }[];
  bookings: Booking[];
  view: "day" | "week";
  onSlotClick: (date: Date, hour: number, minute: number, roomId?: string) => void;
  onChanged: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to ~8:30 of working window on mount
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = Math.max(0, (10 - DAY_START_HOUR) * HOUR_PX - 40);
    }
  }, [view]);

  const hours = useMemo(() => Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i), []);

  return (
    <div ref={scrollerRef} className="relative max-h-[72vh] overflow-auto" dir="rtl">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b">
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="border-l" />
          {days.map((d) => {
            const today = isSameDay(d, new Date());
            return (
              <div key={d.toISOString()} className={cn("px-3 py-2 text-center border-l last:border-l-0", today && "bg-primary/5")}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {format(d, "EEEE", { locale: ar })}
                </div>
                <div className={cn("text-lg font-semibold tabular-nums leading-tight", today && "text-primary")}>
                  {format(d, "d MMM", { locale: ar })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="grid relative" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
        {/* Time gutter */}
        <div className="border-l" style={{ height: GRID_HEIGHT }}>
          {hours.map((h) => (
            <div key={h} className="relative" style={{ height: HOUR_PX }}>
              <div className="absolute -top-2 left-1 text-[11px] tabular-nums text-muted-foreground">
                {String(h).padStart(2, "0")}:00
              </div>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const dayBookings = bookings.filter((b) => isSameDay(new Date(b.starts_at), day));
          const isToday = isSameDay(day, now);
          const nowOffset = isToday ? minutesToOffset(differenceInMinutes(now, startOfDay(day)) - DAY_START_HOUR * 60) : null;
          return (
            <div key={day.toISOString()} className="relative border-l last:border-l-0" style={{ height: GRID_HEIGHT }}>
              {/* Hour lines */}
              {hours.map((h, idx) => (
                <div
                  key={h}
                  className={cn("absolute inset-x-0 border-t", idx === 0 && "border-t-0")}
                  style={{ top: idx * HOUR_PX }}
                />
              ))}
              {/* Click-to-create slots (every 30min) */}
              {hours.flatMap((h) => [0, 30].map((m) => (
                <button
                  key={`${h}-${m}`}
                  onClick={() => onSlotClick(day, h, m)}
                  className="absolute inset-x-0 hover:bg-primary/5 transition-colors"
                  style={{ top: (h - DAY_START_HOUR) * HOUR_PX + (m === 30 ? HOUR_PX / 2 : 0), height: HOUR_PX / 2 }}
                  aria-label={`حجز جديد ${h}:${m}`}
                />
              )))}

              {/* Now indicator */}
              {nowOffset !== null && nowOffset >= 0 && nowOffset <= GRID_HEIGHT && (
                <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: nowOffset }}>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500 -mr-1 shadow" />
                    <div className="h-px flex-1 bg-rose-500" />
                  </div>
                </div>
              )}

              {/* Events */}
              <EventLayer bookings={dayBookings} rooms={rooms} onChanged={onChanged} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function minutesToOffset(minutesFromGridStart: number) {
  return (minutesFromGridStart / 60) * HOUR_PX;
}

/** Lay out events with horizontal slotting when they overlap. */
function EventLayer({ bookings, rooms, onChanged }: { bookings: Booking[]; rooms: { id: string; code: string; name_ar: string }[]; onChanged: () => void }) {
  const sorted = [...bookings].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const columns: Booking[][] = [];
  const placement = new Map<string, { col: number; cols: number }>();

  for (const b of sorted) {
    let placed = false;
    for (let i = 0; i < columns.length; i++) {
      const last = columns[i][columns[i].length - 1];
      if (new Date(last.ends_at) <= new Date(b.starts_at)) {
        columns[i].push(b);
        placement.set(b.id, { col: i, cols: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([b]);
      placement.set(b.id, { col: columns.length - 1, cols: 0 });
    }
  }
  // resolve cols per event: number of overlapping concurrent columns at its time
  for (const b of sorted) {
    const start = new Date(b.starts_at);
    const end = new Date(b.ends_at);
    let concurrent = 0;
    for (const other of sorted) {
      if (new Date(other.starts_at) < end && new Date(other.ends_at) > start) concurrent++;
    }
    placement.get(b.id)!.cols = Math.max(concurrent, columns.length);
  }

  return (
    <>
      {sorted.map((b) => {
        const start = new Date(b.starts_at);
        const end = new Date(b.ends_at);
        const startMin = start.getHours() * 60 + start.getMinutes() - DAY_START_HOUR * 60;
        const durMin = Math.max(15, differenceInMinutes(end, start));
        const top = minutesToOffset(startMin);
        const height = Math.max(24, minutesToOffset(durMin) - 2);
        const p = placement.get(b.id)!;
        const widthPct = 100 / Math.max(1, columns.length);
        const leftPct = p.col * widthPct;
        const tone = toneFor(b.room?.code);
        return (
          <BookingChip
            key={b.id}
            booking={b}
            onChanged={onChanged}
            tone={tone}
            style={{
              top,
              height,
              right: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 6px)`,
            }}
          />
        );
      })}
      {/* rooms is reserved for future room-filtering UI */}
      <span className="hidden" aria-hidden>{rooms.length}</span>
    </>
  );
}

function BookingChip({
  booking, tone, style, onChanged,
}: {
  booking: Booking;
  tone: { bg: string; ring: string; chip: string; text: string };
  style: React.CSSProperties;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);

  async function del() {
    if (!confirm("حذف هذا الحجز؟")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الحجز");
    setOpen(false);
    onChanged();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "absolute z-10 rounded-md p-1.5 text-right ring-1 overflow-hidden text-xs shadow-sm hover:shadow-md transition-shadow",
            tone.bg, tone.ring,
          )}
          style={style}
        >
          <div className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", tone.chip)} />
            <span className="font-semibold truncate">{booking.contact?.full_name ?? "—"}</span>
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {format(start, "HH:mm")} – {format(end, "HH:mm")}
          </div>
          <div className={cn("text-[10px] truncate", tone.text)}>{booking.room?.name_ar}</div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 pointer-events-auto" align="start">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{booking.contact?.full_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{booking.room?.name_ar}</div>
            </div>
            <Badge variant="secondary">{booking.status}</Badge>
          </div>
          <div className="text-sm tabular-nums flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {format(start, "EEEE d MMM، HH:mm", { locale: ar })} – {format(end, "HH:mm")}
          </div>
          <div className="flex gap-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {booking.capture_device === "iphone" ? <Smartphone className="h-3 w-3 ml-1" /> : <Camera className="h-3 w-3 ml-1" />}
              {booking.cameras_count} كاميرا
            </Badge>
            {booking.script_ready && <Badge variant="outline" className="text-xs">سكريبت جاهز</Badge>}
            {!booking.editing_required && <Badge variant="outline" className="text-xs">بدون مونتاج</Badge>}
          </div>
          {booking.notes && <div className="text-xs text-muted-foreground border-t pt-2">{booking.notes}</div>}
          <div className="flex justify-end pt-1">
            <Button variant="ghost" size="sm" onClick={del} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 ml-1" /> حذف
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NewBookingDialog({
  open, onOpenChange, prefill, rooms, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill: { date: string; time: string; roomId?: string } | null;
  rooms: { id: string; name_ar: string; code: string }[];
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_id: "", room_id: "", date: format(new Date(), "yyyy-MM-dd"),
    start_time: "10:00", duration_min: 60,
    capture_device: "camera" as "camera" | "iphone",
    cameras_count: 1, script_ready: false, editing_required: true, notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        date: prefill?.date ?? format(new Date(), "yyyy-MM-dd"),
        start_time: prefill?.time ?? "10:00",
        room_id: prefill?.roomId ?? f.room_id,
      }));
    }
  }, [open, prefill]);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-lite"],
    queryFn: async () => (await supabase.from("contacts").select("id, full_name, type").order("full_name")).data ?? [],
    enabled: open,
  });

  async function save() {
    const starts = new Date(`${form.date}T${form.start_time}`);
    const ends = addMinutes(starts, Number(form.duration_min));
    const v = validateForm(bookingSchema, {
      room_id: form.room_id,
      contact_id: form.contact_id,
      starts_at: starts,
      ends_at: ends,
      notes: form.notes,
    });
    if (!v.ok) return;
    setSaving(true);
    // Pre-check for conflicts (with 30-min buffer) on the selected room
    const bufferStart = addMinutes(starts, -30).toISOString();
    const bufferEnd = addMinutes(ends, 30).toISOString();
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id, starts_at, ends_at, status")
      .eq("room_id", form.room_id)
      .not("status", "in", "(cancelled,no_show)")
      .lt("starts_at", bufferEnd)
      .gt("ends_at", bufferStart);
    if (conflicts && conflicts.length > 0) {
      setSaving(false);
      toast.error("هذا الموعد محجوز مسبقاً في نفس الغرفة (يجب ترك 30 دقيقة على الأقل بين الحجوزات).");
      return;
    }
    const { error } = await supabase.from("bookings").insert({
      contact_id: form.contact_id, room_id: form.room_id,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      capture_device: form.capture_device, cameras_count: form.cameras_count,
      script_ready: form.script_ready, editing_required: form.editing_required,
      notes: form.notes, status: "confirmed",
    });
    setSaving(false);
    if (error) {
      const msg = /تعارض|محجوز|conflict|overlap/i.test(error.message)
        ? "هذا الموعد محجوز مسبقاً. يُرجى اختيار وقت آخر."
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success("تم إنشاء الحجز");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>إنشاء حجز جديد</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>العميل *</Label>
            <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
              <SelectContent>
                {(contacts ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الغرفة *</Label>
            <Select value={form.room_id} onValueChange={(v) => setForm({ ...form, room_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر الغرفة" /></SelectTrigger>
              <SelectContent>
                {(rooms ?? []).map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex flex-col items-start">
                      <span>{r.name_ar}</span>
                      {r.notes && <span className="text-xs text-muted-foreground">{r.notes}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>التاريخ</Label><Input type="date" dir="ltr" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-2"><Label>المدة (دقيقة)</Label><Input type="number" min={15} step={15} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: +e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>وقت البداية</Label><Input type="time" dir="ltr" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>وقت النهاية (تلقائي)</Label>
              <Input
                type="time"
                dir="ltr"
                readOnly
                tabIndex={-1}
                className="bg-muted/40 cursor-not-allowed"
                value={(() => {
                  try {
                    const s = new Date(`${form.date}T${form.start_time}`);
                    if (isNaN(+s)) return "";
                    return format(addMinutes(s, Number(form.duration_min) || 0), "HH:mm");
                  } catch { return ""; }
                })()}
                onChange={() => {}}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>جهاز التصوير</Label>
              <Select value={form.capture_device} onValueChange={(v) => setForm({ ...form, capture_device: v as "camera" | "iphone" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera">كاميرا</SelectItem>
                  <SelectItem value="iphone">iPhone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عدد الكاميرات</Label>
              <Select value={String(form.cameras_count)} onValueChange={(v) => setForm({ ...form, cameras_count: +v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <Label htmlFor="sc">السكريبت جاهز؟</Label>
            <Switch id="sc" checked={form.script_ready} onCheckedChange={(v) => setForm({ ...form, script_ready: v })} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <div>
              <Label htmlFor="ed">يحتاج مونتاج؟</Label>
              {!form.editing_required && <div className="text-xs text-muted-foreground mt-1">⚠ ذكّر العميل بإحضار فلاشة أو ميموري</div>}
            </div>
            <Switch id="ed" checked={form.editing_required} onCheckedChange={(v) => setForm({ ...form, editing_required: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "إنشاء الحجز"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function AvailabilitySearch({
  rooms,
  onJumpTo,
}: {
  rooms: { id: string; code: string; name_ar: string }[];
  onJumpTo: (d: Date) => void;
}) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [roomId, setRoomId] = useState<string>("any");
  const [query, setQuery] = useState("");
  const [triggered, setTriggered] = useState(false);

  const starts = useMemo(() => {
    const d = new Date(`${date}T${time}`);
    return isNaN(+d) ? null : d;
  }, [date, time]);
  const ends = useMemo(() => (starts ? addMinutes(starts, Number(duration) || 0) : null), [starts, duration]);

  const dayStart = useMemo(() => (starts ? startOfDay(starts).toISOString() : null), [starts]);
  const dayEnd = useMemo(() => (starts ? endOfDay(starts).toISOString() : null), [starts]);

  const { data: dayBookings } = useQuery({
    queryKey: ["bookings-search", dayStart, dayEnd, query],
    enabled: triggered && !!dayStart && !!dayEnd,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, contact:contacts(full_name, phone, type), room:rooms(code, name_ar)")
        .gte("starts_at", dayStart!)
        .lt("starts_at", dayEnd!)
        .order("starts_at");
      return (data as Booking[]) ?? [];
    },
  });

  const results = useMemo(() => {
    if (!dayBookings) return [];
    const q = query.trim().toLowerCase();
    if (!q) return dayBookings;
    return dayBookings.filter((b: any) => {
      const parts = [
        b.contact?.full_name,
        b.contact?.phone,
        b.contact?.type,
        b.room?.name_ar,
        b.room?.code,
        b.notes,
        b.status,
        b.capture_device,
        format(new Date(b.starts_at), "HH:mm"),
        format(new Date(b.ends_at), "HH:mm"),
      ]
        .filter(Boolean)
        .map(String)
        .join(" ")
        .toLowerCase();
      return parts.includes(q);
    });
  }, [dayBookings, query]);

  const availability = useMemo(() => {
    if (!triggered || !starts || !ends || !dayBookings) return null;
    const bufferStart = addMinutes(starts, -30);
    const bufferEnd = addMinutes(ends, 30);
    const conflicts = dayBookings.filter((b: any) => {
      if (b.status === "cancelled" || b.status === "no_show") return false;
      if (roomId !== "any" && b.room_id !== roomId) return false;
      const bs = new Date(b.starts_at);
      const be = new Date(b.ends_at);
      return bs < bufferEnd && be > bufferStart;
    });
    return {
      available: conflicts.length === 0,
      conflicts,
    };
  }, [triggered, starts, ends, dayBookings, roomId]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">البحث والتحقق من التوفر</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">اليوم</Label>
          <Input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">الساعة</Label>
          <Input type="time" dir="ltr" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">المدة (د)</Label>
          <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(+e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">الغرفة</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">كل الغرف</SelectItem>
              {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name_ar}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">بحث حر (اسم/هاتف/ملاحظات)</Label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="اكتب للبحث..." />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setTriggered(true)}>
          <Search className="h-4 w-4 ml-1" /> بحث وتحقق
        </Button>
        {starts && (
          <Button size="sm" variant="outline" onClick={() => onJumpTo(starts)}>
            الانتقال إلى هذا اليوم في التقويم
          </Button>
        )}
        {triggered && (
          <Button size="sm" variant="ghost" onClick={() => { setTriggered(false); setQuery(""); }}>
            مسح
          </Button>
        )}
      </div>

      {triggered && availability && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md p-3 text-sm ring-1",
            availability.available
              ? "bg-emerald-500/10 ring-emerald-500/40 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/10 ring-rose-500/40 text-rose-800 dark:text-rose-300",
          )}
        >
          {availability.available ? <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" /> : <XCircle className="h-5 w-5 mt-0.5 shrink-0" />}
          <div className="flex-1">
            {availability.available ? (
              <div>
                <div className="font-semibold">الموعد متاح ✓</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {starts && ends && `${format(starts, "EEEE d MMMM yyyy", { locale: ar })} · ${format(starts, "HH:mm")} – ${format(ends, "HH:mm")}`}
                  {roomId !== "any" && ` · ${rooms.find((r) => r.id === roomId)?.name_ar}`}
                </div>
              </div>
            ) : (
              <div>
                <div className="font-semibold">الموعد غير متاح ✗</div>
                <div className="text-xs opacity-80 mt-1 space-y-0.5">
                  <div>يوجد تعارض مع {availability.conflicts.length} حجز (مع فاصل 30 دقيقة):</div>
                  {availability.conflicts.slice(0, 3).map((b: any) => (
                    <div key={b.id}>
                      • {b.contact?.full_name ?? "—"} · {b.room?.name_ar} · {format(new Date(b.starts_at), "HH:mm")}–{format(new Date(b.ends_at), "HH:mm")}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {triggered && dayBookings && (
        <div className="border-t pt-3">
          <div className="text-xs text-muted-foreground mb-2">
            حجوزات اليوم ({results.length}{query ? ` من ${dayBookings.length}` : ""}):
          </div>
          {results.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">لا توجد نتائج مطابقة</div>
          ) : (
            <div className="max-h-64 overflow-auto space-y-1.5">
              {results.map((b: any) => {
                const tone = toneFor(b.room?.code);
                return (
                  <div key={b.id} className={cn("flex items-center justify-between gap-2 rounded-md p-2 text-sm ring-1", tone.bg, tone.ring)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.contact?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {b.room?.name_ar} · {format(new Date(b.starts_at), "HH:mm")}–{format(new Date(b.ends_at), "HH:mm")}
                        {b.notes ? ` · ${b.notes}` : ""}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{b.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
