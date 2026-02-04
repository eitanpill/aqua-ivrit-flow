-- =============================================================
-- FIX 1: Restrict profiles table SELECT to protect PII
-- Users should only see their own profile, unless they are staff
-- Staff need to see profiles for their school to manage users
-- =============================================================

-- Drop existing SELECT policy on profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create new more restrictive SELECT policy
-- - Users can see their own profile
-- - Staff can see all profiles in their school (needed for admin functions)
-- - Super admins can see all profiles
CREATE POLICY "Users can view own profile, staff can view school profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (is_deleted = false) AND (
    -- Users can always see their own profile
    id = auth.uid()
    -- Staff can see profiles in their school for management purposes
    OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
    -- Super admins can see all profiles
    OR is_super_admin()
  )
);

-- =============================================================
-- FIX 2: Ensure payment_configs is completely blocked from SELECT
-- The existing policy is PERMISSIVE - change it to RESTRICTIVE
-- =============================================================

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Block all direct SELECT on payment_configs" ON public.payment_configs;

-- Create a RESTRICTIVE policy that blocks all direct SELECT access
-- This ensures NO ONE can read the table directly, even service role needs RPC
CREATE POLICY "Block all direct SELECT on payment_configs"
ON public.payment_configs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (false);

-- Also block anonymous access explicitly
CREATE POLICY "Block anonymous SELECT on payment_configs"
ON public.payment_configs
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- Ensure the table has RLS enabled (should already be, but confirm)
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner (extra security layer)
ALTER TABLE public.payment_configs FORCE ROW LEVEL SECURITY;