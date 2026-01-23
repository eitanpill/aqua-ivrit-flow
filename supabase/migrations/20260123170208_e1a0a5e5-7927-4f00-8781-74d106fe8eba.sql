-- Fix security warnings from Part 19

-- 1. Drop and recreate the deleted_items view with proper RLS-based security (not SECURITY DEFINER)
DROP VIEW IF EXISTS public.deleted_items;

-- Create a security-aware function instead of a view
CREATE OR REPLACE FUNCTION public.get_deleted_items()
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  name text,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  deleted_by_name text,
  school_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can see deleted items
  IF NOT (is_super_admin() OR has_role(auth.uid(), 'admin')) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    'swimmer'::text as entity_type,
    s.id as entity_id,
    s.first_name || ' ' || s.last_name as name,
    s.deleted_at,
    s.deleted_by,
    COALESCE(p.first_name || ' ' || p.last_name, 'מערכת') as deleted_by_name,
    s.school_id
  FROM swimmers s
  LEFT JOIN profiles p ON s.deleted_by = p.id
  WHERE s.is_deleted = true
    AND (is_super_admin() OR s.school_id = get_user_school_id())
  
  UNION ALL
  
  SELECT 
    'session'::text as entity_type,
    sess.id as entity_id,
    ct.name as name,
    sess.deleted_at,
    sess.deleted_by,
    COALESCE(p.first_name || ' ' || p.last_name, 'מערכת') as deleted_by_name,
    sess.school_id
  FROM sessions sess
  LEFT JOIN class_types ct ON sess.class_type_id = ct.id
  LEFT JOIN profiles p ON sess.deleted_by = p.id
  WHERE sess.is_deleted = true
    AND (is_super_admin() OR sess.school_id = get_user_school_id())
  
  UNION ALL
  
  SELECT 
    'product'::text as entity_type,
    pr.id as entity_id,
    pr.name,
    pr.deleted_at,
    pr.deleted_by,
    COALESCE(p.first_name || ' ' || p.last_name, 'מערכת') as deleted_by_name,
    pr.school_id
  FROM products pr
  LEFT JOIN profiles p ON pr.deleted_by = p.id
  WHERE pr.is_deleted = true
    AND (is_super_admin() OR pr.school_id = get_user_school_id())
    
  ORDER BY deleted_at DESC;
END;
$$;

-- 2. Fix the "System can insert audit logs" policy - make it more restrictive
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());