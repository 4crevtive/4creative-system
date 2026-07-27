-- Portable bucket definitions so the project's storage layer can be recreated
-- from an empty Supabase project using ONLY this repository.
--
-- WHY THIS FILE EXISTS
-- Lovable Cloud creates storage buckets via its management API and does NOT
-- record bucket rows as SQL migrations. That means a bare `git clone` of this
-- repo, pointed at an empty Supabase project, would have all tables, RLS
-- policies, functions, and triggers — but no buckets — and the app's file
-- uploads (avatars, task attachments, contact media) would fail.
--
-- HOW TO APPLY (self-hosted / fresh Supabase project)
--   psql "$DATABASE_URL" -f supabase/portable/01_storage_buckets.sql
-- or, using the Supabase CLI on a project that treats this as a migration:
--   copy this file into supabase/migrations/ with a fresh timestamp and run
--   `supabase db push`.
--
-- On Lovable Cloud this file is a no-op — the buckets already exist and
-- ON CONFLICT keeps the statement idempotent.
--
-- Object-level RLS policies for these buckets are already in the versioned
-- migrations under supabase/migrations/ (search for 'avatars', 'task-files',
-- 'contact-media'). All three buckets are private (public = false).

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',       'avatars',       false),
  ('task-files',    'task-files',    false),
  ('contact-media', 'contact-media', false)
ON CONFLICT (id) DO NOTHING;
