-- Function to create a school with unique slug
CREATE OR REPLACE FUNCTION public.create_school_for_owner(
  p_user_id UUID,
  p_school_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_base_slug TEXT;
  v_counter INTEGER := 0;
  v_school_id UUID;
BEGIN
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
  INSERT INTO public.schools (name, slug, owner_id, email, phone)
  VALUES (p_school_name, v_slug, p_user_id, p_email, p_phone)
  RETURNING id INTO v_school_id;
  
  -- Update user profile with school_id and admin role
  UPDATE public.profiles
  SET school_id = v_school_id, role = 'admin'
  WHERE id = p_user_id;
  
  -- Ensure user_roles is set to admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = now();
  
  RETURN json_build_object(
    'success', true,
    'school_id', v_school_id,
    'slug', v_slug,
    'message', 'בית הספר נוצר בהצלחה'
  );
END;
$$;

-- Function to join an existing school by slug
CREATE OR REPLACE FUNCTION public.join_school_by_slug(
  p_user_id UUID,
  p_school_slug TEXT,
  p_role app_role DEFAULT 'customer'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school RECORD;
BEGIN
  -- Find school by slug
  SELECT id, name INTO v_school
  FROM public.schools
  WHERE slug = p_school_slug;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'בית ספר לא נמצא'
    );
  END IF;
  
  -- Update user profile with school_id
  UPDATE public.profiles
  SET school_id = v_school.id, role = p_role
  WHERE id = p_user_id;
  
  -- Set user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = p_role, updated_at = now();
  
  RETURN json_build_object(
    'success', true,
    'school_id', v_school.id,
    'school_name', v_school.name,
    'message', 'הצטרפת לבית הספר בהצלחה'
  );
END;
$$;

-- Function to get school by slug (public for invite pages)
CREATE OR REPLACE FUNCTION public.get_school_by_slug(p_slug TEXT)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'logo_url', logo_url
  )
  FROM public.schools
  WHERE slug = p_slug;
$$;