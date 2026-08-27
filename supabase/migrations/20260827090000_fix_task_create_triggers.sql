-- =============================================================================
-- Fix: task creation failing with a DB/trigger error
-- =============================================================================
-- Symptom: creating a task sometimes/always fails with a database error coming
-- from the DB triggers on public.tasks (the insert is rolled back).
--
-- Root cause: two DB triggers run on EVERY task insert and abort the whole
-- operation when their side-effect fails:
--   1. validate_task_assignee_schedule_before_save (BEFORE INSERT)
--        - Hard RAISE EXCEPTION whenever the chosen assignee already has an
--          active task whose due_at is within +/- 60 minutes of the new one.
--        - The "New Task" dialogs default due_at to "now", so assigning to an
--          already-busy employee reliably blocked creation.
--   2. trg_notif_task_insert -> _notify_users (AFTER INSERT)
--        - Inserts a notification row; if that insert fails for any reason the
--        ENTIRE task insert is rolled back (AFTER triggers abort the txn).
--
-- Fix: make both non-fatal.
--   * The schedule check now raises a NOTICE (server log) instead of failing the
--     insert. The admin UI already surfaces schedule conflicts on the client.
--   * Notification creation swallows per-user errors so it can never abort the
--     actual task create/update/comment.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Assignee-schedule validation: warn instead of hard-fail.
--    A task has only a due_at (deadline) with no start time, so the +/- 60min
--    overlap check is too aggressive and was blocking legitimate task creation.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_task_assignee_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  conflict_title text;
BEGIN
  IF NEW.assignee_id IS NULL OR NEW.due_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('approved', 'rejected', 'archived', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT t.title INTO conflict_title
  FROM public.tasks t
  WHERE t.assignee_id = NEW.assignee_id
    AND t.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND t.due_at IS NOT NULL
    AND t.status NOT IN ('approved', 'rejected', 'archived', 'completed')
    AND t.due_at BETWEEN NEW.due_at - interval '60 minutes' AND NEW.due_at + interval '60 minutes'
  LIMIT 1;

  IF conflict_title IS NOT NULL THEN
    -- Previously RAISE EXCEPTION, which aborted the whole task insert.
    RAISE NOTICE 'هذا الموظف لديه تاسك آخر في نفس الموعد: %', conflict_title;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) _notify_users: never let a notification failure abort the caller.
--    Wrap each notifications INSERT so a single bad row is skipped instead of
--    rolling back the task insert/update/comment that triggered it.
-- -----------------------------------------------------------------------------
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
    BEGIN
      INSERT INTO public.notifications (user_id, title, body, link, kind, task_id, category, priority)
      VALUES (uid, _title, _body, _link, _kind, _task_id, COALESCE(_category, _kind), COALESCE(_priority, 'medium'));
    EXCEPTION WHEN OTHERS THEN
      -- Swallow: a notification must never block the underlying operation.
      NULL;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._notify_users(uuid[], text, text, text, text, uuid, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public._notify_users(uuid[], text, text, text, text, uuid, text, text) TO service_role;