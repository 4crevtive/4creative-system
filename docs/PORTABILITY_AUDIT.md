# Portability Audit — Vendor Lock-In Report

**Goal:** the entire schema must be recreatable from an empty Supabase project using only this repository.

## ✅ Fully in source control (`supabase/migrations/`)

30 timestamped migration files cover:

- **Tables** — all 38 `public.*` tables (39 `CREATE TABLE public.*` statements across migrations vs 38 live tables ⇒ full coverage).
- **RLS policies on `public.*`** — every live policy (~110) is created by a migration; no policy exists only in the dashboard.
- **RLS policies on `storage.objects`** — all 12 live policies (avatars ×4, task-files ×4, contact-media ×4) are created by migrations.
- **Database functions** — all 15 `public.*` functions (`has_role`, `is_admin`, `is_dept_member`, `is_project_member`, `is_reception_or_admin`, `can_access_task`, `handle_new_user`, `set_updated_at`, `validate_booking`, `validate_task_assignee_schedule`, `send_task_reminder`, `_notify_users`, `_notif_task_insert`, `_notif_task_update`, `_notif_task_comment`) are `CREATE OR REPLACE FUNCTION` in migrations.
- **Triggers** — all triggers (`set_updated_at`, `handle_new_user`, task notification triggers, booking/task validation triggers) are in migrations.
- **Enums / custom types** — `app_role`, `dept_code`, etc. defined in migrations.
- **GRANTs** — table grants to `anon`/`authenticated`/`service_role` are in migrations.
- **Server-side app logic** — TanStack `createServerFn` files (`src/lib/*.functions.ts`) and server routes (`src/routes/api/**`) live in the repo. No Supabase Edge Functions exist in this project (`supabase/functions/` is absent).

## ⚠️ Gap fixed in this change

**Storage bucket rows** (`avatars`, `task-files`, `contact-media`) previously existed only in the Lovable Cloud project — the management API creates them and does not write a migration. Added:

- **`supabase/portable/01_storage_buckets.sql`** — idempotent `INSERT ... ON CONFLICT DO NOTHING` into `storage.buckets`. On a fresh Supabase project run `psql -f` on this file (or copy it into `supabase/migrations/` with a fresh timestamp and `supabase db push`). On Lovable Cloud it is a no-op.

  It is deliberately outside `supabase/migrations/` because that folder is managed by Lovable's migration tool, which rejects direct `storage.buckets` inserts (buckets are managed via the storage API on Cloud). The file is still in Git, so `git clone` restores it.

## ❌ Still exclusively in Lovable Cloud (cannot be codified as SQL)

These are runtime state / provider-side configuration — no infrastructure-as-code path exists in Supabase itself; they must be re-established out-of-band on a new project.

| Resource | Where it lives | How to recreate |
| --- | --- | --- |
| Live table rows (users, tasks, contacts, invoices, …) | Cloud DB | Export via Cloud → Advanced settings → Export data; re-import with `pg_restore` / `COPY` |
| `auth.users` (accounts + hashed passwords) | Cloud auth | Supabase Auth Admin export/import; users may need password reset |
| Uploaded storage objects (files in the 3 buckets) | Cloud storage | Manually download + re-upload; no built-in export |
| Auth providers enabled (Google OAuth, email) | Cloud auth config | Re-enable in the new project's Auth settings; re-enter Google OAuth client ID/secret |
| SMTP config, email templates, redirect URLs, JWT settings, rate limits | Cloud auth config | Re-configure in new project's Auth settings |
| Managed secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `LOVABLE_API_KEY` | Cloud runtime env injection | Auto-provided on any Supabase project; `LOVABLE_API_KEY` is Lovable-specific and only needed if you keep the Lovable AI Gateway |
| User-supplied secrets (any 3rd-party API keys added via `add_secret`) | Cloud secret store | Re-enter manually on the new host |
| Connector credentials (OAuth tokens for linked services) | Lovable Connectors | Reconnect in the new environment |
| Published `.lovable.app` URL + custom domains | Lovable deploy | Republish from new host (Vercel/Netlify/self-host); reconfigure DNS |
| Realtime publications / dashboard-toggled extensions | Cloud DB config | Enable extensions and add tables to `supabase_realtime` publication on the new project (none currently needed by this app) |

None of the above is a code artifact; they are per-environment configuration and per-tenant data. This is inherent to any hosted DB/auth provider — not Lovable-specific lock-in.

## Verification checklist for a bare-clone rebuild

1. `git clone` this repo into a fresh Supabase project.
2. `supabase db push` — runs all 30 migrations → schema + RLS + functions + triggers.
3. `psql "$DATABASE_URL" -f supabase/portable/01_storage_buckets.sql` — creates the 3 buckets.
4. Set env vars: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (+ `VITE_*` twins).
5. Enable Google OAuth in the new project's Auth settings (client ID/secret required).
6. `bun install && bun run build` — app boots against the new backend.

Everything the repo owns will restore. Anything above marked ❌ requires manual re-provisioning — that's the true, irreducible boundary.
