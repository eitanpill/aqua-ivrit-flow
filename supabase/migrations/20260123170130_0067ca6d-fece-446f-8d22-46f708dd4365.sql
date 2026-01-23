-- PART 19: DATA INTEGRITY & OBSERVABILITY

-- ===========================================
-- 1. DB-LEVEL CONFLICT DETECTION ("Iron Dome")
-- ===========================================

-- Create function to prevent overlapping sessions
CREATE OR REPLACE FUNCTION public.prevent_overlap_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_new_range tstzrange;
  v_conflicting_session_id uuid;
  v_conflict_type text;
BEGIN
  -- Skip check for cancelled sessions
  IF NEW.is_cancelled = true THEN
    RETURN NEW;
  END IF;
  
  -- Create time range for the new/updated session
  v_new_range := tstzrange(NEW.start_time, NEW.end_time, '[)');
  
  -- Check for coach conflicts (if coach is assigned)
  IF NEW.coach_id IS NOT NULL THEN
    SELECT id INTO v_conflicting_session_id
    FROM sessions
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND coach_id = NEW.coach_id
      AND is_cancelled = false
      AND school_id = NEW.school_id
      AND tstzrange(start_time, end_time, '[)') && v_new_range
    LIMIT 1;
    
    IF v_conflicting_session_id IS NOT NULL THEN
      RAISE EXCEPTION 'CONFLICT:COACH:המאמן כבר משובץ לשיעור אחר בזמן זה'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  
  -- Check for resource (pool/lane) conflicts (if resource is assigned)
  IF NEW.resource_id IS NOT NULL THEN
    SELECT id INTO v_conflicting_session_id
    FROM sessions
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND resource_id = NEW.resource_id
      AND is_cancelled = false
      AND school_id = NEW.school_id
      AND tstzrange(start_time, end_time, '[)') && v_new_range
    LIMIT 1;
    
    IF v_conflicting_session_id IS NOT NULL THEN
      RAISE EXCEPTION 'CONFLICT:RESOURCE:המשאב (בריכה/מסלול) כבר תפוס בזמן זה'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for overlap prevention
DROP TRIGGER IF EXISTS trigger_prevent_overlap_booking ON sessions;
CREATE TRIGGER trigger_prevent_overlap_booking
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_overlap_booking();

-- ===========================================
-- 2. AUDIT LOGS SYSTEM
-- ===========================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text,
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    is_super_admin() OR 
    (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id())
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Function to log audit events (callable from frontend)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_entity_name text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_user_name text;
  v_school_id uuid;
BEGIN
  -- Get user info
  SELECT 
    COALESCE(first_name || ' ' || last_name, 'Unknown'),
    school_id
  INTO v_user_name, v_school_id
  FROM profiles
  WHERE id = auth.uid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    school_id,
    user_id,
    user_name,
    action,
    entity_type,
    entity_id,
    entity_name,
    details
  ) VALUES (
    v_school_id,
    auth.uid(),
    v_user_name,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ===========================================
-- 3. SOFT DELETES
-- ===========================================

-- Add soft delete columns to swimmers
ALTER TABLE public.swimmers 
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Add soft delete columns to profiles (users)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Add soft delete columns to sessions
ALTER TABLE public.sessions 
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Add soft delete columns to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Create indexes for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_swimmers_is_deleted ON swimmers(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON profiles(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_sessions_is_deleted ON sessions(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted) WHERE is_deleted = false;

-- Function for soft deleting a swimmer with audit
CREATE OR REPLACE FUNCTION public.soft_delete_swimmer(p_swimmer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swimmer record;
BEGIN
  -- Check permissions
  IF NOT (is_super_admin() OR is_staff(auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה למחוק שחיינים');
  END IF;
  
  -- Check demo mode
  IF is_demo_user() THEN
    RETURN json_build_object('success', false, 'error', 'פעולה חסומה במצב הדגמה');
  END IF;
  
  -- Get swimmer info before soft delete
  SELECT * INTO v_swimmer FROM swimmers WHERE id = p_swimmer_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'שחיין לא נמצא');
  END IF;
  
  -- Soft delete
  UPDATE swimmers
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = p_swimmer_id;
  
  -- Log audit
  PERFORM log_audit_event(
    'soft_delete',
    'swimmer',
    p_swimmer_id,
    v_swimmer.first_name || ' ' || v_swimmer.last_name,
    json_build_object('swimmer_data', row_to_json(v_swimmer))
  );
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function for soft deleting a session with audit
CREATE OR REPLACE FUNCTION public.soft_delete_session(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  -- Check permissions
  IF NOT (is_super_admin() OR is_staff(auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה למחוק שיעורים');
  END IF;
  
  -- Check demo mode
  IF is_demo_user() THEN
    RETURN json_build_object('success', false, 'error', 'פעולה חסומה במצב הדגמה');
  END IF;
  
  -- Get session info before soft delete
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'שיעור לא נמצא');
  END IF;
  
  -- Soft delete
  UPDATE sessions
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = p_session_id;
  
  -- Log audit
  PERFORM log_audit_event(
    'soft_delete',
    'session',
    p_session_id,
    NULL,
    json_build_object('session_data', row_to_json(v_session))
  );
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function for soft deleting a product with audit
CREATE OR REPLACE FUNCTION public.soft_delete_product(p_product_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product record;
BEGIN
  -- Check permissions
  IF NOT (is_super_admin() OR has_role(auth.uid(), 'admin')) THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה למחוק מוצרים');
  END IF;
  
  -- Check demo mode
  IF is_demo_user() THEN
    RETURN json_build_object('success', false, 'error', 'פעולה חסומה במצב הדגמה');
  END IF;
  
  -- Get product info before soft delete
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'מוצר לא נמצא');
  END IF;
  
  -- Soft delete
  UPDATE products
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = p_product_id;
  
  -- Log audit
  PERFORM log_audit_event(
    'soft_delete',
    'product',
    p_product_id,
    v_product.name,
    json_build_object('product_data', row_to_json(v_product))
  );
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function to restore soft-deleted entities (admin only)
CREATE OR REPLACE FUNCTION public.restore_deleted_entity(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permissions
  IF NOT (is_super_admin() OR has_role(auth.uid(), 'admin')) THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה לשחזר פריטים');
  END IF;
  
  -- Check demo mode
  IF is_demo_user() THEN
    RETURN json_build_object('success', false, 'error', 'פעולה חסומה במצב הדגמה');
  END IF;
  
  -- Restore based on entity type
  CASE p_entity_type
    WHEN 'swimmer' THEN
      UPDATE swimmers SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
      WHERE id = p_entity_id;
    WHEN 'session' THEN
      UPDATE sessions SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
      WHERE id = p_entity_id;
    WHEN 'product' THEN
      UPDATE products SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
      WHERE id = p_entity_id;
    WHEN 'profile' THEN
      UPDATE profiles SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
      WHERE id = p_entity_id;
    ELSE
      RETURN json_build_object('success', false, 'error', 'סוג פריט לא נתמך');
  END CASE;
  
  -- Log audit
  PERFORM log_audit_event(
    'restore',
    p_entity_type,
    p_entity_id,
    NULL,
    '{}'::jsonb
  );
  
  RETURN json_build_object('success', true);
END;
$$;

-- ===========================================
-- 4. UPDATE RLS POLICIES TO EXCLUDE DELETED
-- ===========================================

-- Update swimmers SELECT policy to exclude deleted
DROP POLICY IF EXISTS "Users can view swimmers in their school" ON swimmers;
CREATE POLICY "Users can view swimmers in their school"
  ON public.swimmers
  FOR SELECT
  USING (
    is_deleted = false AND (
      is_super_admin() OR 
      parent_id = auth.uid() OR 
      (is_staff(auth.uid()) AND school_id = get_user_school_id())
    )
  );

-- Update sessions SELECT policy to exclude deleted
DROP POLICY IF EXISTS "Users can view their school sessions" ON sessions;
CREATE POLICY "Users can view their school sessions"
  ON public.sessions
  FOR SELECT
  USING (
    is_deleted = false AND (
      is_super_admin() OR 
      school_id = get_user_school_id()
    )
  );

-- Update products SELECT policy to exclude deleted
DROP POLICY IF EXISTS "Users can view their school products" ON products;
CREATE POLICY "Users can view their school products"
  ON public.products
  FOR SELECT
  USING (
    is_deleted = false AND (
      is_super_admin() OR 
      school_id = get_user_school_id()
    )
  );

-- Update profiles SELECT policies to exclude deleted
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (
    is_deleted = false AND auth.uid() = id
  );

DROP POLICY IF EXISTS "Staff can view school profiles" ON profiles;
CREATE POLICY "Staff can view school profiles"
  ON public.profiles
  FOR SELECT
  USING (
    is_deleted = false AND (
      is_super_admin() OR 
      id = auth.uid() OR 
      (is_staff(auth.uid()) AND school_id = get_user_school_id())
    )
  );

-- ===========================================
-- 5. HELPER VIEW FOR ADMIN DELETED ITEMS
-- ===========================================

-- Create view for admins to see deleted items
CREATE OR REPLACE VIEW public.deleted_items AS
SELECT 
  'swimmer' as entity_type,
  id as entity_id,
  first_name || ' ' || last_name as name,
  deleted_at,
  deleted_by,
  school_id
FROM swimmers WHERE is_deleted = true
UNION ALL
SELECT 
  'session' as entity_type,
  s.id as entity_id,
  ct.name as name,
  s.deleted_at,
  s.deleted_by,
  s.school_id
FROM sessions s
LEFT JOIN class_types ct ON s.class_type_id = ct.id
WHERE s.is_deleted = true
UNION ALL
SELECT 
  'product' as entity_type,
  id as entity_id,
  name,
  deleted_at,
  deleted_by,
  school_id
FROM products WHERE is_deleted = true;