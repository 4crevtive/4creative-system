
CREATE POLICY "task-files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-files');
CREATE POLICY "task-files upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files' AND owner = auth.uid());
CREATE POLICY "task-files update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'task-files' AND owner = auth.uid());
CREATE POLICY "task-files delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-files' AND (owner = auth.uid() OR public.is_admin(auth.uid())));
