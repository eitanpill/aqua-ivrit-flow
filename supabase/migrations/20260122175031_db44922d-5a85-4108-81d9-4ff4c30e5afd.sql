
-- Add age restrictions to class_levels
ALTER TABLE public.class_levels 
ADD COLUMN IF NOT EXISTS min_age INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_age INTEGER DEFAULT 99;

-- Add enrollment type to enrollments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_type') THEN
    CREATE TYPE public.enrollment_type AS ENUM ('permanent', 'single', 'makeup');
  END IF;
END$$;

ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS type public.enrollment_type NOT NULL DEFAULT 'single';

-- Create enrollment validation function
CREATE OR REPLACE FUNCTION public.validate_enrollment(
  p_swimmer_id UUID,
  p_session_id UUID,
  p_force_override BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_swimmer RECORD;
  v_class_level RECORD;
  v_current_count INTEGER;
  v_swimmer_age INTEGER;
  v_warnings TEXT[] := '{}';
  v_errors TEXT[] := '{}';
  v_can_enroll BOOLEAN := TRUE;
BEGIN
  -- Get session details
  SELECT s.*, ct.name as class_type_name, ct.level_id, ct.max_participants as ct_max
  INTO v_session
  FROM public.sessions s
  JOIN public.class_types ct ON s.class_type_id = ct.id
  WHERE s.id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'שיעור לא נמצא');
  END IF;

  -- Get swimmer details
  SELECT * INTO v_swimmer
  FROM public.swimmers
  WHERE id = p_swimmer_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'שחיין לא נמצא');
  END IF;

  -- Calculate swimmer age
  IF v_swimmer.birth_date IS NOT NULL THEN
    v_swimmer_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_swimmer.birth_date));
  ELSE
    v_swimmer_age := NULL;
  END IF;

  -- Get class level for age validation
  IF v_session.level_id IS NOT NULL THEN
    SELECT * INTO v_class_level
    FROM public.class_levels
    WHERE id = v_session.level_id;
    
    -- Check age restrictions
    IF v_swimmer_age IS NOT NULL AND v_class_level.min_age IS NOT NULL THEN
      IF v_swimmer_age < v_class_level.min_age THEN
        v_warnings := array_append(v_warnings, 'גיל השחיין (' || v_swimmer_age || ') נמוך מהגיל המינימלי (' || v_class_level.min_age || ')');
      END IF;
    END IF;
    
    IF v_swimmer_age IS NOT NULL AND v_class_level.max_age IS NOT NULL THEN
      IF v_swimmer_age > v_class_level.max_age THEN
        v_warnings := array_append(v_warnings, 'גיל השחיין (' || v_swimmer_age || ') גבוה מהגיל המקסימלי (' || v_class_level.max_age || ')');
      END IF;
    END IF;
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_current_count
  FROM public.enrollments
  WHERE session_id = p_session_id
    AND status NOT IN ('cancelled');
  
  IF v_current_count >= COALESCE(v_session.max_participants, v_session.ct_max, 8) THEN
    IF NOT p_force_override THEN
      v_errors := array_append(v_errors, 'השיעור מלא (' || v_current_count || '/' || COALESCE(v_session.max_participants, v_session.ct_max, 8) || ')');
      v_can_enroll := FALSE;
    ELSE
      v_warnings := array_append(v_warnings, 'השיעור מלא - הרשמה בכפייה');
    END IF;
  END IF;

  -- Check double booking
  IF EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.sessions s ON e.session_id = s.id
    WHERE e.swimmer_id = p_swimmer_id
      AND e.status NOT IN ('cancelled')
      AND s.start_time < v_session.end_time
      AND s.end_time > v_session.start_time
  ) THEN
    v_errors := array_append(v_errors, 'השחיין כבר רשום לשיעור בשעה זו');
    v_can_enroll := FALSE;
  END IF;

  -- Check session status
  IF v_session.status = 'cancelled' OR v_session.is_cancelled = true THEN
    v_errors := array_append(v_errors, 'השיעור בוטל');
    v_can_enroll := FALSE;
  END IF;

  RETURN json_build_object(
    'success', true,
    'can_enroll', v_can_enroll,
    'errors', v_errors,
    'warnings', v_warnings,
    'session', json_build_object(
      'id', v_session.id,
      'class_type_name', v_session.class_type_name,
      'start_time', v_session.start_time,
      'end_time', v_session.end_time,
      'current_count', v_current_count,
      'max_capacity', COALESCE(v_session.max_participants, v_session.ct_max, 8)
    ),
    'swimmer', json_build_object(
      'id', v_swimmer.id,
      'name', v_swimmer.first_name || ' ' || v_swimmer.last_name,
      'age', v_swimmer_age
    )
  );
END;
$$;

-- Create function to add to waitlist
CREATE OR REPLACE FUNCTION public.add_to_waitlist(
  p_swimmer_id UUID,
  p_session_id UUID,
  p_parent_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_position INTEGER;
  v_existing RECORD;
BEGIN
  -- Check if already on waitlist
  SELECT * INTO v_existing
  FROM public.waitlist
  WHERE swimmer_id = p_swimmer_id 
    AND session_id = p_session_id
    AND status IN ('waiting', 'notified');
  
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'השחיין כבר ברשימת ההמתנה');
  END IF;

  -- Get next position
  v_position := get_next_waitlist_position(p_session_id);

  -- Insert into waitlist
  INSERT INTO public.waitlist (swimmer_id, session_id, parent_id, position, status)
  VALUES (p_swimmer_id, p_session_id, p_parent_id, v_position, 'waiting');

  RETURN json_build_object(
    'success', true,
    'position', v_position,
    'message', 'נוספת לרשימת ההמתנה במקום ' || v_position
  );
END;
$$;

-- Create function to promote from waitlist
CREATE OR REPLACE FUNCTION public.promote_from_waitlist(
  p_waitlist_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_waitlist RECORD;
  v_validation JSON;
BEGIN
  -- Get waitlist entry
  SELECT * INTO v_waitlist
  FROM public.waitlist
  WHERE id = p_waitlist_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'רשומה לא נמצאה');
  END IF;

  -- Validate enrollment (with force override since admin is promoting)
  v_validation := validate_enrollment(v_waitlist.swimmer_id, v_waitlist.session_id, true);
  
  IF NOT (v_validation->>'can_enroll')::boolean THEN
    RETURN json_build_object('success', false, 'error', v_validation->'errors'->0);
  END IF;

  -- Create enrollment
  INSERT INTO public.enrollments (swimmer_id, session_id, status, type)
  VALUES (v_waitlist.swimmer_id, v_waitlist.session_id, 'confirmed', 'single');

  -- Update waitlist status
  UPDATE public.waitlist
  SET status = 'enrolled'
  WHERE id = p_waitlist_id;

  RETURN json_build_object(
    'success', true,
    'message', 'השחיין נרשם בהצלחה'
  );
END;
$$;

-- Create function to get session availability
CREATE OR REPLACE FUNCTION public.get_session_availability(
  p_session_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_current_count INTEGER;
  v_max_capacity INTEGER;
  v_waitlist_count INTEGER;
BEGIN
  -- Get session with class type
  SELECT s.*, ct.max_participants as ct_max, ct.name as class_type_name
  INTO v_session
  FROM public.sessions s
  JOIN public.class_types ct ON s.class_type_id = ct.id
  WHERE s.id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'שיעור לא נמצא');
  END IF;

  -- Count enrollments
  SELECT COUNT(*) INTO v_current_count
  FROM public.enrollments
  WHERE session_id = p_session_id
    AND status NOT IN ('cancelled');

  v_max_capacity := COALESCE(v_session.max_participants, v_session.ct_max, 8);

  -- Count waitlist
  SELECT COUNT(*) INTO v_waitlist_count
  FROM public.waitlist
  WHERE session_id = p_session_id
    AND status IN ('waiting', 'notified');

  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'class_type_name', v_session.class_type_name,
    'current_count', v_current_count,
    'max_capacity', v_max_capacity,
    'available_spots', GREATEST(0, v_max_capacity - v_current_count),
    'is_full', v_current_count >= v_max_capacity,
    'waitlist_count', v_waitlist_count
  );
END;
$$;
