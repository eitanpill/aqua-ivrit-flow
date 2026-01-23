
-- =====================================================
-- FIX SECURITY WARNINGS - Drop policies first
-- =====================================================

-- 1. Drop dependent policy first
DROP POLICY IF EXISTS "Users can view their school" ON public.schools;

-- 2. Now recreate the function with proper search_path
DROP FUNCTION IF EXISTS public.get_user_school_id();
CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 3. Recreate the policy
CREATE POLICY "Users can view their school"
ON public.schools FOR SELECT
TO authenticated
USING (id = get_user_school_id());

-- 4. Fix permissive INSERT policy on schools
DROP POLICY IF EXISTS "Admins can create schools" ON public.schools;
DROP POLICY IF EXISTS "Public can view schools by slug" ON public.schools;

-- Create proper restrictive policies for INSERT
CREATE POLICY "Admins can create schools"
ON public.schools FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') AND owner_id = auth.uid()
);

-- Users without a school can create one (for onboarding)
CREATE POLICY "New users can create their school"
ON public.schools FOR INSERT
TO authenticated
WITH CHECK (
  get_user_school_id() IS NULL AND owner_id = auth.uid()
);

-- View schools by slug for invite verification (SELECT with true is acceptable)
CREATE POLICY "View schools by slug for invites"
ON public.schools FOR SELECT
TO authenticated
USING (true);
