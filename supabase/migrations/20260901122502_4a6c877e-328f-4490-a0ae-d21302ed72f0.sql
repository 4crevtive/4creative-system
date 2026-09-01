DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname, n.nspname, t.relname, a.attname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class rt ON rt.oid = c.confrelid
    JOIN pg_namespace rn ON rn.oid = rt.relnamespace
    JOIN unnest(c.conkey) k ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
    WHERE c.contype = 'f'
      AND rn.nspname = 'auth' AND rt.relname = 'users'
      AND n.nspname = 'public'
      AND c.confdeltype = 'a'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL', r.nspname, r.relname, r.attname);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.nspname, r.relname, r.conname);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL', r.nspname, r.relname, r.conname, r.attname);
  END LOOP;
END $$;