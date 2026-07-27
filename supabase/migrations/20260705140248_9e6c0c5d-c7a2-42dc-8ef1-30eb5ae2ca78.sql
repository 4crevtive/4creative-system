
DROP POLICY IF EXISTS "freelancers read all authenticated" ON public.freelancers;
CREATE POLICY "freelancers read reception/admin" ON public.freelancers
  FOR SELECT TO authenticated USING (public.is_reception_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Auth read label_map" ON public.task_label_map;
CREATE POLICY "Read label_map by task access" ON public.task_label_map
  FOR SELECT TO authenticated USING (public.can_access_task(auth.uid(), task_id));

DROP POLICY IF EXISTS "Authenticated read task history" ON public.task_status_history;
CREATE POLICY "Read task history by task access" ON public.task_status_history
  FOR SELECT TO authenticated USING (public.can_access_task(auth.uid(), task_id));

CREATE POLICY "Users self-add as watcher" ON public.task_watchers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_task(auth.uid(), task_id));

CREATE POLICY "Users self-remove as watcher" ON public.task_watchers
  FOR DELETE TO authenticated USING (user_id = auth.uid());
