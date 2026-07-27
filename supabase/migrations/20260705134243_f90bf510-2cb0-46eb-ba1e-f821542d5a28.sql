
-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.agency_project_type   AS ENUM ('marketing','programming','mixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.agency_project_status AS ENUM ('planned','in_progress','on_hold','delivered','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.freelancer_specialty  AS ENUM ('programming','design','montage','writing','ads','photography','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.freelancer_rate_kind  AS ENUM ('hourly','fixed','per_project'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_member_kind   AS ENUM ('staff','freelancer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status        AS ENUM ('unpaid','partial','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_expense_kind  AS ENUM ('freelance','tools','ads','salary','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLES (structure only, RLS + policies added after helper) ============
CREATE TABLE public.agency_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text, email text, phone text, notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_clients TO authenticated;
GRANT ALL ON public.agency_clients TO service_role;

CREATE TABLE public.freelancers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  specialty public.freelancer_specialty NOT NULL DEFAULT 'other',
  rate_kind public.freelancer_rate_kind NOT NULL DEFAULT 'per_project',
  rate_amount numeric(12,2),
  phone text, email text, notes text,
  rating int CHECK (rating BETWEEN 1 AND 5),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancers TO authenticated;
GRANT ALL ON public.freelancers TO service_role;

CREATE TABLE public.agency_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  type public.agency_project_type NOT NULL DEFAULT 'marketing',
  status public.agency_project_status NOT NULL DEFAULT 'planned',
  start_date date, due_date date,
  budget numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agency_projects_client_id_idx ON public.agency_projects (client_id);
CREATE INDEX agency_projects_status_idx    ON public.agency_projects (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_projects TO authenticated;
GRANT ALL ON public.agency_projects TO service_role;

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  kind public.project_member_kind NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE SET NULL,
  role text,
  agreed_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount   numeric(12,2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_members_who_chk CHECK (
    (kind = 'staff'      AND user_id       IS NOT NULL AND freelancer_id IS NULL) OR
    (kind = 'freelancer' AND freelancer_id IS NOT NULL AND user_id       IS NULL)
  )
);
CREATE INDEX project_members_project_idx    ON public.project_members (project_id);
CREATE INDEX project_members_user_idx       ON public.project_members (user_id);
CREATE INDEX project_members_freelancer_idx ON public.project_members (freelancer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

CREATE TABLE public.project_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric(12,2) NOT NULL,
  kind public.project_expense_kind NOT NULL DEFAULT 'other',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE SET NULL,
  cash_movement_id uuid REFERENCES public.cash_movements(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_expenses_project_idx ON public.project_expenses (project_id);
CREATE INDEX project_expenses_date_idx    ON public.project_expenses (expense_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_expenses TO authenticated;
GRANT ALL ON public.project_expenses TO service_role;

-- ============ Helper function (after project_members exists) ============
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND kind = 'staff'
  );
$$;

-- ============ Enable RLS + policies ============
ALTER TABLE public.agency_clients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

-- agency_clients
CREATE POLICY "agency_clients read all authenticated" ON public.agency_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "agency_clients admin insert" ON public.agency_clients FOR INSERT TO authenticated WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "agency_clients admin update" ON public.agency_clients FOR UPDATE TO authenticated USING (public.is_reception_or_admin(auth.uid())) WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "agency_clients admin delete" ON public.agency_clients FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- freelancers
CREATE POLICY "freelancers read all authenticated" ON public.freelancers FOR SELECT TO authenticated USING (true);
CREATE POLICY "freelancers admin insert" ON public.freelancers FOR INSERT TO authenticated WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "freelancers admin update" ON public.freelancers FOR UPDATE TO authenticated USING (public.is_reception_or_admin(auth.uid())) WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "freelancers admin delete" ON public.freelancers FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- agency_projects
CREATE POLICY "agency_projects admin all" ON public.agency_projects FOR ALL TO authenticated
  USING (public.is_reception_or_admin(auth.uid())) WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "agency_projects members read" ON public.agency_projects FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), id) OR created_by = auth.uid());

-- project_members
CREATE POLICY "project_members admin all" ON public.project_members FOR ALL TO authenticated
  USING (public.is_reception_or_admin(auth.uid())) WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "project_members self read" ON public.project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_project_member(auth.uid(), project_id));

-- project_expenses
CREATE POLICY "project_expenses admin all" ON public.project_expenses FOR ALL TO authenticated
  USING (public.is_reception_or_admin(auth.uid())) WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "project_expenses members read" ON public.project_expenses FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "project_expenses members insert" ON public.project_expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

-- updated_at triggers
CREATE TRIGGER agency_clients_set_updated_at   BEFORE UPDATE ON public.agency_clients   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER freelancers_set_updated_at      BEFORE UPDATE ON public.freelancers      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agency_projects_set_updated_at  BEFORE UPDATE ON public.agency_projects  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER project_members_set_updated_at  BEFORE UPDATE ON public.project_members  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER project_expenses_set_updated_at BEFORE UPDATE ON public.project_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
