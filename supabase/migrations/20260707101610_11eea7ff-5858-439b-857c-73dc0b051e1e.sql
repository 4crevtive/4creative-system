
-- 1) New optional columns on notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS category text;

-- Backfill category from kind so existing rows still render
UPDATE public.notifications SET category = kind WHERE category IS NULL;

CREATE INDEX IF NOT EXISTS idx_notif_user_created
  ON public.notifications (user_id, created_at DESC);

-- 2) Realtime: add table to publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname='public' AND tablename='notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END$$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 3) Allow users to delete their own notifications
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4) Helper: bulk insert notifications for a set of users (SECURITY DEFINER,
--    so triggers can create rows for other users without needing admin RLS).
CREATE OR REPLACE FUNCTION public._notify_users(
  _user_ids uuid[],
  _title text,
  _body text,
  _link text,
  _kind text,
  _task_id uuid,
  _category text DEFAULT NULL,
  _priority text DEFAULT 'medium'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  IF _user_ids IS NULL THEN RETURN; END IF;
  FOREACH uid IN ARRAY _user_ids LOOP
    IF uid IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, title, body, link, kind, task_id, category, priority)
    VALUES (uid, _title, _body, _link, _kind, _task_id, COALESCE(_category, _kind), COALESCE(_priority, 'medium'));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._notify_users(uuid[], text, text, text, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._notify_users(uuid[], text, text, text, text, uuid, text, text) TO authenticated, service_role;

-- 5) Task INSERT trigger: notify assignee (unless they created it)
CREATE OR REPLACE FUNCTION public._notif_task_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public._notify_users(
      ARRAY[NEW.assignee_id],
      'تم إسناد تاسك جديد لك',
      NEW.title,
      '/production/task/' || NEW.id::text,
      'task_assigned',
      NEW.id,
      'task',
      COALESCE(NEW.priority, 'medium')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_task_insert ON public.tasks;
CREATE TRIGGER trg_notif_task_insert AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public._notif_task_insert();

-- 6) Task UPDATE trigger: notify on assignee change, due_at, priority, status
CREATE OR REPLACE FUNCTION public._notif_task_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  watcher_ids uuid[];
  targets uuid[];
BEGIN
  -- Base audience: assignee + creator + watchers, excluding the actor
  SELECT COALESCE(array_agg(DISTINCT w.user_id), ARRAY[]::uuid[])
    INTO watcher_ids
  FROM public.task_watchers w WHERE w.task_id = NEW.id;

  targets := ARRAY(
    SELECT DISTINCT x FROM unnest(
      watcher_ids || ARRAY[NEW.assignee_id, NEW.created_by]
    ) AS x
    WHERE x IS NOT NULL AND x <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  -- Assignee changed → notify new assignee separately
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     AND NEW.assignee_id IS NOT NULL
     AND NEW.assignee_id <> COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public._notify_users(
      ARRAY[NEW.assignee_id],
      'تم إسناد التاسك لك',
      NEW.title,
      '/production/task/' || NEW.id::text,
      'task_reassigned', NEW.id, 'task',
      COALESCE(NEW.priority, 'medium')
    );
  END IF;

  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    PERFORM public._notify_users(targets,
      'تم تغيير الديدلاين',
      NEW.title,
      '/production/task/' || NEW.id::text,
      'task_deadline_changed', NEW.id, 'task',
      COALESCE(NEW.priority, 'medium'));
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    PERFORM public._notify_users(targets,
      'تم تغيير أولوية التاسك',
      NEW.title,
      '/production/task/' || NEW.id::text,
      'task_priority_changed', NEW.id, 'task',
      COALESCE(NEW.priority, 'medium'));
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
      NEW.title,
      '/production/task/' || NEW.id::text,
      'task_status_' || NEW.status, NEW.id, 'task',
      COALESCE(NEW.priority, 'medium'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_task_update ON public.tasks;
CREATE TRIGGER trg_notif_task_update AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public._notif_task_update();

-- 7) Comment INSERT trigger: notify assignee + creator + watchers
CREATE OR REPLACE FUNCTION public._notif_task_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  t record;
  watcher_ids uuid[];
  targets uuid[];
BEGIN
  SELECT id, title, assignee_id, created_by, priority INTO t
    FROM public.tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(array_agg(DISTINCT w.user_id), ARRAY[]::uuid[])
    INTO watcher_ids
  FROM public.task_watchers w WHERE w.task_id = t.id;

  targets := ARRAY(
    SELECT DISTINCT x FROM unnest(
      watcher_ids || ARRAY[t.assignee_id, t.created_by]
    ) AS x
    WHERE x IS NOT NULL AND x <> COALESCE(NEW.author_id, actor, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  PERFORM public._notify_users(targets,
    'تعليق جديد على التاسك',
    t.title,
    '/production/task/' || t.id::text,
    'task_comment', t.id, 'task',
    COALESCE(t.priority, 'medium'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_task_comment ON public.task_comments;
CREATE TRIGGER trg_notif_task_comment AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public._notif_task_comment();

-- 8) Reminder RPC: any authenticated user can trigger a reminder for a task
--    they can access (RLS on tasks is checked via SECURITY INVOKER read below).
CREATE OR REPLACE FUNCTION public.send_task_reminder(_task_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  t record;
  watcher_ids uuid[];
  targets uuid[];
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- Access check: caller must have access to the task
  IF NOT public.can_access_task(actor, _task_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, title, assignee_id, created_by, priority, due_at INTO t
    FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_not_found'; END IF;

  SELECT COALESCE(array_agg(DISTINCT w.user_id), ARRAY[]::uuid[])
    INTO watcher_ids
  FROM public.task_watchers w WHERE w.task_id = t.id;

  targets := ARRAY(
    SELECT DISTINCT x FROM unnest(
      watcher_ids || ARRAY[t.assignee_id]
    ) AS x
    WHERE x IS NOT NULL
  );

  PERFORM public._notify_users(targets,
    '⏰ تذكير بالتاسك',
    t.title || CASE WHEN t.due_at IS NOT NULL
      THEN ' — الديدلاين: ' || to_char(t.due_at at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI')
      ELSE '' END,
    '/production/task/' || t.id::text,
    'task_reminder', t.id, 'task',
    'high');

  RETURN array_length(targets, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.send_task_reminder(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_task_reminder(uuid) TO authenticated, service_role;
