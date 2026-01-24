-- Drop and recreate the function with enhanced logic that also updates user names
CREATE OR REPLACE FUNCTION public.create_school_and_owner(
  p_school_name TEXT,
  p_owner_first_name TEXT,
  p_owner_last_name TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_slug TEXT;
  v_base_slug TEXT;
  v_counter INTEGER := 0;
  v_school_id UUID;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'משתמש לא מחובר'
    );
  END IF;
  
  -- Check if user already has a school
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND school_id IS NOT NULL) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'למשתמש זה כבר יש בית ספר משויך'
    );
  END IF;
  
  -- Generate base slug from school name (Hebrew-safe)
  v_base_slug := lower(regexp_replace(p_school_name, '[^א-תa-z0-9]', '-', 'g'));
  v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
  v_base_slug := trim(BOTH '-' FROM v_base_slug);
  
  -- If slug is empty, use a random string
  IF v_base_slug = '' OR v_base_slug IS NULL THEN
    v_base_slug := 'school-' || substring(gen_random_uuid()::text, 1, 8);
  END IF;
  
  v_slug := v_base_slug;
  
  -- Ensure unique slug
  WHILE EXISTS (SELECT 1 FROM public.schools WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  END LOOP;
  
  -- Create the school
  INSERT INTO public.schools (name, slug, owner_id)
  VALUES (p_school_name, v_slug, v_user_id)
  RETURNING id INTO v_school_id;
  
  -- Update user profile with school_id, role, and names
  UPDATE public.profiles
  SET 
    school_id = v_school_id, 
    role = 'admin',
    first_name = p_owner_first_name,
    last_name = p_owner_last_name
  WHERE id = v_user_id;
  
  -- Ensure user_roles is set to admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = now();
  
  RETURN json_build_object(
    'success', true,
    'school_id', v_school_id,
    'slug', v_slug,
    'message', 'בית הספר נוצר בהצלחה'
  );
END;
$$;