-- Update create_school_and_owner function to accept additional school and pool details
CREATE OR REPLACE FUNCTION public.create_school_and_owner(
  p_school_name text,
  p_owner_first_name text,
  p_owner_last_name text,
  p_school_phone text DEFAULT NULL,
  p_school_email text DEFAULT NULL,
  p_pool_name text DEFAULT NULL,
  p_pool_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  new_school_id uuid;
  new_location_id uuid;
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
    role = 'admin';

  -- 2. Generate Unique Slug (supports Hebrew and other non-ASCII chars)
  -- Keep Hebrew letters (א-ת), English letters, and numbers
  base_slug := lower(regexp_replace(p_school_name, '[^א-תa-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(BOTH '-' FROM base_slug);
  
  -- If slug is empty after processing, use a default
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'school';
  END IF;
  
  -- Generate a random number between 1000 and 9999
  rnd_suffix := (floor(random() * (9999 - 1000 + 1) + 1000))::int::text;
  final_slug := base_slug || '-' || rnd_suffix;

  -- 3. Create School with additional details
  INSERT INTO public.schools (name, slug, owner_id, phone, email, address)
  VALUES (p_school_name, final_slug, current_user_id, p_school_phone, p_school_email, p_pool_address)
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

  -- 6. Create initial location (pool) if pool name provided
  IF p_pool_name IS NOT NULL AND p_pool_name <> '' THEN
    INSERT INTO public.locations (name, address, school_id)
    VALUES (p_pool_name, p_pool_address, new_school_id)
    RETURNING id INTO new_location_id;
    
    -- Create a default pool resource for this location
    INSERT INTO public.resources (name, type, location_id, school_id, capacity)
    VALUES ('בריכה ראשית', 'pool', new_location_id, new_school_id, 6);
  END IF;

  RETURN new_school_id;
END;
$$;