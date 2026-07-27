
-- Helper: reception or admin
CREATE OR REPLACE FUNCTION public.is_reception_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id) OR public.has_role(_user_id, 'reception');
$$;
REVOKE EXECUTE ON FUNCTION public.is_reception_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_reception_or_admin(uuid) TO authenticated, service_role;

-- ===== cash_movements =====
DROP POLICY IF EXISTS "Authenticated read movements" ON public.cash_movements;
DROP POLICY IF EXISTS "Authenticated insert movements" ON public.cash_movements;
CREATE POLICY "Reception or admin read movements" ON public.cash_movements
  FOR SELECT TO authenticated USING (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin insert movements" ON public.cash_movements
  FOR INSERT TO authenticated WITH CHECK (public.is_reception_or_admin(auth.uid()) AND created_by = auth.uid());

-- ===== contacts =====
DROP POLICY IF EXISTS "Authenticated read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated update contacts" ON public.contacts;
CREATE POLICY "Reception or admin read contacts" ON public.contacts
  FOR SELECT TO authenticated USING (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin insert contacts" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin update contacts" ON public.contacts
  FOR UPDATE TO authenticated USING (public.is_reception_or_admin(auth.uid())) WITH CHECK (public.is_reception_or_admin(auth.uid()));

-- ===== daily_closings =====
DROP POLICY IF EXISTS "Authenticated read closings" ON public.daily_closings;
CREATE POLICY "Reception or admin read closings" ON public.daily_closings
  FOR SELECT TO authenticated USING (public.is_reception_or_admin(auth.uid()));

-- ===== invoices =====
DROP POLICY IF EXISTS "Authenticated read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated write invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated update invoices" ON public.invoices;
CREATE POLICY "Reception or admin read invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin insert invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin update invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (public.is_reception_or_admin(auth.uid())) WITH CHECK (public.is_reception_or_admin(auth.uid()));

-- ===== payments =====
DROP POLICY IF EXISTS "Authenticated read payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated write payments" ON public.payments;
CREATE POLICY "Reception or admin read payments" ON public.payments
  FOR SELECT TO authenticated USING (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin insert payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (public.is_reception_or_admin(auth.uid()));

-- ===== studio_packages =====
DROP POLICY IF EXISTS "Authenticated read packages" ON public.studio_packages;
DROP POLICY IF EXISTS "Authenticated write packages" ON public.studio_packages;
DROP POLICY IF EXISTS "Authenticated update packages" ON public.studio_packages;
CREATE POLICY "Reception or admin read packages" ON public.studio_packages
  FOR SELECT TO authenticated USING (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin insert packages" ON public.studio_packages
  FOR INSERT TO authenticated WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin update packages" ON public.studio_packages
  FOR UPDATE TO authenticated USING (public.is_reception_or_admin(auth.uid())) WITH CHECK (public.is_reception_or_admin(auth.uid()));

-- ===== notifications =====
DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
CREATE POLICY "Admins insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- ===== profiles =====
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
CREATE POLICY "Self or admin insert profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- ===== task_status_history =====
DROP POLICY IF EXISTS "Authenticated insert task history" ON public.task_status_history;
CREATE POLICY "Task participants insert history" ON public.task_status_history
  FOR INSERT TO authenticated WITH CHECK (
    changed_by = auth.uid() AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = task_status_history.task_id
          AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
      )
    )
  );

-- ===== Lock down SECURITY DEFINER helpers and triggers =====
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_dept_member(uuid, dept_code) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_dept_member(uuid, dept_code) TO authenticated, service_role;

-- Trigger-only functions: no app should call directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_booking() FROM PUBLIC, anon, authenticated;
