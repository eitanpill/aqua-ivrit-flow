-- Create an efficient RPC function to get sessions with enrollment counts in a single query
-- This replaces the N+1 query pattern in EnrollmentWizard

CREATE OR REPLACE FUNCTION get_sessions_with_counts(
  p_school_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  id uuid,
  start_time timestamptz,
  end_time timestamptz,
  max_participants integer,
  class_type_id uuid,
  class_type_name text,
  class_type_max_participants integer,
  resource_id uuid,
  resource_name text,
  coach_id uuid,
  coach_first_name text,
  coach_last_name text,
  school_id uuid,
  status text,
  is_deleted boolean,
  enrollment_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id,
    s.start_time,
    s.end_time,
    s.max_participants,
    s.class_type_id,
    ct.name as class_type_name,
    ct.max_participants as class_type_max_participants,
    s.resource_id,
    r.name as resource_name,
    s.coach_id,
    p.first_name as coach_first_name,
    p.last_name as coach_last_name,
    s.school_id,
    s.status::text,
    s.is_deleted,
    COALESCE(ec.enrollment_count, 0) as enrollment_count
  FROM sessions s
  LEFT JOIN class_types ct ON s.class_type_id = ct.id
  LEFT JOIN resources r ON s.resource_id = r.id
  LEFT JOIN profiles p ON s.coach_id = p.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as enrollment_count
    FROM enrollments e
    WHERE e.session_id = s.id AND e.status != 'cancelled'
  ) ec ON true
  WHERE s.school_id = p_school_id
    AND s.start_time >= p_start_date
    AND s.start_time <= p_end_date
    AND s.status = 'scheduled'
    AND s.is_deleted = false
  ORDER BY s.start_time;
$$;