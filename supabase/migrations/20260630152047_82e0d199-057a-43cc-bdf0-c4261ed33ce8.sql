
-- =========================================================
-- 1. EXTEND ENUMS (must be committed; only use later)
-- =========================================================
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'shooting_started';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'shooting_done';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'uploaded';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'completed';

-- =========================================================
-- 2. EXTEND tasks TABLE
-- =========================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS video_type TEXT,
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT,
  ADD COLUMN IF NOT EXISTS resolution TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT,
  ADD COLUMN IF NOT EXISTS required_output TEXT,
  ADD COLUMN IF NOT EXISTS estimated_minutes INT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_department ON public.tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON public.tasks(assignee_id, status);

-- =========================================================
-- 3. CHECKLIST ITEMS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  done_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  done_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklist_task ON public.task_checklist_items(task_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist_items TO authenticated;
GRANT ALL ON public.task_checklist_items TO service_role;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 4. ATTACHMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  version INT NOT NULL DEFAULT 1,
  kind TEXT NOT NULL DEFAULT 'general', -- general | submission | preview | source
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON public.task_attachments(task_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 5. COMMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_task ON public.task_comments(task_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 6. WATCHERS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.task_watchers (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.task_watchers TO authenticated;
GRANT ALL ON public.task_watchers TO service_role;
ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 7. REFERENCES (external links)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.task_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label TEXT,
  url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refs_task ON public.task_references(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_references TO authenticated;
GRANT ALL ON public.task_references TO service_role;
ALTER TABLE public.task_references ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 8. LABELS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.task_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_labels TO authenticated;
GRANT ALL ON public.task_labels TO service_role;
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read labels" ON public.task_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage labels" ON public.task_labels FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.task_label_map (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.task_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);
GRANT SELECT, INSERT, DELETE ON public.task_label_map TO authenticated;
GRANT ALL ON public.task_label_map TO service_role;
ALTER TABLE public.task_label_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read label_map" ON public.task_label_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage label_map" ON public.task_label_map FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- 9. NOTIFICATIONS — extend
-- =========================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind TEXT;
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id, created_at DESC);

-- =========================================================
-- 10. HELPER FUNCTION: can user access this task?
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_access_task(_user_id UUID, _task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = _task_id
      AND (t.assignee_id = _user_id OR t.created_by = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.task_watchers w WHERE w.task_id = _task_id AND w.user_id = _user_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid, uuid) TO authenticated, service_role;

-- =========================================================
-- 11. RLS POLICIES on new tables
-- =========================================================
-- Checklist
CREATE POLICY "Read checklist" ON public.task_checklist_items FOR SELECT TO authenticated
  USING (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Insert checklist" ON public.task_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Update checklist" ON public.task_checklist_items FOR UPDATE TO authenticated
  USING (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Delete checklist" ON public.task_checklist_items FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- Attachments
CREATE POLICY "Read attachments" ON public.task_attachments FOR SELECT TO authenticated
  USING (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Insert attachments" ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Delete attachments" ON public.task_attachments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR uploaded_by = auth.uid());

-- Comments
CREATE POLICY "Read comments" ON public.task_comments FOR SELECT TO authenticated
  USING (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Insert comments" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task(auth.uid(), task_id) AND author_id = auth.uid());
CREATE POLICY "Update own comments" ON public.task_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "Delete own comments" ON public.task_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

-- Watchers
CREATE POLICY "Read watchers" ON public.task_watchers FOR SELECT TO authenticated
  USING (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Admins manage watchers" ON public.task_watchers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- References
CREATE POLICY "Read refs" ON public.task_references FOR SELECT TO authenticated
  USING (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Insert refs" ON public.task_references FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task(auth.uid(), task_id));
CREATE POLICY "Delete refs" ON public.task_references FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- =========================================================
-- 12. updated_at triggers
-- =========================================================
DROP TRIGGER IF EXISTS trg_checklist_updated ON public.task_checklist_items;
CREATE TRIGGER trg_checklist_updated BEFORE UPDATE ON public.task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comments_updated ON public.task_comments;
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 13. REALTIME
-- =========================================================
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_status_history REPLICA IDENTITY FULL;
ALTER TABLE public.task_checklist_items REPLICA IDENTITY FULL;
ALTER TABLE public.task_attachments REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
ALTER TABLE public.task_watchers REPLICA IDENTITY FULL;
ALTER TABLE public.task_references REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1; -- safe wrapper; ignore duplicate publication errors
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_status_history; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_checklist_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attachments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_watchers; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_references; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
