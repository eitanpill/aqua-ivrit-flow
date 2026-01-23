-- Part 13: Simplified Scheduling & User Management

-- 1. Make term_id optional in schedule_series
ALTER TABLE public.schedule_series
ALTER COLUMN term_id DROP NOT NULL;

-- 2. Add start_date and end_date to schedule_series for standalone series
ALTER TABLE public.schedule_series
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date;

-- 3. Update generate_sessions_from_series to work without term
CREATE OR REPLACE FUNCTION public.generate_sessions_from_series(p_series_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series record;
  v_term record;
  v_current_date date;
  v_end_date date;
  v_session_start timestamp with time zone;
  v_session_end timestamp with time zone;
  v_sessions_created int := 0;
  v_conflicts_skipped int := 0;
  v_week_counter int := 0;
  v_has_conflict boolean;
BEGIN
  -- Get series details
  SELECT * INTO v_series FROM schedule_series WHERE id = p_series_id;
  
  IF v_series IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Series not found');
  END IF;
  
  -- Determine date range - use series dates OR term dates
  IF v_series.start_date IS NOT NULL AND v_series.end_date IS NOT NULL THEN
    -- Use series-level dates
    v_current_date := v_series.start_date;
    v_end_date := v_series.end_date;
  ELSIF v_series.term_id IS NOT NULL THEN
    -- Use term dates
    SELECT * INTO v_term FROM terms WHERE id = v_series.term_id;
    IF v_term IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Term not found');
    END IF;
    v_current_date := v_term.start_date;
    v_end_date := v_term.end_date;
  ELSE
    RETURN json_build_object('success', false, 'error', 'No date range specified (need term or start/end dates)');
  END IF;
  
  -- Find first occurrence of the day_of_week
  WHILE EXTRACT(DOW FROM v_current_date) != v_series.day_of_week LOOP
    v_current_date := v_current_date + 1;
  END LOOP;
  
  -- Generate sessions
  WHILE v_current_date <= v_end_date LOOP
    -- Build session timestamps
    v_session_start := v_current_date + v_series.start_time;
    v_session_end := v_session_start + (v_series.duration_minutes || ' minutes')::interval;
    
    -- Check for resource conflicts if resource is specified
    v_has_conflict := false;
    IF v_series.resource_id IS NOT NULL THEN
      SELECT check_pool_conflict(
        v_session_start::text,
        v_session_end::text,
        v_series.resource_id,
        NULL
      ) INTO v_has_conflict;
    END IF;
    
    IF v_has_conflict THEN
      v_conflicts_skipped := v_conflicts_skipped + 1;
    ELSE
      -- Create the session
      INSERT INTO sessions (
        class_type_id,
        coach_id,
        resource_id,
        start_time,
        end_time,
        max_participants,
        series_id,
        school_id,
        status
      ) VALUES (
        v_series.class_type_id,
        v_series.coach_id,
        v_series.resource_id,
        v_session_start,
        v_session_end,
        v_series.max_participants,
        v_series.id,
        v_series.school_id,
        'scheduled'
      );
      v_sessions_created := v_sessions_created + 1;
    END IF;
    
    -- Move to next occurrence based on recurrence_weeks
    v_current_date := v_current_date + (v_series.recurrence_weeks * 7);
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'sessions_created', v_sessions_created,
    'conflicts_skipped', v_conflicts_skipped
  );
END;
$$;

-- 4. Create function to create user with profile (for admin user creation)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_role app_role DEFAULT 'customer'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_school_id uuid;
BEGIN
  -- Only admins can create profiles
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can create users');
  END IF;
  
  -- Get the admin's school
  v_school_id := get_user_school_id();
  
  IF v_school_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No school found for admin');
  END IF;
  
  -- Generate a new profile ID
  v_profile_id := gen_random_uuid();
  
  -- Create the profile (shadow profile - will be linked when user signs up)
  INSERT INTO profiles (id, first_name, last_name, phone, role, school_id)
  VALUES (v_profile_id, p_first_name, p_last_name, p_phone, p_role, v_school_id);
  
  -- Create user_role entry
  INSERT INTO user_roles (user_id, role)
  VALUES (v_profile_id, p_role);
  
  RETURN json_build_object(
    'success', true,
    'profile_id', v_profile_id
  );
END;
$$;

-- 5. Create function to update user profile (for admin)
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id uuid,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_role app_role DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_target_school_id uuid;
BEGIN
  -- Only admins can update users
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can update users');
  END IF;
  
  -- Get the admin's school
  v_school_id := get_user_school_id();
  
  -- Get target user's school
  SELECT school_id INTO v_target_school_id FROM profiles WHERE id = p_user_id;
  
  -- Ensure user belongs to same school
  IF v_target_school_id != v_school_id THEN
    RETURN json_build_object('success', false, 'error', 'User not in your school');
  END IF;
  
  -- Update profile
  UPDATE profiles
  SET 
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    phone = COALESCE(p_phone, phone),
    role = COALESCE(p_role, role),
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Update user_roles if role changed
  IF p_role IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (p_user_id, p_role)
    ON CONFLICT (user_id) DO UPDATE SET role = p_role, updated_at = now();
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$;

-- 6. Create function to delete/deactivate user
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_target_school_id uuid;
BEGIN
  -- Only admins can delete users
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can delete users');
  END IF;
  
  -- Prevent self-deletion
  IF p_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete yourself');
  END IF;
  
  -- Get the admin's school
  v_school_id := get_user_school_id();
  
  -- Get target user's school
  SELECT school_id INTO v_target_school_id FROM profiles WHERE id = p_user_id;
  
  -- Ensure user belongs to same school
  IF v_target_school_id != v_school_id THEN
    RETURN json_build_object('success', false, 'error', 'User not in your school');
  END IF;
  
  -- Delete user_roles
  DELETE FROM user_roles WHERE user_id = p_user_id;
  
  -- Delete profile (cascading will handle related records or they'll become orphaned)
  DELETE FROM profiles WHERE id = p_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- 7. Create function for admin to force-enroll a swimmer
CREATE OR REPLACE FUNCTION public.admin_force_enroll(
  p_swimmer_id uuid,
  p_session_id uuid,
  p_enrollment_type enrollment_type DEFAULT 'permanent'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
  v_swimmer_school_id uuid;
  v_session_school_id uuid;
BEGIN
  -- Only admins can force enroll
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can force enroll');
  END IF;
  
  -- Check swimmer and session belong to same school
  SELECT school_id INTO v_swimmer_school_id FROM swimmers WHERE id = p_swimmer_id;
  SELECT school_id INTO v_session_school_id FROM sessions WHERE id = p_session_id;
  
  IF v_swimmer_school_id != v_session_school_id THEN
    RETURN json_build_object('success', false, 'error', 'Swimmer and session are from different schools');
  END IF;
  
  -- Check if already enrolled
  IF EXISTS (
    SELECT 1 FROM enrollments 
    WHERE swimmer_id = p_swimmer_id 
    AND session_id = p_session_id 
    AND status != 'cancelled'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Swimmer already enrolled in this session');
  END IF;
  
  -- Force create enrollment (bypass capacity checks)
  INSERT INTO enrollments (swimmer_id, session_id, type, status, enrolled_by, school_id)
  VALUES (p_swimmer_id, p_session_id, p_enrollment_type, 'confirmed', auth.uid(), v_swimmer_school_id)
  RETURNING id INTO v_enrollment_id;
  
  RETURN json_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id
  );
END;
$$;