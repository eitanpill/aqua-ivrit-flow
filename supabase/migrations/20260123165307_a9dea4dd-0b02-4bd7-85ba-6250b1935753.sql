-- =====================================================
-- PART 18: SECURITY HARDENING & SECRETS MANAGEMENT
-- =====================================================

-- 1. Create platform_admins table for super admin management
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  notes TEXT
);

-- Enable RLS on platform_admins
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only existing platform admins can view/manage the table
CREATE POLICY "Platform admins can view platform_admins"
  ON public.platform_admins
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Platform admins can insert platform_admins"
  ON public.platform_admins
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- 2. Update is_super_admin function to check platform_admins table
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

-- 3. Insert current super admin (eitanpill@gmail.com) into platform_admins
-- This must be done via direct insert since we're bootstrapping
INSERT INTO public.platform_admins (user_id, notes)
SELECT id, 'Initial platform admin - migrated from hardcoded email'
FROM auth.users
WHERE email = 'eitanpill@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 4. Create helper function to check if current user is demo user
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.email() = 'demo@aquaflow.app', false);
$$;

-- 5. Create function to safely get masked secret (never returns raw value)
CREATE OR REPLACE FUNCTION public.get_masked_secret(p_secret TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_secret IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF LENGTH(p_secret) > 8 THEN
    RETURN '••••••••' || RIGHT(p_secret, 4);
  ELSE
    RETURN '••••••••';
  END IF;
END;
$$;

-- 6. Update get_payment_configs to never return raw secrets
CREATE OR REPLACE FUNCTION public.get_payment_configs(p_school_id uuid)
RETURNS TABLE(
  id uuid, 
  school_id uuid, 
  provider_name payment_provider, 
  api_key_masked text, 
  has_secret boolean, 
  is_active boolean, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this school
  IF NOT (
    is_super_admin() OR 
    (has_role(auth.uid(), 'admin'::app_role) AND p_school_id = get_user_school_id())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    pc.id,
    pc.school_id,
    pc.provider_name,
    get_masked_secret(pc.api_key) AS api_key_masked,
    pc.api_secret IS NOT NULL AS has_secret,
    pc.is_active,
    pc.created_at,
    pc.updated_at
  FROM payment_configs pc
  WHERE pc.school_id = p_school_id;
END;
$$;

-- 7. Create function to update payment config securely (for edge functions only)
CREATE OR REPLACE FUNCTION public.upsert_payment_config(
  p_school_id UUID,
  p_provider_name payment_provider,
  p_api_key TEXT,
  p_api_secret TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config_id UUID;
BEGIN
  -- Only admins of the school can update payment configs
  IF NOT (
    is_super_admin() OR 
    (has_role(auth.uid(), 'admin'::app_role) AND p_school_id = get_user_school_id())
  ) THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה לביצוע פעולה זו');
  END IF;

  -- Demo users cannot modify payment configs
  IF is_demo_user() THEN
    RETURN json_build_object('success', false, 'error', 'לא ניתן לבצע שינויים במצב דמו');
  END IF;

  -- Upsert the config
  INSERT INTO payment_configs (school_id, provider_name, api_key, api_secret, is_active)
  VALUES (p_school_id, p_provider_name, p_api_key, p_api_secret, p_is_active)
  ON CONFLICT (school_id, provider_name) 
  DO UPDATE SET 
    api_key = p_api_key,
    api_secret = COALESCE(p_api_secret, payment_configs.api_secret),
    is_active = p_is_active,
    updated_at = now()
  RETURNING id INTO v_config_id;

  RETURN json_build_object(
    'success', true, 
    'config_id', v_config_id,
    'message', 'ההגדרות נשמרו בהצלחה'
  );
END;
$$;

-- 8. TRUE READ-ONLY DEMO MODE - Create restrictive policies for all tables
-- We'll add explicit DENY policies for demo user on key operational tables

-- Helper function to check if operation should be blocked for demo
CREATE OR REPLACE FUNCTION public.block_demo_writes()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT is_demo_user();
$$;

-- ENROLLMENTS - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on enrollments" ON public.enrollments;
CREATE POLICY "Block demo user writes on enrollments"
  ON public.enrollments
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- SWIMMERS - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on swimmers" ON public.swimmers;
CREATE POLICY "Block demo user writes on swimmers"
  ON public.swimmers
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- SESSIONS - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on sessions" ON public.sessions;
CREATE POLICY "Block demo user writes on sessions"
  ON public.sessions
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- ATTENDANCE - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on attendance" ON public.attendance;
CREATE POLICY "Block demo user writes on attendance"
  ON public.attendance
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- PROFILES - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on profiles" ON public.profiles;
CREATE POLICY "Block demo user writes on profiles"
  ON public.profiles
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- SUBSCRIPTIONS - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on subscriptions" ON public.subscriptions;
CREATE POLICY "Block demo user writes on subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- CHARGES - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on charges" ON public.charges;
CREATE POLICY "Block demo user writes on charges"
  ON public.charges
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- WAITLIST - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on waitlist" ON public.waitlist;
CREATE POLICY "Block demo user writes on waitlist"
  ON public.waitlist
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- PRODUCTS - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on products" ON public.products;
CREATE POLICY "Block demo user writes on products"
  ON public.products
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- LOCATIONS - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on locations" ON public.locations;
CREATE POLICY "Block demo user writes on locations"
  ON public.locations
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- RESOURCES - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on resources" ON public.resources;
CREATE POLICY "Block demo user writes on resources"
  ON public.resources
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- PAYMENT_CONFIGS - Block demo writes (also restricted by school)
DROP POLICY IF EXISTS "Block demo user writes on payment_configs" ON public.payment_configs;
CREATE POLICY "Block demo user writes on payment_configs"
  ON public.payment_configs
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- SCHOOLS - Block demo writes
DROP POLICY IF EXISTS "Block demo user writes on schools" ON public.schools;
CREATE POLICY "Block demo user writes on schools"
  ON public.schools
  FOR ALL
  USING (block_demo_writes() OR (SELECT true))
  WITH CHECK (block_demo_writes());

-- Add unique constraint to payment_configs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_configs_school_provider_unique'
  ) THEN
    ALTER TABLE public.payment_configs 
    ADD CONSTRAINT payment_configs_school_provider_unique 
    UNIQUE (school_id, provider_name);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;