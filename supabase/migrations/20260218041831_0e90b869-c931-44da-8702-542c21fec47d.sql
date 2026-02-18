
-- Fix get_family_debts to filter by school_id
CREATE OR REPLACE FUNCTION get_family_debts()
RETURNS TABLE (
  parent_id UUID,
  parent_name TEXT,
  parent_email TEXT,
  total_pending NUMERIC,
  oldest_due_date DATE,
  pending_charges_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  v_school_id := get_user_school_id();
  
  RETURN QUERY
  SELECT 
    c.parent_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'לא ידוע') as parent_name,
    COALESCE(u.email, '') as parent_email,
    SUM(c.final_amount) as total_pending,
    MIN(c.due_date) as oldest_due_date,
    COUNT(*) as pending_charges_count
  FROM public.charges c
  LEFT JOIN public.profiles p ON c.parent_id = p.id
  LEFT JOIN auth.users u ON c.parent_id = u.id
  WHERE c.status IN ('pending', 'failed')
    AND c.school_id = v_school_id
  GROUP BY c.parent_id, p.first_name, p.last_name, u.email
  HAVING SUM(c.final_amount) > 0
  ORDER BY total_pending DESC;
END;
$$;
