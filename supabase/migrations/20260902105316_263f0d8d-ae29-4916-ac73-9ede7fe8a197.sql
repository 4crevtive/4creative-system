CREATE TABLE public.studio_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.studio_packages(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  photos_count integer NOT NULL DEFAULT 0,
  reels_count integer NOT NULL DEFAULT 0,
  videos_count integer NOT NULL DEFAULT 0,
  screen_hours numeric NOT NULL DEFAULT 0,
  studio_hours numeric NOT NULL DEFAULT 0,
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_usage_logs TO authenticated;
GRANT ALL ON public.studio_usage_logs TO service_role;
ALTER TABLE public.studio_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reception or admin read usage logs" ON public.studio_usage_logs
  FOR SELECT TO authenticated USING (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin insert usage logs" ON public.studio_usage_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin update usage logs" ON public.studio_usage_logs
  FOR UPDATE TO authenticated USING (public.is_reception_or_admin(auth.uid()))
  WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Admins delete usage logs" ON public.studio_usage_logs
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX idx_studio_usage_logs_contact ON public.studio_usage_logs(contact_id, usage_date DESC);

CREATE TRIGGER studio_usage_logs_set_updated_at BEFORE UPDATE ON public.studio_usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_studio_usage_logs AFTER INSERT OR UPDATE OR DELETE ON public.studio_usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TABLE public.project_incomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  title text,
  notes text,
  cash_movement_id uuid REFERENCES public.cash_movements(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_incomes TO authenticated;
GRANT ALL ON public.project_incomes TO service_role;
ALTER TABLE public.project_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read project incomes" ON public.project_incomes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins or members insert project incomes" ON public.project_incomes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Admins or members update project incomes" ON public.project_incomes
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Admins delete project incomes" ON public.project_incomes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX idx_project_incomes_project ON public.project_incomes(project_id, received_at DESC);

CREATE TRIGGER project_incomes_set_updated_at BEFORE UPDATE ON public.project_incomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_project_incomes AFTER INSERT OR UPDATE OR DELETE ON public.project_incomes
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();