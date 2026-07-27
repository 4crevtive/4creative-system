import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Full employee profile: profile row + roles + department + task stats + attendance stats. */
export const getEmployeeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const uid = data.user_id;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("الموظف غير موجود");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);

    const department = profile.primary_department_id
      ? (
          await supabase
            .from("departments")
            .select("id, name_ar, code")
            .eq("id", profile.primary_department_id)
            .maybeSingle()
        ).data
      : null;

    const { data: taskRows } = await supabase
      .from("tasks")
      .select("id, status, created_at")
      .eq("assignee_id", uid);
    const tasks = taskRows ?? [];
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter((t) => ["approved", "completed", "uploaded"].includes(t.status as string)).length,
      active: tasks.filter((t) => ["pending", "started", "progress_50", "in_review", "accepted", "shooting_started"].includes(t.status as string)).length,
      rejected: tasks.filter((t) => t.status === "rejected").length,
    };

    const { data: attRows } = await supabase
      .from("attendance_logs")
      .select("check_in, check_out, work_date")
      .eq("user_id", uid);
    const att = attRows ?? [];
    let totalSeconds = 0;
    const days = new Set<string>();
    for (const l of att) {
      days.add(l.work_date as string);
      const end = l.check_out ? new Date(l.check_out as string) : new Date();
      const start = new Date(l.check_in as string);
      totalSeconds += Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    }

    return {
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
      department,
      task_stats: taskStats,
      attendance_stats: {
        total_seconds: totalSeconds,
        days_attended: days.size,
        sessions: att.length,
      },
    };
  });

/** Recent tasks assigned to the user (RLS-filtered — self, admin, or collaborators). */
export const getEmployeeTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), limit: z.number().int().min(1).max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tasks")
      .select("id, title, status, type, priority, due_at, created_at, updated_at, project_name, client_name")
      .eq("assignee_id", data.user_id)
      .order("updated_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Update the caller's own profile (bio, job title, phone, avatar_url, cover_url, etc.) */
export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        display_name: z.string().min(1).max(120).optional(),
        name_ar: z.string().max(120).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        bio: z.string().max(1000).optional().nullable(),
        job_title: z.string().max(120).optional().nullable(),
        join_date: z.string().optional().nullable(),
        birthday: z.string().optional().nullable(),
        address: z.string().max(500).optional().nullable(),
        emergency_contact: z.string().max(200).optional().nullable(),
        skills: z.array(z.string().max(60)).max(30).optional().nullable(),
        avatar_url: z.string().optional().nullable(),
        cover_url: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await (context.supabase.from("profiles") as unknown as {
      update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    }).update(patch).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
