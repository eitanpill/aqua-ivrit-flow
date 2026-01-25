-- 1. Drop the existing function to ensure no stale logic remains
DROP FUNCTION IF EXISTS public.create_school_and_owner(text, text, text);

-- 2. Re-create the function with "Upsert Profile" logic
CREATE OR REPLACE FUNCTION public.create_school_and_owner(
  p_school_name text,
  p_owner_first_name text,
  p_owner_last_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  new_school_id uuid;
  generated_slug text;
BEGIN
  -- Get the current User ID
  current_user_id := auth.uid();
  
  -- Validation: Ensure we have a user
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User is not authenticated';
  END IF;

  -- 1. FORCE PROFILE CREATION (The Fix)
  -- We use INSERT ... ON CONFLICT to ensure the profile exists before using it as a Foreign Key
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (current_user_id, p_owner_first_name, p_owner_last_name, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET 
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

  -- 2. Generate Slug
  generated_slug := lower(regexp_replace(p_school_name, '[^a-zA-Z0-9]+', '-', 'g'));

  -- 3. Create School (Now safe because owner_id definitely exists in profiles)
  INSERT INTO public.schools (name, slug, owner_id)
  VALUES (p_school_name, generated_slug, current_user_id)
  RETURNING id INTO new_school_id;

  -- 4. Link Profile to School
  UPDATE public.profiles
  SET school_id = new_school_id
  WHERE id = current_user_id;

  -- 5. Ensure user_roles is set
  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin';

  RETURN new_school_id;
END;
$$;