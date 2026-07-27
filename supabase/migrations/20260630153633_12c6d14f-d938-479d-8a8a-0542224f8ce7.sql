
-- 1) contact_history: restrict SELECT/INSERT to reception or admin
DROP POLICY IF EXISTS "Authenticated read contact history" ON public.contact_history;
DROP POLICY IF EXISTS "Authenticated insert contact history" ON public.contact_history;

CREATE POLICY "Reception or admin read contact history"
ON public.contact_history
FOR SELECT
TO authenticated
USING (public.is_reception_or_admin(auth.uid()));

CREATE POLICY "Reception or admin insert contact history"
ON public.contact_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_reception_or_admin(auth.uid()));

-- 2) profiles: allow collaborators on shared tasks to read each other's profile
CREATE POLICY "Collaborators read shared task profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE (t.assignee_id = profiles.id OR t.created_by = profiles.id)
      AND (
        t.assignee_id = auth.uid()
        OR t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_watchers w
          WHERE w.task_id = t.id AND w.user_id = auth.uid()
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.task_watchers w
    JOIN public.tasks t ON t.id = w.task_id
    WHERE w.user_id = profiles.id
      AND (
        t.assignee_id = auth.uid()
        OR t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_watchers w2
          WHERE w2.task_id = t.id AND w2.user_id = auth.uid()
        )
      )
  )
);

-- 3) storage: replace the open task-files read policy with a scoped one
DROP POLICY IF EXISTS "task-files read" ON storage.objects;

CREATE POLICY "task-files read scoped"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-files'
  AND (
    owner = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.task_attachments ta
      WHERE ta.storage_path = storage.objects.name
        AND public.can_access_task(auth.uid(), ta.task_id)
    )
  )
);
