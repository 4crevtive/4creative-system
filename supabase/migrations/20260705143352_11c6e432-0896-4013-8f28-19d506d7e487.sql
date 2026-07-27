
-- Milestones
CREATE TABLE public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'planned',
  progress INT NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT ALL ON public.project_milestones TO service_role;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestones read" ON public.project_milestones FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "milestones write" ON public.project_milestones FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE TRIGGER trg_milestones_updated BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Risks
CREATE TABLE public.project_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium', -- low/medium/high/critical
  impact TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',     -- open/mitigating/resolved
  assignee_id UUID REFERENCES auth.users(id),
  resolution TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_risks TO authenticated;
GRANT ALL ON public.project_risks TO service_role;
ALTER TABLE public.project_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risks read" ON public.project_risks FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "risks write" ON public.project_risks FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE TRIGGER trg_risks_updated BEFORE UPDATE ON public.project_risks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Time entries
CREATE TABLE public.project_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  billable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_time_entries TO authenticated;
GRANT ALL ON public.project_time_entries TO service_role;
ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time read" ON public.project_time_entries FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid() OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "time insert own" ON public.project_time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id)));
CREATE POLICY "time update own" ON public.project_time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "time delete own" ON public.project_time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_time_updated BEFORE UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Calendar events
CREATE TABLE public.project_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'meeting', -- meeting/deadline/milestone/deliverable/leave
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_calendar_events TO authenticated;
GRANT ALL ON public.project_calendar_events TO service_role;
ALTER TABLE public.project_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar read" ON public.project_calendar_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "calendar write" ON public.project_calendar_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE TRIGGER trg_calendar_updated BEFORE UPDATE ON public.project_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_risks_project ON public.project_risks(project_id);
CREATE INDEX idx_time_project ON public.project_time_entries(project_id);
CREATE INDEX idx_time_user ON public.project_time_entries(user_id);
CREATE INDEX idx_calendar_project ON public.project_calendar_events(project_id);
CREATE INDEX idx_calendar_start ON public.project_calendar_events(starts_at);
