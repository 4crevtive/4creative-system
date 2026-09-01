DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
CREATE POLICY "Reception and admins delete bookings"
ON public.bookings FOR DELETE TO authenticated
USING (private.is_reception_or_admin(auth.uid()));