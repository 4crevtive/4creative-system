
DROP POLICY IF EXISTS "Authenticated insert bookings" ON public.bookings;
CREATE POLICY "Authenticated insert bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_reception_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated update bookings" ON public.bookings;
CREATE POLICY "Authenticated update bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (public.is_reception_or_admin(auth.uid()))
  WITH CHECK (public.is_reception_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated insert tasks" ON public.tasks;
CREATE POLICY "Authenticated insert tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
