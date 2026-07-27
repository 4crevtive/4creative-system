import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SearchHit = {
  kind: "task" | "project" | "client" | "contact" | "freelancer" | "user";
  id: string;
  title: string;
  subtitle?: string | null;
  route: string;
  params?: Record<string, string>;
};

function escLike(s: string) {
  return s.replace(/[%_\\]/g, (m) => "\\" + m);
}

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const s = context.supabase;
    const q = escLike(data.q);
    const like = `%${q}%`;
    const limit = 6;

    const [tasks, projects, clients, contacts, freelancers, users] = await Promise.all([
      s.from("tasks").select("id, title, project_name, client_name, status").or(`title.ilike.${like},client_name.ilike.${like},project_name.ilike.${like}`).limit(limit),
      s.from("agency_projects").select("id, name, description").ilike("name", like).limit(limit),
      s.from("agency_clients").select("id, name, contact_name, email").or(`name.ilike.${like},contact_name.ilike.${like},email.ilike.${like}`).limit(limit),
      s.from("contacts").select("id, full_name, phone, email").or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`).limit(limit),
      s.from("freelancers").select("id, full_name, phone, email, city").or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like},city.ilike.${like}`).limit(limit),
      s.from("profiles").select("id, name_ar, display_name, username, email, job_title").or(`name_ar.ilike.${like},display_name.ilike.${like},username.ilike.${like},email.ilike.${like},job_title.ilike.${like}`).limit(limit),
    ]);

    const hits: SearchHit[] = [];
    (tasks.data ?? []).forEach((t: { id: string; title: string; project_name: string | null; client_name: string | null }) =>
      hits.push({ kind: "task", id: t.id, title: t.title, subtitle: t.project_name ?? t.client_name, route: "/production/task/$id", params: { id: t.id } }),
    );
    (projects.data ?? []).forEach((p: { id: string; name: string; description: string | null }) =>
      hits.push({ kind: "project", id: p.id, title: p.name, subtitle: p.description, route: "/agency/projects/$id", params: { id: p.id } }),
    );
    (clients.data ?? []).forEach((c: { id: string; name: string; contact_name: string | null; email: string | null }) =>
      hits.push({ kind: "client", id: c.id, title: c.name, subtitle: c.contact_name ?? c.email, route: "/reception/clients/$id", params: { id: c.id } }),
    );
    (contacts.data ?? []).forEach((c: { id: string; full_name: string; phone: string | null; email: string | null }) =>
      hits.push({ kind: "contact", id: c.id, title: c.full_name, subtitle: c.phone ?? c.email, route: "/reception/crm" }),
    );
    (freelancers.data ?? []).forEach((f: { id: string; full_name: string; city: string | null; email: string | null }) =>
      hits.push({ kind: "freelancer", id: f.id, title: f.full_name, subtitle: f.city ?? f.email, route: "/freelancers" }),
    );
    (users.data ?? []).forEach((u: { id: string; name_ar: string | null; display_name: string | null; username: string | null; email: string | null; job_title: string | null }) =>
      hits.push({ kind: "user", id: u.id, title: u.name_ar ?? u.display_name ?? u.username ?? u.email ?? "موظف", subtitle: u.job_title ?? u.email, route: "/profile/$userId", params: { userId: u.id } }),
    );

    return hits;
  });