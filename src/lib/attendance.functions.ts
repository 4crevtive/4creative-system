import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: roles, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "super_admin");
  if (!isAdmin) throw new Error("غير مصرح");
}

/** Admin-only: check a user in. If an open log exists for today, returns it. */
export const adminCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), notes: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .eq("user_id", data.user_id)
      .eq("work_date", today)
      .is("check_out", null)
      .maybeSingle();
    if (existing) return existing;

    const { data: row, error } = await supabaseAdmin
      .from("attendance_logs")
      .insert({ user_id: data.user_id, work_date: today, check_in: new Date().toISOString(), notes: data.notes ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Admin-only: close the latest open log for a user (today). */
export const adminCheckOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: open, error: findErr } = await supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .eq("user_id", data.user_id)
      .is("check_out", null)
      .order("check_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!open) throw new Error("لا يوجد تسجيل دخول مفتوح لهذا الموظف");

    const { data: row, error } = await supabaseAdmin
      .from("attendance_logs")
      .update({ check_out: new Date().toISOString() })
      .eq("id", open.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Admin-only: full attendance history for a user. */
export const listUserAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), limit: z.number().int().min(1).max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (context.userId !== data.user_id) {
      await assertAdmin(context);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("attendance_logs")
      .select("*")
      .eq("user_id", data.user_id)
      .order("check_in", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });