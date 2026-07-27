-- Engagement model: distinguish one-off freelance projects from ongoing retainer engagements
DO $$ BEGIN
  CREATE TYPE public.agency_engagement_model AS ENUM ('one_time', 'retainer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agency_billing_cycle AS ENUM ('monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.agency_projects
  ADD COLUMN IF NOT EXISTS engagement_model public.agency_engagement_model NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS billing_cycle public.agency_billing_cycle,
  ADD COLUMN IF NOT EXISTS monthly_retainer numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_invoice_date date,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_agency_projects_engagement_model ON public.agency_projects(engagement_model);
CREATE INDEX IF NOT EXISTS idx_agency_projects_archived_at ON public.agency_projects(archived_at);
CREATE INDEX IF NOT EXISTS idx_agency_projects_next_invoice_date ON public.agency_projects(next_invoice_date) WHERE next_invoice_date IS NOT NULL;