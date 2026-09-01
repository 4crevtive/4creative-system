-- 1) Reception can edit/delete cash movements
DROP POLICY IF EXISTS "Admins update/delete movements" ON public.cash_movements;
DROP POLICY IF EXISTS "Admins remove movements" ON public.cash_movements;
CREATE POLICY "Reception or admin update movements" ON public.cash_movements
  FOR UPDATE TO authenticated
  USING (public.is_reception_or_admin(auth.uid()))
  WITH CHECK (public.is_reception_or_admin(auth.uid()));
CREATE POLICY "Reception or admin delete movements" ON public.cash_movements
  FOR DELETE TO authenticated
  USING (public.is_reception_or_admin(auth.uid()));

-- 2) Reception can delete contacts
DROP POLICY IF EXISTS "Admins delete contacts" ON public.contacts;
CREATE POLICY "Reception or admin delete contacts" ON public.contacts
  FOR DELETE TO authenticated
  USING (public.is_reception_or_admin(auth.uid()));

-- 3) Package catalog managed by admins
CREATE TABLE public.package_offerings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text,
  price numeric NOT NULL DEFAULT 0,
  hours numeric NOT NULL DEFAULT 0,
  features text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_offerings TO authenticated;
GRANT ALL ON public.package_offerings TO service_role;

ALTER TABLE public.package_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read offerings" ON public.package_offerings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert offerings" ON public.package_offerings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update offerings" ON public.package_offerings
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete offerings" ON public.package_offerings
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER package_offerings_set_updated_at
  BEFORE UPDATE ON public.package_offerings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Link reception client packages to the catalog
ALTER TABLE public.studio_packages
  ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES public.package_offerings(id) ON DELETE SET NULL;