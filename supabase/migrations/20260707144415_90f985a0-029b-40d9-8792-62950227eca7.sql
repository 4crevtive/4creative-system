
-- Restrict profiles: drop broad SELECT
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;

-- Restrict tasks: replace blanket SELECT with access-check
DROP POLICY IF EXISTS "Authenticated read tasks" ON public.tasks;

CREATE POLICY "Task access read"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.can_access_task(auth.uid(), id));
