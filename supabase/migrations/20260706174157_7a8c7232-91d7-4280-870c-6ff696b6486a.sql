ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS shooting_room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shooting_location text,
  ADD COLUMN IF NOT EXISTS shooting_external_address text,
  ADD COLUMN IF NOT EXISTS shooting_notes text;

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
    RAISE EXCEPTION 'هذا الموظف لديه تاسك آخر في نفس الموعد: %', conflict_title;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_task_assignee_schedule_before_save ON public.tasks;
CREATE TRIGGER validate_task_assignee_schedule_before_save
BEFORE INSERT OR UPDATE OF assignee_id, due_at, status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_assignee_schedule();