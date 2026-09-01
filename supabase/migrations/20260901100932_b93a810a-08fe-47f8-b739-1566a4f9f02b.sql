CREATE POLICY "Authenticated read package images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'package-images');
CREATE POLICY "Admins upload package images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'package-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update package images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'package-images' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'package-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete package images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'package-images' AND public.is_admin(auth.uid()));