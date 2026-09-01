CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  record_label text,
  changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'dept_manager')
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs (table_name);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_id);

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _name text;
  _role text;
  _old jsonb;
  _new jsonb;
  _changed jsonb := '{}'::jsonb;
  _label text;
  _rid uuid;
  _key text;
BEGIN
  SELECT p.email, coalesce(p.display_name, p.name_ar, p.email)
    INTO _email, _name
  FROM public.profiles p WHERE p.id = _uid;

  SELECT r.role::text INTO _role
  FROM public.user_roles r WHERE r.user_id = _uid
  ORDER BY CASE r.role
    WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
    WHEN 'dept_manager' THEN 3 ELSE 4 END
  LIMIT 1;

  IF TG_OP <> 'INSERT' THEN _old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN _new := to_jsonb(NEW); END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR _key IN SELECT jsonb_object_keys(_new) LOOP
      IF _key NOT IN ('updated_at') AND coalesce(_old -> _key, 'null'::jsonb) IS DISTINCT FROM coalesce(_new -> _key, 'null'::jsonb) THEN
        _changed := _changed || jsonb_build_object(_key, jsonb_build_object('from', _old -> _key, 'to', _new -> _key));
      END IF;
    END LOOP;
    IF _changed = '{}'::jsonb THEN RETURN NEW; END IF;
  END IF;

  _rid := nullif(coalesce(_new, _old) ->> 'id', '')::uuid;
  _label := coalesce(
    coalesce(_new, _old) ->> 'title',
    coalesce(_new, _old) ->> 'name',
    coalesce(_new, _old) ->> 'full_name',
    coalesce(_new, _old) ->> 'invoice_number',
    coalesce(_new, _old) ->> 'description',
    _rid::text
  );

  INSERT INTO public.audit_logs (
    actor_id, actor_email, actor_name, actor_role,
    action, table_name, record_id, record_label,
    changed_fields, old_data, new_data
  ) VALUES (
    _uid, _email, _name, _role,
    lower(TG_OP), TG_TABLE_NAME, _rid, left(_label, 200),
    _changed, _old, _new
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tasks','contacts','agency_clients','agency_projects','cash_movements',
    'studio_packages','package_offerings','freelancers','bookings',
    'invoices','payments','user_roles','project_expenses','project_members'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.record_audit_log()', t);
  END LOOP;
END $$;