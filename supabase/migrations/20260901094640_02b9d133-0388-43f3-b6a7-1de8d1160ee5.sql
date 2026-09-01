REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_dept_member(uuid, dept_code) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_reception_or_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_task_reminder(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._notify_users(uuid[], text, text, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_task_reminder(uuid) TO authenticated;