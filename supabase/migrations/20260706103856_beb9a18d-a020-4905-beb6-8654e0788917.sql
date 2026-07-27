
-- 1) Move RLS helper functions to a private schema (not exposed via the API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.is_admin(uuid) SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_dept_member(uuid, public.dept_code) SET SCHEMA private;
ALTER FUNCTION public.is_project_member(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_reception_or_admin(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_access_task(uuid, uuid) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_dept_member(uuid, public.dept_code) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_project_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_reception_or_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_task(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_dept_member(uuid, public.dept_code) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_project_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_reception_or_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_task(uuid, uuid) TO authenticated, service_role;

-- 2) Lock down trigger-only function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- 3) Move internal_notes into its own admin-only table
CREATE TABLE IF NOT EXISTS public.task_internal_notes (
  task_id uuid PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_internal_notes TO authenticated;
GRANT ALL ON public.task_internal_notes TO service_role;
ALTER TABLE public.task_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read task internal notes" ON public.task_internal_notes
  FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY "Admins insert task internal notes" ON public.task_internal_notes
  FOR INSERT TO authenticated WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "Admins update task internal notes" ON public.task_internal_notes
  FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "Admins delete task internal notes" ON public.task_internal_notes
  FOR DELETE TO authenticated USING (private.is_admin(auth.uid()));

INSERT INTO public.task_internal_notes (task_id, notes)
SELECT id, internal_notes FROM public.tasks WHERE internal_notes IS NOT NULL
ON CONFLICT (task_id) DO NOTHING;

ALTER TABLE public.tasks DROP COLUMN IF EXISTS internal_notes;

-- 4) Reject non-http(s) URLs on task references (blocks javascript: injection)
UPDATE public.task_references SET url = 'https://' || url
WHERE url IS NOT NULL AND url !~* '^https?://';

ALTER TABLE public.task_references
  DROP CONSTRAINT IF EXISTS task_references_url_http_only;
ALTER TABLE public.task_references
  ADD CONSTRAINT task_references_url_http_only
  CHECK (url ~* '^https?://');
