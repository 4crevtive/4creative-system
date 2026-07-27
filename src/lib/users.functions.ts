import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const USERNAME_DOMAIN = "4creative.local";
const usernameRegex = /^[a-zA-Z0-9_.-]{3,32}$/;

function toEmail(username: string) {
  return `${username.toLowerCase()}@${USERNAME_DOMAIN}`;
}

async function assertCallerIsAdmin(context: { supabase: any; userId: string }) {
  const { data: roles, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "super_admin");
  if (!isAdmin) throw new Error("غير مصرح");
}

const RoleEnum = z.enum([
  "super_admin",
  "admin",
  "dept_manager",
  "dept_assistant",
  "reception",
  "staff",
  "viewer",
  "editor",
  "designer",
  "photographer",
]);

/** Admin-only: create a new user (admin or employee) with username/password */
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z.string().regex(usernameRegex, "اسم المستخدم غير صالح"),
        password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(128),
        display_name: z.string().min(1).max(120),
        name_ar: z.string().max(120).optional(),
        phone: z.string().max(40).optional(),
        roles: z.array(RoleEnum).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);

    const { createUsersAdminClient } = await import("./users-admin.server");
    const supabaseAdmin = createUsersAdminClient();
    const email = toEmail(data.username);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name, username: data.username },
    });
    if (createErr) throw new Error(createErr.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("تعذّر إنشاء المستخدم");

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      username: data.username,
      display_name: data.display_name,
      name_ar: data.name_ar ?? data.display_name,
      phone: data.phone ?? null,
      is_active: true,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`تم إنشاء حساب الدخول لكن فشل حفظ البروفايل: ${profileError.message}`);
    }

    const rolesRows = data.roles.map((role) => ({ user_id: userId, role }));
    const { error: rolesError } = await supabaseAdmin.from("user_roles").upsert(rolesRows, { onConflict: "user_id,role" });
    if (rolesError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`تم إنشاء حساب الدخول لكن فشل حفظ الصلاحيات: ${rolesError.message}`);
    }

    return { user_id: userId, username: data.username };
  });

/** Admin-only: list all users with their roles */
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCallerIsAdmin(context);

    const { createUsersAdminClient } = await import("./users-admin.server");
    const supabaseAdmin = createUsersAdminClient();
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, name_ar, phone, is_active, created_at, avatar_url, job_title, bio")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const byUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role as string);
      byUser.set(r.user_id, arr);
    });

    const byProfileId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) throw new Error(authError.message);

    const merged = new Map<string, {
      id: string;
      username: string | null;
      display_name: string | null;
      name_ar: string | null;
      phone: string | null;
      is_active: boolean;
      created_at: string | null;
      avatar_url: string | null;
      job_title: string | null;
      bio: string | null;
      roles: string[];
    }>();

    for (const authUser of authUsers.users ?? []) {
      const profile = byProfileId.get(authUser.id);
      const usernameFromEmail = authUser.email?.endsWith(`@${USERNAME_DOMAIN}`)
        ? authUser.email.slice(0, -`@${USERNAME_DOMAIN}`.length)
        : null;
      merged.set(authUser.id, {
        id: authUser.id,
        username: profile?.username ?? usernameFromEmail,
        display_name: profile?.display_name ?? authUser.user_metadata?.display_name ?? usernameFromEmail ?? authUser.email ?? null,
        name_ar: profile?.name_ar ?? null,
        phone: profile?.phone ?? null,
        is_active: profile?.is_active ?? true,
        created_at: profile?.created_at ?? authUser.created_at ?? null,
        avatar_url: profile?.avatar_url ?? null,
        job_title: profile?.job_title ?? null,
        bio: profile?.bio ?? null,
        roles: byUser.get(authUser.id) ?? [],
      });
    }

    for (const profile of profiles ?? []) {
      if (merged.has(profile.id)) continue;
      merged.set(profile.id, { ...profile, roles: byUser.get(profile.id) ?? [] });
    }

    return Array.from(merged.values()).sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  });

/** Admin-only: toggle a user's active flag */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const { createUsersAdminClient } = await import("./users-admin.server");
    const supabaseAdmin = createUsersAdminClient();
    await supabaseAdmin.from("profiles").update({ is_active: data.is_active }).eq("id", data.user_id);
    return { ok: true };
  });

/** Admin-only: update a user's profile, roles, and (optionally) password */
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        display_name: z.string().min(1).max(120).optional(),
        name_ar: z.string().max(120).optional(),
        phone: z.string().max(40).optional().nullable(),
        roles: z.array(RoleEnum).min(1).optional(),
        password: z.string().min(6).max(128).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const { createUsersAdminClient } = await import("./users-admin.server");
    const supabaseAdmin = createUsersAdminClient();

    const patch: { display_name?: string; name_ar?: string; phone?: string | null } = {};
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.name_ar !== undefined) patch.name_ar = data.name_ar;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }

    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
      if (error) throw new Error(error.message);
    }

    if (data.roles) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      const rows = data.roles.map((role) => ({ user_id: data.user_id, role }));
      const { error } = await supabaseAdmin.from("user_roles").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

/** Admin-only: permanently delete a user */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    if (data.user_id === context.userId) throw new Error("لا يمكن حذف حسابك");

    const { createUsersAdminClient } = await import("./users-admin.server");
    const supabaseAdmin = createUsersAdminClient();
    // Block deleting a super_admin
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.user_id);
    if ((targetRoles ?? []).some((r) => r.role === "super_admin")) {
      throw new Error("لا يمكن حذف مدير عام");
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });