CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  derived_username text;
  derived_display_name text;
BEGIN
  derived_username := NULLIF(NEW.raw_user_meta_data->>'username', '');
  IF derived_username IS NULL AND NEW.email LIKE '%@4creative.local' THEN
    derived_username := split_part(NEW.email, '@', 1);
  END IF;

  derived_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    derived_username,
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, username, display_name, name_ar, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    derived_username,
    derived_display_name,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name_ar', ''), derived_display_name),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    name_ar = COALESCE(public.profiles.name_ar, EXCLUDED.name_ar),
    is_active = COALESCE(public.profiles.is_active, EXCLUDED.is_active),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();