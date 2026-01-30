
-- Fix create_school_and_owner to properly set admin role on profiles table
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
  base_slug text;
  final_slug text;
  rnd_suffix text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User is not authenticated';
  END IF;

  -- 1. Upsert Profile - NOW ALSO UPDATES ROLE TO ADMIN!
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (current_user_id, p_owner_first_name, p_owner_last_name, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET 
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = 'admin';  -- <<<< THIS WAS MISSING!

  -- 2. Generate Unique Slug (Name + Random 4 digits)
  base_slug := lower(regexp_replace(p_school_name, '[^a-zA-Z0-9]+', '-', '-', 'g'));
  base_slug := trim(BOTH '-' FROM base_slug);
  
  -- Generate a random number between 1000 and 9999
  rnd_suffix := (floor(random() * (9999 - 1000 + 1) + 1000))::text;
  final_slug := base_slug || '-' || rnd_suffix;

  -- 3. Create School
  INSERT INTO public.schools (name, slug, owner_id)
  VALUES (p_school_name, final_slug, current_user_id)
  RETURNING id INTO new_school_id;

  -- 4. Link Profile to School
  UPDATE public.profiles
  SET school_id = new_school_id
  WHERE id = current_user_id;

  -- 5. Ensure user_roles is set to admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin';

  RETURN new_school_id;
END;
$$;
