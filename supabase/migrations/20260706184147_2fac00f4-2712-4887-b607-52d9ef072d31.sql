-- 1. Freelancer scope enum
DO $$ BEGIN
  CREATE TYPE public.freelancer_scope AS ENUM ('studio', 'agency', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS scope public.freelancer_scope NOT NULL DEFAULT 'agency';

-- 2. Allow assigning freelancer on tasks (in addition to assignee_id for staff)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE SET NULL;

ALTER TABLE public.task_watchers
  ADD COLUMN IF NOT EXISTS freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tasks_freelancer_id_idx ON public.tasks(freelancer_id);
CREATE INDEX IF NOT EXISTS task_watchers_freelancer_id_idx ON public.task_watchers(freelancer_id);

-- 3. Ensure freelancers is readable by all authenticated users (needed for task assignee dropdown)
DROP POLICY IF EXISTS "freelancers_readable_by_authenticated" ON public.freelancers;
CREATE POLICY "freelancers_readable_by_authenticated"
  ON public.freelancers FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.freelancers TO authenticated;