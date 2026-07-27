-- Restore public wrapper functions for RLS helpers so existing policies keep working
-- after the helpers were moved to the private schema. Wrappers are SECURITY INVOKER
-- and simply delegate to the private (SECURITY DEFINER) implementations, so no
-- privilege escalation is added and previously accepted security posture is preserved.

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private
AS $$ SELECT private.is_admin(_user_id) $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.is_dept_member(_user_id uuid, _dept public.dept_code)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private
AS $$ SELECT private.is_dept_member(_user_id, _dept) $$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private
AS $$ SELECT private.is_project_member(_user_id, _project_id) $$;

CREATE OR REPLACE FUNCTION public.is_reception_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private
AS $$ SELECT private.is_reception_or_admin(_user_id) $$;

CREATE OR REPLACE FUNCTION public.can_access_task(_user_id uuid, _task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private
AS $$ SELECT private.can_access_task(_user_id, _task_id) $$;

-- Wrappers must be executable by app roles so RLS policies can call them.
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_dept_member(uuid, public.dept_code) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_reception_or_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';