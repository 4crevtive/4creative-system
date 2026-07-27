DROP POLICY IF EXISTS "Users insert own attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Users update own attendance" ON public.attendance_logs;

CREATE POLICY "Admins insert attendance" ON public.attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update attendance" ON public.attendance_logs
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete attendance" ON public.attendance_logs
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));