
CREATE POLICY "Admins can read event assets" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-assets' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can upload event assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-assets' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can update event assets" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'event-assets' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'event-assets' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can delete event assets" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-assets' AND public.has_role(auth.uid(),'admin'));
