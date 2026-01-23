-- Drop existing function and recreate with age validation
DROP FUNCTION IF EXISTS public.validate_enrollment(uuid, uuid, boolean);

CREATE FUNCTION public.validate_enrollment(
  p_session_id uuid,
  p_swimmer_id uuid,
  p_force_override boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_swimmer RECORD;
  v_class_level RECORD;
  v_enrolled_count INTEGER;
  v_max_participants INTEGER;
  v_swimmer_age INTEGER;
  v_existing_enrollment RECORD;
  v_conflicting_session RECORD;
BEGIN
  -- Fetch session details
  SELECT s.*, ct.level_id, ct.max_participants as type_max
  INTO v_session
  FROM sessions s
  JOIN class_types ct ON s.class_type_id = ct.id
  WHERE s.id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'השיעור לא נמצא');
  END IF;
  
  -- Check if session is cancelled
  IF v_session.status = 'cancelled' OR v_session.is_cancelled THEN
    RETURN json_build_object('valid', false, 'error', 'לא ניתן להירשם לשיעור מבוטל');
  END IF;
  
  -- Fetch swimmer details
  SELECT * INTO v_swimmer
  FROM swimmers
  WHERE id = p_swimmer_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'השחיין לא נמצא');
  END IF;
  
  -- Check existing enrollment
  SELECT * INTO v_existing_enrollment
  FROM enrollments
  WHERE session_id = p_session_id
    AND swimmer_id = p_swimmer_id
    AND status != 'cancelled';
  
  IF FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'השחיין כבר רשום לשיעור זה');
  END IF;
  
  -- Check for overlapping sessions
  SELECT s.* INTO v_conflicting_session
  FROM sessions s
  JOIN enrollments e ON s.id = e.session_id
  WHERE e.swimmer_id = p_swimmer_id
    AND e.status != 'cancelled'
    AND s.id != p_session_id
    AND s.status != 'cancelled'
    AND (
      (v_session.start_time, v_session.end_time) OVERLAPS (s.start_time, s.end_time)
    )
  LIMIT 1;
  
  IF FOUND AND NOT p_force_override THEN
    RETURN json_build_object(
      'valid', false, 
      'error', 'השחיין רשום לשיעור אחר באותו הזמן',
      'conflicting_session_id', v_conflicting_session.id
    );
  END IF;
  
  -- AGE VALIDATION: Check swimmer age against class level requirements
  IF v_session.level_id IS NOT NULL AND v_swimmer.birth_date IS NOT NULL THEN
    -- Calculate swimmer age in years
    v_swimmer_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_swimmer.birth_date));
    
    -- Fetch class level age requirements
    SELECT * INTO v_class_level
    FROM class_levels
    WHERE id = v_session.level_id;
    
    IF FOUND THEN
      -- Check minimum age
      IF v_class_level.min_age IS NOT NULL AND v_swimmer_age < v_class_level.min_age THEN
        IF NOT p_force_override THEN
          RETURN json_build_object(
            'valid', false, 
            'error', 'הילד אינו בגיל המתאים לרמה זו. גיל מינימום: ' || v_class_level.min_age || ', גיל הילד: ' || v_swimmer_age,
            'age_error', true,
            'swimmer_age', v_swimmer_age,
            'required_min_age', v_class_level.min_age
          );
        END IF;
      END IF;
      
      -- Check maximum age
      IF v_class_level.max_age IS NOT NULL AND v_swimmer_age > v_class_level.max_age THEN
        IF NOT p_force_override THEN
          RETURN json_build_object(
            'valid', false, 
            'error', 'הילד אינו בגיל המתאים לרמה זו. גיל מקסימום: ' || v_class_level.max_age || ', גיל הילד: ' || v_swimmer_age,
            'age_error', true,
            'swimmer_age', v_swimmer_age,
            'required_max_age', v_class_level.max_age
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Check capacity
  v_max_participants := COALESCE(v_session.max_participants, v_session.type_max, 8);
  
  SELECT COUNT(*) INTO v_enrolled_count
  FROM enrollments
  WHERE session_id = p_session_id
    AND status != 'cancelled';
  
  IF v_enrolled_count >= v_max_participants AND NOT COALESCE(v_session.allow_overbooking, false) AND NOT p_force_override THEN
    RETURN json_build_object(
      'valid', false, 
      'error', 'השיעור מלא',
      'can_waitlist', true,
      'enrolled_count', v_enrolled_count,
      'max_participants', v_max_participants
    );
  END IF;
  
  -- All validations passed
  RETURN json_build_object(
    'valid', true,
    'enrolled_count', v_enrolled_count,
    'max_participants', v_max_participants,
    'spots_remaining', v_max_participants - v_enrolled_count
  );
END;
$$;