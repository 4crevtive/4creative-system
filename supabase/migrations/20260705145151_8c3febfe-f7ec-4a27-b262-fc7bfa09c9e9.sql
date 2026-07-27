
-- Notes table
CREATE TABLE public.project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  color TEXT DEFAULT 'default',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_notes TO authenticated;
GRANT ALL ON public.project_notes TO service_role;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_members" ON public.project_notes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id) OR author_id = auth.uid());
CREATE POLICY "notes_insert_own" ON public.project_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id)));
CREATE POLICY "notes_update_own" ON public.project_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notes_delete_own" ON public.project_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_project_notes_updated BEFORE UPDATE ON public.project_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chat messages
CREATE TABLE public.project_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to UUID REFERENCES public.project_chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_chat_messages TO authenticated;
GRANT ALL ON public.project_chat_messages TO service_role;
ALTER TABLE public.project_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_select_members" ON public.project_chat_messages FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id));
CREATE POLICY "chat_insert_members" ON public.project_chat_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.is_project_member(auth.uid(), project_id)));
CREATE POLICY "chat_delete_own" ON public.project_chat_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_chat_messages;

CREATE INDEX idx_notes_project ON public.project_notes(project_id, created_at DESC);
CREATE INDEX idx_chat_project ON public.project_chat_messages(project_id, created_at DESC);
