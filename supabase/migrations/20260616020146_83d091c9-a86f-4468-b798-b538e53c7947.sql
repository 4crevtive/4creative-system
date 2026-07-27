
-- =========================================================
-- 4Creative ERP/CRM/Studio Management - Foundation Schema
-- =========================================================

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin','admin','dept_manager','dept_assistant','staff','reception','viewer'
);

CREATE TYPE public.company_code AS ENUM ('studio','agency');

CREATE TYPE public.dept_code AS ENUM (
  'teachers','production','marketing','programming','sales','reception','general_accounts'
);

CREATE TYPE public.contact_type AS ENUM ('teacher','reel_client','service_client');

CREATE TYPE public.booking_status AS ENUM (
  'pending','confirmed','in_progress','completed','cancelled','no_show'
);

CREATE TYPE public.capture_device AS ENUM ('camera','iphone');

CREATE TYPE public.task_type AS ENUM (
  'shooting','editing','design','programming','marketing'
);

CREATE TYPE public.task_status AS ENUM (
  'pending','started','progress_50','in_review','submitted','approved','rejected','archived'
);

CREATE TYPE public.cash_direction AS ENUM ('in','out');

CREATE TYPE public.invoice_status AS ENUM ('draft','sent','partial','paid','void');

-- =========================================================
-- COMPANIES
-- =========================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code public.company_code NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read companies" ON public.companies FOR SELECT TO authenticated USING (true);

INSERT INTO public.companies (code, name_ar, name_en) VALUES
 ('studio','الاستوديو والتصوير','Studio & Production'),
 ('agency','الماركتنج والبرمجة','Marketing & Programming');

-- =========================================================
-- DEPARTMENTS
-- =========================================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code public.dept_code NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read departments" ON public.departments FOR SELECT TO authenticated USING (true);

INSERT INTO public.departments (company_id, code, name_ar, name_en)
SELECT c.id, d.code::public.dept_code, d.name_ar, d.name_en
FROM public.companies c
CROSS JOIN (VALUES
  ('studio','teachers','قسم المدرسين','Teachers'),
  ('studio','production','قسم البرودكشن','Production'),
  ('studio','reception','الريسبشن','Reception'),
  ('studio','general_accounts','الحسابات العامة','General Accounts'),
  ('agency','marketing','قسم الماركتنج','Marketing'),
  ('agency','programming','قسم البرمجة','Programming'),
  ('agency','sales','السيلز والمبيعات','Sales'),
  ('agency','general_accounts','الحسابات العامة','General Accounts')
) AS d(comp, code, name_ar, name_en)
WHERE c.code::text = d.comp;

-- =========================================================
-- USER PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  name_ar TEXT,
  phone TEXT,
  avatar_url TEXT,
  primary_department_id UUID REFERENCES public.departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- USER ROLES (separate table — security best practice)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin','admin')
  );
$$;

-- Profile policies (depend on has_role)
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = id);

-- User roles policies
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- DEPARTMENT MEMBERS
-- =========================================================
CREATE TABLE public.department_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_members TO authenticated;
GRANT ALL ON public.department_members TO service_role;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read department members" ON public.department_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage department members" ON public.department_members FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_dept_member(_user_id UUID, _dept_code public.dept_code)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_members dm
    JOIN public.departments d ON d.id = dm.department_id
    WHERE dm.user_id = _user_id AND d.code = _dept_code
  );
$$;

-- =========================================================
-- ATTENDANCE
-- =========================================================
CREATE TABLE public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out TIMESTAMPTZ,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_user_date ON public.attendance_logs(user_id, work_date);
GRANT SELECT, INSERT, UPDATE ON public.attendance_logs TO authenticated;
GRANT ALL ON public.attendance_logs TO service_role;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own attendance" ON public.attendance_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users insert own attendance" ON public.attendance_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own attendance" ON public.attendance_logs FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- =========================================================
-- CONTACTS (CRM)
-- =========================================================
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.contact_type NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  source TEXT,
  first_contact_date DATE DEFAULT CURRENT_DATE,
  company_id UUID REFERENCES public.companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_type ON public.contacts(type);
CREATE INDEX idx_contacts_company ON public.contacts(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Authenticated read contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_history_contact ON public.contact_history(contact_id, created_at DESC);
GRANT SELECT, INSERT ON public.contact_history TO authenticated;
GRANT ALL ON public.contact_history TO service_role;
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read contact history" ON public.contact_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert contact history" ON public.contact_history FOR INSERT TO authenticated WITH CHECK (true);

-- =========================================================
-- ROOMS & EQUIPMENT
-- =========================================================
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  reels_only BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read rooms" ON public.rooms FOR SELECT TO authenticated USING (true);

INSERT INTO public.rooms (code, name_ar, name_en, reels_only) VALUES
 ('room_1','غرفة 1','Room 1', false),
 ('room_2','غرفة 2','Room 2', false),
 ('room_3','غرفة 3 (ريلز)','Room 3 (Reels)', true);

CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage equipment" ON public.equipment FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- STUDIO PACKAGES
-- =========================================================
CREATE TABLE public.studio_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  used_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  next_collection_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_packages_contact ON public.studio_packages(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_packages TO authenticated;
GRANT ALL ON public.studio_packages TO service_role;
ALTER TABLE public.studio_packages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_packages_updated BEFORE UPDATE ON public.studio_packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Authenticated read packages" ON public.studio_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write packages" ON public.studio_packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update packages" ON public.studio_packages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete packages" ON public.studio_packages FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- =========================================================
-- BOOKINGS
-- =========================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES public.rooms(id),
  package_id UUID REFERENCES public.studio_packages(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  capture_device public.capture_device NOT NULL DEFAULT 'camera',
  cameras_count INT NOT NULL DEFAULT 1 CHECK (cameras_count BETWEEN 1 AND 2),
  script_ready BOOLEAN NOT NULL DEFAULT false,
  editing_required BOOLEAN NOT NULL DEFAULT true,
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_bookings_starts ON public.bookings(starts_at);
CREATE INDEX idx_bookings_room ON public.bookings(room_id, starts_at);
CREATE INDEX idx_bookings_contact ON public.bookings(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Authenticated read bookings" ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update bookings" ON public.bookings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete bookings" ON public.bookings FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Booking conflict trigger: same room, room2/room3 exclusivity, 30-min buffer
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INT;
  room2_id UUID;
  room3_id UUID;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Same-room conflict with 30-min buffer
  SELECT COUNT(*) INTO conflict_count
  FROM public.bookings b
  WHERE b.room_id = NEW.room_id
    AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.status NOT IN ('cancelled','no_show')
    AND tstzrange(b.starts_at - interval '30 minutes', b.ends_at + interval '30 minutes', '()') &&
        tstzrange(NEW.starts_at, NEW.ends_at, '()');

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'تعارض في الحجز: الغرفة محجوزة في هذا الوقت (مع فاصل 30 دقيقة).';
  END IF;

  -- Room2/Room3 exclusivity (unless Room3 uses iPhone)
  SELECT id INTO room2_id FROM public.rooms WHERE code = 'room_2';
  SELECT id INTO room3_id FROM public.rooms WHERE code = 'room_3';

  IF NEW.room_id IN (room2_id, room3_id) THEN
    SELECT COUNT(*) INTO conflict_count
    FROM public.bookings b
    WHERE b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status NOT IN ('cancelled','no_show')
      AND b.room_id IN (room2_id, room3_id)
      AND b.room_id <> NEW.room_id
      AND tstzrange(b.starts_at, b.ends_at, '()') && tstzrange(NEW.starts_at, NEW.ends_at, '()')
      AND NOT (
        (b.room_id = room3_id AND b.capture_device = 'iphone') OR
        (NEW.room_id = room3_id AND NEW.capture_device = 'iphone')
      );

    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'لا يمكن حجز غرفة 2 وغرفة 3 في نفس الوقت إلا إذا كان تصوير الريلز بواسطة iPhone.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_booking
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking();

-- =========================================================
-- TASKS
-- =========================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id),
  department_id UUID REFERENCES public.departments(id),
  contact_id UUID REFERENCES public.contacts(id),
  booking_id UUID REFERENCES public.bookings(id),
  type public.task_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'pending',
  assignee_id UUID REFERENCES auth.users(id),
  priority INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  video_duration_pre_seconds INT,
  video_duration_post_seconds INT,
  due_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id, status);
CREATE INDEX idx_tasks_dept ON public.tasks(department_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Authenticated read tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Assignees and admins update tasks" ON public.tasks FOR UPDATE TO authenticated USING (
  assignee_id = auth.uid() OR created_by = auth.uid() OR public.is_admin(auth.uid())
);
CREATE POLICY "Admins delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_status public.task_status,
  to_status public.task_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tsh_task ON public.task_status_history(task_id, created_at DESC);
GRANT SELECT, INSERT ON public.task_status_history TO authenticated;
GRANT ALL ON public.task_status_history TO service_role;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read task history" ON public.task_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert task history" ON public.task_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- =========================================================
-- FINANCE: CASHBOXES / MOVEMENTS / CLOSINGS
-- =========================================================
CREATE TABLE public.cashboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cashboxes TO authenticated;
GRANT ALL ON public.cashboxes TO service_role;
ALTER TABLE public.cashboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read cashboxes" ON public.cashboxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cashboxes" ON public.cashboxes FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.cashboxes (company_id, name)
SELECT id, 'خزنة الريسبشن' FROM public.companies WHERE code='studio';
INSERT INTO public.cashboxes (company_id, name)
SELECT id, 'خزنة الوكالة' FROM public.companies WHERE code='agency';

CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashbox_id UUID NOT NULL REFERENCES public.cashboxes(id) ON DELETE CASCADE,
  business_date DATE NOT NULL DEFAULT CURRENT_DATE,
  direction public.cash_direction NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT,
  description TEXT,
  contact_id UUID REFERENCES public.contacts(id),
  booking_id UUID REFERENCES public.bookings(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_movements_date ON public.cash_movements(cashbox_id, business_date);
GRANT SELECT, INSERT ON public.cash_movements TO authenticated;
GRANT UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read movements" ON public.cash_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert movements" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins update/delete movements" ON public.cash_movements FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins remove movements" ON public.cash_movements FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashbox_id UUID NOT NULL REFERENCES public.cashboxes(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  total_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_out NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cashbox_id, business_date)
);
GRANT SELECT, INSERT ON public.daily_closings TO authenticated;
GRANT ALL ON public.daily_closings TO service_role;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read closings" ON public.daily_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert closings" ON public.daily_closings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- INVOICES & PAYMENTS
-- =========================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id),
  invoice_number TEXT NOT NULL UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_contact ON public.invoices(contact_id);
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Authenticated read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, is_read, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
