CREATE OR REPLACE FUNCTION public._priority_label(_p integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT CASE _p WHEN 1 THEN 'urgent' WHEN 2 THEN 'high' WHEN 3 THEN 'medium' WHEN 4 THEN 'low' ELSE 'medium' END $$;

REVOKE EXECUTE ON FUNCTION public._priority_label(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._notif_task_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public._notify_users(
      ARRAY[NEW.assignee_id],
      'تم إسناد تاسك جديد لك',
      NEW.title,
      '/production/task/' || NEW.id::text,
      'task_assigned', NEW.id, 'task',
      public._priority_label(NEW.priority)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._notif_task_comment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  t record;
  watcher_ids uuid[];
  targets uuid[];
BEGIN
  SELECT id, title, assignee_id, created_by, priority INTO t
    FROM public.tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(array_agg(DISTINCT w.user_id), ARRAY[]::uuid[]) INTO watcher_ids
  FROM public.task_watchers w WHERE w.task_id = t.id;

  targets := ARRAY(
    SELECT DISTINCT x FROM unnest(watcher_ids || ARRAY[t.assignee_id, t.created_by]) AS x
    WHERE x IS NOT NULL AND x <> COALESCE(NEW.author_id, actor, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  PERFORM public._notify_users(targets,
    'تعليق جديد على التاسك', t.title,
    '/production/task/' || t.id::text,
    'task_comment', t.id, 'task',
    public._priority_label(t.priority));

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._notif_task_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  watcher_ids uuid[];
  targets uuid[];
  prio text := public._priority_label(NEW.priority);
BEGIN
  SELECT COALESCE(array_agg(DISTINCT w.user_id), ARRAY[]::uuid[]) INTO watcher_ids
  FROM public.task_watchers w WHERE w.task_id = NEW.id;

  targets := ARRAY(
    SELECT DISTINCT x FROM unnest(watcher_ids || ARRAY[NEW.assignee_id, NEW.created_by]) AS x
    WHERE x IS NOT NULL AND x <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     AND NEW.assignee_id IS NOT NULL
     AND NEW.assignee_id <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public._notify_users(ARRAY[NEW.assignee_id],
      'تم إسناد التاسك لك', NEW.title,
      '/production/task/' || NEW.id::text,
      'task_reassigned', NEW.id, 'task', prio);
  END IF;

  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    PERFORM public._notify_users(targets, 'تم تغيير الديدلاين', NEW.title,
      '/production/task/' || NEW.id::text, 'task_deadline_changed', NEW.id, 'task', prio);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    PERFORM public._notify_users(targets, 'تم تغيير أولوية التاسك', NEW.title,
      '/production/task/' || NEW.id::text, 'task_priority_changed', NEW.id, 'task', prio);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._notify_users(targets,
      CASE NEW.status
        WHEN 'approved' THEN 'تمت الموافقة على التاسك'
        WHEN 'rejected' THEN 'تم رفض التاسك'
        WHEN 'completed' THEN 'تم إكمال التاسك'
        WHEN 'in_review' THEN 'التاسك قيد المراجعة'
        WHEN 'submitted' THEN 'تم تسليم التاسك'
        ELSE 'تم تحديث حالة التاسك'
      END,
      NEW.title, '/production/task/' || NEW.id::text,
      'task_status_' || NEW.status, NEW.id, 'task', prio);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_task_reminder(_task_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  t record;
  watcher_ids uuid[];
  targets uuid[];
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.can_access_task(actor, _task_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id, title, assignee_id, created_by, priority, due_at INTO t
    FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_not_found'; END IF;

  SELECT COALESCE(array_agg(DISTINCT w.user_id), ARRAY[]::uuid[]) INTO watcher_ids
  FROM public.task_watchers w WHERE w.task_id = t.id;

  targets := ARRAY(
    SELECT DISTINCT x FROM unnest(watcher_ids || ARRAY[t.assignee_id]) AS x WHERE x IS NOT NULL
  );

  PERFORM public._notify_users(targets,
    '⏰ تذكير بالتاسك',
    t.title || CASE WHEN t.due_at IS NOT NULL
      THEN ' — الديدلاين: ' || to_char(t.due_at at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI')
      ELSE '' END,
    '/production/task/' || t.id::text,
    'task_reminder', t.id, 'task', 'high');

  RETURN COALESCE(array_length(targets, 1), 0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_task_reminder(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_task_reminder(uuid) TO authenticated;