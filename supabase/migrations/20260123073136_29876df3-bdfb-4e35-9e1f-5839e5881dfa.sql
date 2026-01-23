
-- =====================================================
-- PART 8.2: STRICT RLS & SUPER ADMIN LOGIC
-- =====================================================

-- 1. CREATE SUPER ADMIN CHECK FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.email() = 'eitanpill@gmail.com';
$$;

-- 2. CREATE SCHOOL-AWARE ACCESS FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.user_has_school_access(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    is_super_admin() 
    OR 
    (SELECT school_id FROM public.profiles WHERE id = auth.uid()) = p_school_id;
$$;

-- 3. UPDATE LOCATIONS RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view locations" ON public.locations;
DROP POLICY IF EXISTS "Staff can manage locations" ON public.locations;

CREATE POLICY "Users can view their school locations"
ON public.locations FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert locations"
ON public.locations FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin() 
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Staff can update locations"
ON public.locations FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete locations"
ON public.locations FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 4. UPDATE RESOURCES RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view resources" ON public.resources;
DROP POLICY IF EXISTS "Staff can manage resources" ON public.resources;

CREATE POLICY "Users can view their school resources"
ON public.resources FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert resources"
ON public.resources FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update resources"
ON public.resources FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete resources"
ON public.resources FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 5. UPDATE SWIMMERS RLS
-- =====================================================
DROP POLICY IF EXISTS "Parents can manage their own swimmers" ON public.swimmers;
DROP POLICY IF EXISTS "Parents can view their own swimmers" ON public.swimmers;
DROP POLICY IF EXISTS "Staff can manage all swimmers" ON public.swimmers;
DROP POLICY IF EXISTS "Staff can view all swimmers" ON public.swimmers;

CREATE POLICY "Users can view swimmers in their school"
ON public.swimmers FOR SELECT TO authenticated
USING (
  is_super_admin() 
  OR parent_id = auth.uid() 
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Parents can insert their swimmers"
ON public.swimmers FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (parent_id = auth.uid() AND school_id = get_user_school_id())
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Users can update swimmers"
ON public.swimmers FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR parent_id = auth.uid()
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
)
WITH CHECK (
  is_super_admin()
  OR parent_id = auth.uid()
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Users can delete swimmers"
ON public.swimmers FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR parent_id = auth.uid()
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

-- 6. UPDATE SESSIONS RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view sessions" ON public.sessions;
DROP POLICY IF EXISTS "Staff can manage sessions" ON public.sessions;

CREATE POLICY "Users can view their school sessions"
ON public.sessions FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert sessions"
ON public.sessions FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update sessions"
ON public.sessions FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete sessions"
ON public.sessions FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 7. UPDATE ENROLLMENTS RLS
-- =====================================================
DROP POLICY IF EXISTS "Parents can cancel their enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Parents can create enrollments for their swimmers" ON public.enrollments;
DROP POLICY IF EXISTS "Parents can view enrollments for their swimmers" ON public.enrollments;
DROP POLICY IF EXISTS "Staff can manage all enrollments" ON public.enrollments;

CREATE POLICY "Users can view enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR swimmer_id IN (SELECT id FROM swimmers WHERE parent_id = auth.uid())
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Users can insert enrollments"
ON public.enrollments FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (swimmer_id IN (SELECT id FROM swimmers WHERE parent_id = auth.uid()) AND school_id = get_user_school_id())
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Users can update enrollments"
ON public.enrollments FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR swimmer_id IN (SELECT id FROM swimmers WHERE parent_id = auth.uid())
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Staff can delete enrollments"
ON public.enrollments FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 8. UPDATE PRODUCTS RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view active products" ON public.products;
DROP POLICY IF EXISTS "Staff can manage products" ON public.products;

CREATE POLICY "Users can view their school products"
ON public.products FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update products"
ON public.products FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete products"
ON public.products FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 9. UPDATE SEASONS RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view seasons" ON public.seasons;
DROP POLICY IF EXISTS "Staff can manage seasons" ON public.seasons;

CREATE POLICY "Users can view their school seasons"
ON public.seasons FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert seasons"
ON public.seasons FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update seasons"
ON public.seasons FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete seasons"
ON public.seasons FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 10. UPDATE COACH_RATES RLS
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage coach rates" ON public.coach_rates;
DROP POLICY IF EXISTS "Coaches can view own rates" ON public.coach_rates;

CREATE POLICY "Users can view coach rates"
ON public.coach_rates FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR coach_id = auth.uid()
  OR (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id())
);

CREATE POLICY "Admins can insert coach rates"
ON public.coach_rates FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id()));

CREATE POLICY "Admins can update coach rates"
ON public.coach_rates FOR UPDATE TO authenticated
USING (is_super_admin() OR (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id()));

CREATE POLICY "Admins can delete coach rates"
ON public.coach_rates FOR DELETE TO authenticated
USING (is_super_admin() OR (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id()));

-- 11. UPDATE SKILLS RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view skills" ON public.skills;
DROP POLICY IF EXISTS "Staff can manage skills" ON public.skills;

CREATE POLICY "Users can view their school skills"
ON public.skills FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert skills"
ON public.skills FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update skills"
ON public.skills FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete skills"
ON public.skills FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 12. UPDATE WAITLIST RLS
-- =====================================================
DROP POLICY IF EXISTS "Parents can cancel their waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Parents can join waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Parents can view their waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Staff can manage waitlist" ON public.waitlist;

CREATE POLICY "Users can view waitlist"
ON public.waitlist FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR parent_id = auth.uid()
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Users can insert waitlist"
ON public.waitlist FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (parent_id = auth.uid() AND school_id = get_user_school_id())
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Users can update waitlist"
ON public.waitlist FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR parent_id = auth.uid()
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Staff can delete waitlist"
ON public.waitlist FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 13. UPDATE CLASS_LEVELS RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view class levels" ON public.class_levels;
DROP POLICY IF EXISTS "Staff can manage class levels" ON public.class_levels;

CREATE POLICY "Users can view their school class levels"
ON public.class_levels FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert class levels"
ON public.class_levels FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update class levels"
ON public.class_levels FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete class levels"
ON public.class_levels FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 14. UPDATE CLASS_TYPES RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view class types" ON public.class_types;
DROP POLICY IF EXISTS "Staff can manage class types" ON public.class_types;

CREATE POLICY "Users can view their school class types"
ON public.class_types FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert class types"
ON public.class_types FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update class types"
ON public.class_types FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete class types"
ON public.class_types FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 15. UPDATE TERMS RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view terms" ON public.terms;
DROP POLICY IF EXISTS "Staff can manage terms" ON public.terms;

CREATE POLICY "Users can view their school terms"
ON public.terms FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert terms"
ON public.terms FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update terms"
ON public.terms FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete terms"
ON public.terms FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 16. UPDATE SCHEDULE_SERIES RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view schedule series" ON public.schedule_series;
DROP POLICY IF EXISTS "Staff can manage schedule series" ON public.schedule_series;

CREATE POLICY "Users can view their school schedule series"
ON public.schedule_series FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert schedule series"
ON public.schedule_series FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update schedule series"
ON public.schedule_series FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete schedule series"
ON public.schedule_series FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 17. UPDATE SCHEDULE_TEMPLATES RLS
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view schedule templates" ON public.schedule_templates;
DROP POLICY IF EXISTS "Staff can manage schedule templates" ON public.schedule_templates;

CREATE POLICY "Users can view their school schedule templates"
ON public.schedule_templates FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert schedule templates"
ON public.schedule_templates FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update schedule templates"
ON public.schedule_templates FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete schedule templates"
ON public.schedule_templates FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 18. UPDATE DISCOUNTS RLS
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active discounts" ON public.discounts;
DROP POLICY IF EXISTS "Staff can manage discounts" ON public.discounts;

CREATE POLICY "Users can view their school discounts"
ON public.discounts FOR SELECT TO authenticated
USING (is_super_admin() OR school_id = get_user_school_id());

CREATE POLICY "Staff can insert discounts"
ON public.discounts FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update discounts"
ON public.discounts FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete discounts"
ON public.discounts FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 19. UPDATE SUBSCRIPTIONS RLS
-- =====================================================
DROP POLICY IF EXISTS "Parents can view their subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Staff can manage all subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR parent_id = auth.uid()
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Staff can insert subscriptions"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete subscriptions"
ON public.subscriptions FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 20. UPDATE CHARGES RLS
-- =====================================================
DROP POLICY IF EXISTS "Parents can view their charges" ON public.charges;
DROP POLICY IF EXISTS "Staff can manage all charges" ON public.charges;

CREATE POLICY "Users can view charges"
ON public.charges FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR parent_id = auth.uid()
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

CREATE POLICY "Staff can insert charges"
ON public.charges FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can update charges"
ON public.charges FOR UPDATE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()))
WITH CHECK (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

CREATE POLICY "Staff can delete charges"
ON public.charges FOR DELETE TO authenticated
USING (is_super_admin() OR (is_staff(auth.uid()) AND school_id = get_user_school_id()));

-- 21. UPDATE PROFILES RLS FOR SCHOOL ISOLATION
-- =====================================================
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;

CREATE POLICY "Staff can view school profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR id = auth.uid()
  OR (is_staff(auth.uid()) AND school_id = get_user_school_id())
);

-- 22. SUPER ADMIN CAN UPDATE ANY SCHOOL
-- =====================================================
DROP POLICY IF EXISTS "Owners can update their school" ON public.schools;

CREATE POLICY "Owners and super admin can update schools"
ON public.schools FOR UPDATE TO authenticated
USING (is_super_admin() OR owner_id = auth.uid())
WITH CHECK (is_super_admin() OR owner_id = auth.uid());

-- Super admin can delete schools
CREATE POLICY "Super admin can delete schools"
ON public.schools FOR DELETE TO authenticated
USING (is_super_admin());
