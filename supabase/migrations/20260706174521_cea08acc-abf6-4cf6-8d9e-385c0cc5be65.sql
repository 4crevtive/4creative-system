DROP TRIGGER IF EXISTS validate_task_assignee_schedule_before_save ON public.tasks;

CREATE TRIGGER validate_task_assignee_schedule_before_save
BEFORE INSERT OR UPDATE OF assignee_id, due_at ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_assignee_schedule();