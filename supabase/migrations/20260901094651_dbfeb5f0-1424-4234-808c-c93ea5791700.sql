REVOKE EXECUTE ON FUNCTION public._notif_task_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notif_task_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notif_task_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notify_users(uuid[], text, text, text, text, uuid, text, text) FROM authenticated;