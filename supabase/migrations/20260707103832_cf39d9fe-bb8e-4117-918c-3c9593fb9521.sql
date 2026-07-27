
CREATE POLICY "auth read contact-media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contact-media');
CREATE POLICY "auth insert contact-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contact-media');
CREATE POLICY "auth update contact-media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contact-media');
CREATE POLICY "auth delete contact-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contact-media');
