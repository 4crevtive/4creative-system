CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$ SELECT private.has_role(_user_id, _role) $function$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$ SELECT private.is_admin(_user_id) $function$;

CREATE OR REPLACE FUNCTION public.is_dept_member(_user_id uuid, _dept dept_code)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$ SELECT private.is_dept_member(_user_id, _dept) $function$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$ SELECT private.is_project_member(_user_id, _project_id) $function$;

CREATE OR REPLACE FUNCTION public.is_reception_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$ SELECT private.is_reception_or_admin(_user_id) $function$;

CREATE OR REPLACE FUNCTION public.can_access_task(_user_id uuid, _task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $function$ SELECT private.can_access_task(_user_id, _task_id) $function$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dept_member(uuid, dept_code) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_reception_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid, uuid) TO authenticated;