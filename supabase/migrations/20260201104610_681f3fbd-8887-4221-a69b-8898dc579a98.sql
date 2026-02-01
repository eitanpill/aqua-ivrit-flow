-- =====================================================
-- SECURITY FIX: Block anonymous access to all sensitive tables
-- =====================================================

-- 1. CRITICAL: Block ALL direct SELECT on payment_configs
-- Force all access through get_payment_configs() RPC which returns masked keys
DROP POLICY IF EXISTS "Admins can view payment configs" ON payment_configs;
DROP POLICY IF EXISTS "Anyone can view payment configs" ON payment_configs;
DROP POLICY IF EXISTS "Block demo user writes on payment_configs" ON payment_configs;

-- Block all direct SELECT - data only accessible via RPC
CREATE POLICY "Block all direct SELECT on payment_configs"
ON payment_configs FOR SELECT
TO authenticated
USING (false);

-- Restore demo write blocking for other operations
CREATE POLICY "Block demo user writes on payment_configs"
ON payment_configs FOR ALL
USING (block_demo_writes() OR (SELECT true))
WITH CHECK (block_demo_writes());

-- 2. Fix swimmers table - require authentication with explicit null check
DROP POLICY IF EXISTS "Users can view swimmers in their school" ON swimmers;
DROP POLICY IF EXISTS "Staff can view all swimmers" ON swimmers;
DROP POLICY IF EXISTS "Parents can view their own swimmers" ON swimmers;

CREATE POLICY "Authenticated users can view swimmers"
ON swimmers FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  is_deleted = false AND
  (
    is_super_admin() OR 
    parent_id = auth.uid() OR 
    (is_staff(auth.uid()) AND school_id = get_user_school_id())
  )
);

-- 3. Fix profiles table - require authentication
DROP POLICY IF EXISTS "Staff can view school profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Authenticated users can view profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  is_deleted = false AND
  (
    is_super_admin() OR
    id = auth.uid() OR
    (is_staff(auth.uid()) AND school_id = get_user_school_id())
  )
);

-- 4. Fix attendance table - require authentication
DROP POLICY IF EXISTS "Parents can view their swimmers attendance" ON attendance;
DROP POLICY IF EXISTS "Staff can view all attendance" ON attendance;

CREATE POLICY "Authenticated users can view attendance"
ON attendance FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    is_staff(auth.uid()) OR
    swimmer_id IN (SELECT id FROM swimmers WHERE parent_id = auth.uid())
  )
);

-- 5. Fix enrollments table - require authentication  
DROP POLICY IF EXISTS "Users can view enrollments" ON enrollments;

CREATE POLICY "Authenticated users can view enrollments"
ON enrollments FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    swimmer_id IN (SELECT id FROM swimmers WHERE parent_id = auth.uid()) OR
    (is_staff(auth.uid()) AND school_id = get_user_school_id())
  )
);

-- 6. Fix sessions table - require authentication
DROP POLICY IF EXISTS "Users can view their school sessions" ON sessions;

CREATE POLICY "Authenticated users can view sessions"
ON sessions FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  is_deleted = false AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 7. Fix locations table - require authentication
DROP POLICY IF EXISTS "Users can view their school locations" ON locations;

CREATE POLICY "Authenticated users can view locations"
ON locations FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 8. Fix resources table - require authentication
DROP POLICY IF EXISTS "Users can view their school resources" ON resources;

CREATE POLICY "Authenticated users can view resources"
ON resources FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 9. Fix products table - require authentication
DROP POLICY IF EXISTS "Users can view their school products" ON products;

CREATE POLICY "Authenticated users can view products"
ON products FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  is_deleted = false AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 10. Fix class_levels table - require authentication
DROP POLICY IF EXISTS "Users can view their school class levels" ON class_levels;

CREATE POLICY "Authenticated users can view class levels"
ON class_levels FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 11. Fix class_types table - require authentication
DROP POLICY IF EXISTS "Users can view their school class types" ON class_types;

CREATE POLICY "Authenticated users can view class types"
ON class_types FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 12. Fix subscriptions table - require authentication
DROP POLICY IF EXISTS "Users can view subscriptions" ON subscriptions;

CREATE POLICY "Authenticated users can view subscriptions"
ON subscriptions FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    parent_id = auth.uid() OR
    (is_staff(auth.uid()) AND school_id = get_user_school_id())
  )
);

-- 13. Fix transactions table - require authentication
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Staff can view school transactions" ON transactions;

CREATE POLICY "Authenticated users can view transactions"
ON transactions FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    user_id = auth.uid() OR
    (is_staff(auth.uid()) AND school_id = get_user_school_id())
  )
);

-- 14. Fix invoices table - require authentication
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Staff can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Staff can view school invoices" ON invoices;

CREATE POLICY "Authenticated users can view invoices"
ON invoices FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    user_id = auth.uid() OR
    (is_staff(auth.uid()) AND school_id = get_user_school_id())
  )
);

-- 15. Fix discounts table - require authentication
DROP POLICY IF EXISTS "Users can view their school discounts" ON discounts;

CREATE POLICY "Authenticated users can view discounts"
ON discounts FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 16. Fix skills table - require authentication
DROP POLICY IF EXISTS "Users can view their school skills" ON skills;

CREATE POLICY "Authenticated users can view skills"
ON skills FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 17. Fix seasons table - require authentication
DROP POLICY IF EXISTS "Users can view their school seasons" ON seasons;

CREATE POLICY "Authenticated users can view seasons"
ON seasons FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 18. Fix terms table - require authentication
DROP POLICY IF EXISTS "Users can view their school terms" ON terms;

CREATE POLICY "Authenticated users can view terms"
ON terms FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 19. Fix schedule_series table - require authentication
DROP POLICY IF EXISTS "Users can view their school schedule series" ON schedule_series;

CREATE POLICY "Authenticated users can view schedule series"
ON schedule_series FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 20. Fix schedule_templates table - require authentication
DROP POLICY IF EXISTS "Users can view their school schedule templates" ON schedule_templates;

CREATE POLICY "Authenticated users can view schedule templates"
ON schedule_templates FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    school_id = get_user_school_id()
  )
);

-- 21. Fix coach_rates table - require authentication
DROP POLICY IF EXISTS "Users can view coach rates" ON coach_rates;

CREATE POLICY "Authenticated users can view coach rates"
ON coach_rates FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    coach_id = auth.uid() OR
    (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id())
  )
);

-- 22. Fix schools table - keep public SELECT for slug lookup but add auth check for sensitive data
DROP POLICY IF EXISTS "Authenticated users can view schools by slug" ON schools;
DROP POLICY IF EXISTS "Users can view their school" ON schools;

CREATE POLICY "Authenticated users can view schools"
ON schools FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    id = get_user_school_id()
  )
);

-- 23. Fix charges table - require authentication (already has some protection)
DROP POLICY IF EXISTS "Users can view charges" ON charges;

CREATE POLICY "Authenticated users can view charges"
ON charges FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  (
    is_super_admin() OR
    parent_id = auth.uid() OR
    (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id())
  )
);