-- Add allow_overbooking to sessions table (max_participants already exists)
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS allow_overbooking boolean DEFAULT false;

-- Create the comprehensive smart enrollment function
CREATE OR REPLACE FUNCTION public.smart_enroll_swimmer(
  p_session_id uuid,
  p_swimmer_id uuid,
  p_parent_id uuid DEFAULT NULL,
  p_force_override boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_enrolled_count integer;
  v_waitlist_count integer;
  v_existing_enrollment uuid;
  v_existing_waitlist uuid;
  v_new_enrollment_id uuid;
  v_new_waitlist_id uuid;
  v_result jsonb;
  v_actual_parent_id uuid;
BEGIN
  -- Get parent_id if not provided
  IF p_parent_id IS NULL THEN
    SELECT parent_id INTO v_actual_parent_id FROM swimmers WHERE id = p_swimmer_id;
  ELSE
    v_actual_parent_id := p_parent_id;
  END IF;

  -- Lock the session row to prevent race conditions
  SELECT 
    s.id,
    s.max_participants,
    s.allow_overbooking,
    s.start_time,
    s.is_cancelled,
    s.status
  INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'action', 'error',
      'message', 'השיעור לא נמצא'
    );
  END IF;

  IF v_session.is_cancelled THEN
    RETURN jsonb_build_object(
      'success', false,
      'action', 'error',
      'message', 'השיעור בוטל'
    );
  END IF;

  IF v_session.start_time < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'action', 'error',
      'message', 'לא ניתן להירשם לשיעור שכבר התחיל'
    );
  END IF;

  -- Check if swimmer is already enrolled
  SELECT id INTO v_existing_enrollment
  FROM enrollments
  WHERE session_id = p_session_id
    AND swimmer_id = p_swimmer_id
    AND status NOT IN ('cancelled');

  IF v_existing_enrollment IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'action', 'already_enrolled',
      'message', 'הילד כבר רשום לשיעור זה'
    );
  END IF;

  -- Check if swimmer is already on waitlist
  SELECT id INTO v_existing_waitlist
  FROM waitlist
  WHERE session_id = p_session_id
    AND swimmer_id = p_swimmer_id
    AND status IN ('waiting', 'notified');

  IF v_existing_waitlist IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'action', 'already_on_waitlist',
      'message', 'הילד כבר ברשימת ההמתנה לשיעור זה'
    );
  END IF;

  -- Count current confirmed enrollments
  SELECT COUNT(*) INTO v_enrolled_count
  FROM enrollments
  WHERE session_id = p_session_id
    AND status NOT IN ('cancelled');

  -- Check capacity
  IF v_enrolled_count < COALESCE(v_session.max_participants, 8) OR p_force_override THEN
    -- Enroll directly
    INSERT INTO enrollments (session_id, swimmer_id, enrolled_by, status, type)
    VALUES (p_session_id, p_swimmer_id, v_actual_parent_id, 'confirmed', 'single')
    RETURNING id INTO v_new_enrollment_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'enrolled',
      'message', 'ההרשמה בוצעה בהצלחה!',
      'enrollment_id', v_new_enrollment_id,
      'spots_remaining', COALESCE(v_session.max_participants, 8) - v_enrolled_count - 1
    );
  ELSE
    -- Add to waitlist
    SELECT COUNT(*) INTO v_waitlist_count
    FROM waitlist
    WHERE session_id = p_session_id
      AND status IN ('waiting', 'notified');

    INSERT INTO waitlist (session_id, swimmer_id, parent_id, position, status)
    VALUES (p_session_id, p_swimmer_id, v_actual_parent_id, v_waitlist_count + 1, 'waiting')
    RETURNING id INTO v_new_waitlist_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'waitlisted',
      'message', 'נוספת לרשימת ההמתנה',
      'waitlist_id', v_new_waitlist_id,
      'position', v_waitlist_count + 1,
      'waitlist_count', v_waitlist_count
    );
  END IF;
END;
$$;

-- Create function to get session enrollment details
CREATE OR REPLACE FUNCTION public.get_session_enrollment_details(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_enrolled_count integer;
  v_waitlist_count integer;
  v_enrolled jsonb;
  v_waitlisted jsonb;
BEGIN
  SELECT 
    s.id,
    s.max_participants,
    s.allow_overbooking,
    s.start_time,
    s.end_time,
    s.is_cancelled,
    s.status,
    ct.name as class_type_name,
    r.name as resource_name,
    l.name as location_name,
    p.first_name as coach_first_name,
    p.last_name as coach_last_name
  INTO v_session
  FROM sessions s
  LEFT JOIN class_types ct ON s.class_type_id = ct.id
  LEFT JOIN resources r ON s.resource_id = r.id
  LEFT JOIN locations l ON r.location_id = l.id
  LEFT JOIN profiles p ON s.coach_id = p.id
  WHERE s.id = p_session_id;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('error', 'Session not found');
  END IF;

  -- Get enrolled swimmers
  SELECT jsonb_agg(
    jsonb_build_object(
      'enrollment_id', e.id,
      'swimmer_id', sw.id,
      'swimmer_name', sw.first_name || ' ' || sw.last_name,
      'parent_id', sw.parent_id,
      'parent_name', COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, ''),
      'parent_phone', pr.phone,
      'enrolled_at', e.enrolled_at,
      'status', e.status,
      'type', e.type
    ) ORDER BY e.enrolled_at
  ) INTO v_enrolled
  FROM enrollments e
  JOIN swimmers sw ON e.swimmer_id = sw.id
  LEFT JOIN profiles pr ON sw.parent_id = pr.id
  WHERE e.session_id = p_session_id
    AND e.status NOT IN ('cancelled');

  SELECT COUNT(*) INTO v_enrolled_count
  FROM enrollments
  WHERE session_id = p_session_id
    AND status NOT IN ('cancelled');

  -- Get waitlisted swimmers
  SELECT jsonb_agg(
    jsonb_build_object(
      'waitlist_id', w.id,
      'swimmer_id', sw.id,
      'swimmer_name', sw.first_name || ' ' || sw.last_name,
      'parent_id', sw.parent_id,
      'parent_name', COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, ''),
      'parent_phone', pr.phone,
      'position', w.position,
      'created_at', w.created_at,
      'status', w.status,
      'time_waiting', EXTRACT(EPOCH FROM (now() - w.created_at))::integer
    ) ORDER BY w.position
  ) INTO v_waitlisted
  FROM waitlist w
  JOIN swimmers sw ON w.swimmer_id = sw.id
  LEFT JOIN profiles pr ON sw.parent_id = pr.id
  WHERE w.session_id = p_session_id
    AND w.status IN ('waiting', 'notified');

  SELECT COUNT(*) INTO v_waitlist_count
  FROM waitlist
  WHERE session_id = p_session_id
    AND status IN ('waiting', 'notified');

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'class_type_name', v_session.class_type_name,
      'resource_name', v_session.resource_name,
      'location_name', v_session.location_name,
      'coach_name', COALESCE(v_session.coach_first_name, '') || ' ' || COALESCE(v_session.coach_last_name, ''),
      'start_time', v_session.start_time,
      'end_time', v_session.end_time,
      'max_participants', COALESCE(v_session.max_participants, 8),
      'is_cancelled', v_session.is_cancelled,
      'status', v_session.status,
      'allow_overbooking', v_session.allow_overbooking
    ),
    'enrolled_count', v_enrolled_count,
    'waitlist_count', v_waitlist_count,
    'spots_remaining', GREATEST(0, COALESCE(v_session.max_participants, 8) - v_enrolled_count),
    'is_full', v_enrolled_count >= COALESCE(v_session.max_participants, 8),
    'enrolled', COALESCE(v_enrolled, '[]'::jsonb),
    'waitlist', COALESCE(v_waitlisted, '[]'::jsonb)
  );
END;
$$;

-- Create function to promote from waitlist (admin action)
CREATE OR REPLACE FUNCTION public.admin_promote_from_waitlist(
  p_waitlist_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waitlist RECORD;
  v_new_enrollment_id uuid;
BEGIN
  -- Get waitlist entry
  SELECT w.*, s.id as session_id
  INTO v_waitlist
  FROM waitlist w
  JOIN sessions s ON w.session_id = s.id
  WHERE w.id = p_waitlist_id
    AND w.status IN ('waiting', 'notified')
  FOR UPDATE;

  IF v_waitlist IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'רשומת המתנה לא נמצאה או כבר טופלה'
    );
  END IF;

  -- Create enrollment
  INSERT INTO enrollments (session_id, swimmer_id, enrolled_by, status, type, notes)
  VALUES (v_waitlist.session_id, v_waitlist.swimmer_id, v_waitlist.parent_id, 'confirmed', 'single', 'קודם מרשימת המתנה')
  RETURNING id INTO v_new_enrollment_id;

  -- Mark waitlist entry as used
  UPDATE waitlist
  SET status = 'enrolled', updated_at = now()
  WHERE id = p_waitlist_id;

  -- Reorder remaining waitlist
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY position) as new_position
    FROM waitlist
    WHERE session_id = v_waitlist.session_id
      AND status IN ('waiting', 'notified')
  )
  UPDATE waitlist w
  SET position = r.new_position
  FROM ranked r
  WHERE w.id = r.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'השחיין קודם בהצלחה לשיעור!',
    'enrollment_id', v_new_enrollment_id
  );
END;
$$;

-- Create function to cancel enrollment and auto-promote waitlist
CREATE OR REPLACE FUNCTION public.cancel_enrollment_with_promotion(
  p_enrollment_id uuid,
  p_notify_waitlist boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment RECORD;
  v_next_waitlist RECORD;
  v_promoted boolean := false;
BEGIN
  -- Get enrollment
  SELECT e.*, s.id as session_id, s.max_participants
  INTO v_enrollment
  FROM enrollments e
  JOIN sessions s ON e.session_id = s.id
  WHERE e.id = p_enrollment_id
  FOR UPDATE;

  IF v_enrollment IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'ההרשמה לא נמצאה'
    );
  END IF;

  -- Cancel the enrollment
  UPDATE enrollments
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_enrollment_id;

  -- Check if we should promote someone from waitlist
  IF p_notify_waitlist THEN
    SELECT * INTO v_next_waitlist
    FROM waitlist
    WHERE session_id = v_enrollment.session_id
      AND status = 'waiting'
    ORDER BY position
    LIMIT 1
    FOR UPDATE;

    IF v_next_waitlist IS NOT NULL THEN
      -- Notify the person on waitlist
      UPDATE waitlist
      SET status = 'notified',
          notified_at = now(),
          expires_at = now() + interval '24 hours',
          updated_at = now()
      WHERE id = v_next_waitlist.id;

      v_promoted := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'ההרשמה בוטלה בהצלחה',
    'waitlist_notified', v_promoted
  );
END;
$$;

-- Update session max capacity function
CREATE OR REPLACE FUNCTION public.update_session_capacity(
  p_session_id uuid,
  p_max_participants integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_enrolled integer;
BEGIN
  -- Get current enrollment count
  SELECT COUNT(*) INTO v_current_enrolled
  FROM enrollments
  WHERE session_id = p_session_id
    AND status NOT IN ('cancelled');

  -- Update capacity
  UPDATE sessions
  SET max_participants = p_max_participants,
      updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'הקיבולת עודכנה בהצלחה',
    'new_capacity', p_max_participants,
    'current_enrolled', v_current_enrolled,
    'spots_remaining', GREATEST(0, p_max_participants - v_current_enrolled)
  );
END;
$$;