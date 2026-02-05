-- =============================================================
-- FIX: Remove infinite recursion in platform_admins RLS
-- The current policy queries platform_admins to check access to platform_admins
-- This creates infinite recursion when is_super_admin() is called
-- =============================================================

-- Drop the problematic SELECT policy that causes recursion
DROP POLICY IF EXISTS "Platform admins can view platform_admins" ON public.platform_admins;

-- Create a simpler policy that doesn't cause recursion
-- Users can only see their own record in platform_admins
-- This avoids the recursive call since we just check auth.uid() directly
CREATE POLICY "Users can view own platform_admin record"
ON public.platform_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- The is_super_admin() function is SECURITY DEFINER so it bypasses RLS
-- and can still query the table to check if any user is a super admin