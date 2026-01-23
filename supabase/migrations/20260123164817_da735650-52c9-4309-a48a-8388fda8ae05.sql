-- Create function to check if a coach has a conflicting session
CREATE OR REPLACE FUNCTION public.check_coach_conflict(
  p_coach_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_session_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_session RECORD;
BEGIN
  -- Validate inputs
  IF p_coach_id IS NULL THEN
    RETURN json_build_object('has_conflict', false);
  END IF;

  -- Check for overlapping sessions where coach is assigned
  SELECT s.id, s.start_time, s.end_time, ct.name as class_type_name
  INTO v_conflict_session
  FROM sessions s
  LEFT JOIN class_types ct ON s.class_type_id = ct.id
  WHERE s.coach_id = p_coach_id
    AND s.is_cancelled = false
    AND s.status NOT IN ('cancelled', 'completed')
    AND (p_exclude_session_id IS NULL OR s.id != p_exclude_session_id)
    AND (
      (p_start_time >= s.start_time AND p_start_time < s.end_time) OR
      (p_end_time > s.start_time AND p_end_time <= s.end_time) OR
      (p_start_time <= s.start_time AND p_end_time >= s.end_time)
    )
  LIMIT 1;

  IF v_conflict_session.id IS NOT NULL THEN
    RETURN json_build_object(
      'has_conflict', true,
      'conflict_session_id', v_conflict_session.id,
      'conflict_start_time', v_conflict_session.start_time,
      'conflict_end_time', v_conflict_session.end_time,
      'conflict_class_name', v_conflict_session.class_type_name
    );
  END IF;

  RETURN json_build_object('has_conflict', false);
END;
$$;