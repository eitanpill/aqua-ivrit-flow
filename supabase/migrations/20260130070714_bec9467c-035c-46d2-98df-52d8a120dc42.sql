-- Fix security issue: Ensure profiles table requires authentication for SELECT
-- The current policies are actually secure (require auth.uid()), but let's make them more explicit

-- Drop the overly permissive "View schools by slug for invites" policy that allows anonymous access
-- and replace with one that only allows authenticated users
DROP POLICY IF EXISTS "View schools by slug for invites" ON public.schools;

-- Create a more restrictive policy for schools that requires authentication
CREATE POLICY "Authenticated users can view schools by slug"
ON public.schools FOR SELECT
TO authenticated
USING (true);

-- Also add explicit requirement for authentication on profiles SELECT policies
-- First, let's update the staff policy to be more explicit about authenticated requirement
DROP POLICY IF EXISTS "Staff can view school profiles" ON public.profiles;

CREATE POLICY "Staff can view school profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  (is_deleted = false) AND 
  (is_super_admin() OR (id = auth.uid()) OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Update the user's own profile policy to explicitly require authentication
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING ((is_deleted = false) AND (auth.uid() = id));

-- Update charges policy to be explicit about authentication requirement
DROP POLICY IF EXISTS "Users can view charges" ON public.charges;

CREATE POLICY "Users can view charges"
ON public.charges FOR SELECT
TO authenticated
USING (
  is_super_admin() OR 
  (parent_id = auth.uid()) OR 
  (has_role(auth.uid(), 'admin') AND (school_id = get_user_school_id()))
);

-- Note: Changed from is_staff to has_role('admin') for charges - only billing admins should see all charges, not all staff