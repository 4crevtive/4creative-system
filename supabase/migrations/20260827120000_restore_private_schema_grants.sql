-- =============================================================================
-- Fix: "permission denied for schema private" when creating/querying tasks
-- =============================================================================
-- Symptom: adding (or reading) any task fails with the Postgres error
--   "permission denied for schema private".
--
-- Root cause
-- ----------
-- RLS helper functions (is_admin, has_role, is_dept_member, is_project_member,
-- is_reception_or_admin, can_access_task) live in the `private` schema. The
-- public RLS wrappers are SECURITY INVOKER, e.g.:
--
--   CREATE FUNCTION public.can_access_task(...)
--     ... SECURITY INVOKER SET search_path = public, private
--   AS $$ SELECT private.can_access_task(_user_id, _task_id) $$;
--
-- Because they run with the CALLER's privileges, the `authenticated` role needs
--   * USAGE  on schema `private`, and
--   * EXECUTE on the underlying `private.*` functions.
--
-- The tasks SELECT policy ("Task access read") calls public.can_access_task
-- on EVERY task query, and the add-task flow queries tasks + profiles, so it is
-- the first thing to fail when the grant is missing.
--
-- The grants below DO exist in migration 20260706103856, but on this/your cloud
-- Supabase instance they were lost (migration drift / partial apply), so they
-- are re-asserted here idempotently. Safe to run more than once.
-- =============================================================================

-- Make sure the schema exists (no-op if it already does).
CREATE SCHEMA IF NOT EXISTS private;

-- Restore USAGE on the schema for the app roles.
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Restore EXECUTE on the private helper functions (only if they exist).
DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'private.is_admin(uuid)',
    'private.has_role(uuid, public.app_role)',
    'private.is_dept_member(uuid, public.dept_code)',
    'private.is_project_member(uuid, uuid)',
    'private.is_reception_or_admin(uuid)',
    'private.can_access_task(uuid, uuid)'
  ] LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';