-- Create is_demo_user function
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((SELECT auth.email() = 'demo@aquaflow.app'), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create seed_demo_school function
CREATE OR REPLACE FUNCTION public.seed_demo_school()
RETURNS JSON AS $$
DECLARE
  v_school_id UUID;
  v_demo_user_id UUID;
  v_location1_id UUID;
  v_location2_id UUID;
  v_pool1_id UUID;
  v_pool2_id UUID;
  v_coach1_id UUID;
  v_coach2_id UUID;
  v_coach3_id UUID;
  v_class_type_id UUID;
  v_class_level_id UUID;
  v_term_id UUID;
  v_series_ids UUID[];
  v_session_ids UUID[];
  v_swimmer_ids UUID[];
  i INT;
BEGIN
  -- Check if demo school exists
  SELECT id INTO v_school_id FROM schools WHERE slug = 'demo-school';
  
  IF v_school_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Demo school not found');
  END IF;

  -- Get demo user
  SELECT id INTO v_demo_user_id FROM auth.users WHERE email = 'demo@aquaflow.app';
  
  IF v_demo_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Demo user not found');
  END IF;

  -- Check if already seeded (has locations)
  IF EXISTS (SELECT 1 FROM locations WHERE school_id = v_school_id) THEN
    RETURN json_build_object('success', true, 'message', 'Already seeded');
  END IF;

  -- Create Locations
  INSERT INTO locations (name, address, phone, school_id)
  VALUES ('בריכת גורדון', 'רחוב גורדון 52, תל אביב', '03-5555551', v_school_id)
  RETURNING id INTO v_location1_id;
  
  INSERT INTO locations (name, address, phone, school_id)
  VALUES ('קאנטרי דרום', 'שדרות הנשיא 100, באר שבע', '08-5555552', v_school_id)
  RETURNING id INTO v_location2_id;

  -- Create Resources (Pools)
  INSERT INTO resources (name, type, location_id, capacity, school_id)
  VALUES ('בריכה ראשית', 'pool', v_location1_id, 6, v_school_id)
  RETURNING id INTO v_pool1_id;
  
  INSERT INTO resources (name, type, location_id, capacity, school_id)
  VALUES ('בריכה אולימפית', 'pool', v_location2_id, 8, v_school_id)
  RETURNING id INTO v_pool2_id;

  -- Create Class Level
  INSERT INTO class_levels (name, description, min_age, max_age, sort_order, school_id)
  VALUES ('מתחילים', 'שחייה למתחילים', 4, 12, 1, v_school_id)
  RETURNING id INTO v_class_level_id;

  -- Create Class Type
  INSERT INTO class_types (name, description, duration_min, max_participants, level_id, school_id)
  VALUES ('שיעור קבוצתי', 'שיעור שחייה קבוצתי', 45, 8, v_class_level_id, v_school_id)
  RETURNING id INTO v_class_type_id;

  -- Create Term
  INSERT INTO terms (name, start_date, end_date, active, school_id)
  VALUES ('סמסטר א 2026', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '120 days', true, v_school_id)
  RETURNING id INTO v_term_id;

  -- Create Coach profiles (as demo user's "team")
  INSERT INTO profiles (id, first_name, last_name, phone, role, school_id)
  VALUES 
    (gen_random_uuid(), 'דני', 'כהן', '050-1111111', 'coach', v_school_id),
    (gen_random_uuid(), 'מיכל', 'לוי', '050-2222222', 'coach', v_school_id),
    (gen_random_uuid(), 'עומר', 'גולן', '050-3333333', 'coach', v_school_id)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_coach1_id FROM profiles WHERE first_name = 'דני' AND school_id = v_school_id LIMIT 1;
  SELECT id INTO v_coach2_id FROM profiles WHERE first_name = 'מיכל' AND school_id = v_school_id LIMIT 1;
  SELECT id INTO v_coach3_id FROM profiles WHERE first_name = 'עומר' AND school_id = v_school_id LIMIT 1;

  -- Create Schedule Series (recurring classes)
  INSERT INTO schedule_series (name, day_of_week, start_time, duration_minutes, class_type_id, term_id, resource_id, coach_id, max_participants, school_id)
  VALUES
    ('יום ראשון בוקר', 0, '09:00', 45, v_class_type_id, v_term_id, v_pool1_id, v_coach1_id, 8, v_school_id),
    ('יום ראשון צהריים', 0, '16:00', 45, v_class_type_id, v_term_id, v_pool1_id, v_coach2_id, 8, v_school_id),
    ('יום שני בוקר', 1, '10:00', 45, v_class_type_id, v_term_id, v_pool2_id, v_coach3_id, 8, v_school_id),
    ('יום שלישי צהריים', 2, '17:00', 45, v_class_type_id, v_term_id, v_pool1_id, v_coach1_id, 8, v_school_id),
    ('יום רביעי בוקר', 3, '09:30', 45, v_class_type_id, v_term_id, v_pool2_id, v_coach2_id, 8, v_school_id),
    ('יום חמישי צהריים', 4, '16:30', 45, v_class_type_id, v_term_id, v_pool1_id, v_coach3_id, 8, v_school_id);

  -- Generate sessions for the week
  PERFORM public.generate_sessions_from_series(s.id) 
  FROM schedule_series s WHERE s.school_id = v_school_id;

  -- Create Swimmers (as demo user's children for demo purposes)
  FOR i IN 1..20 LOOP
    INSERT INTO swimmers (
      first_name, 
      last_name, 
      birth_date, 
      gender, 
      parent_id, 
      skill_level,
      school_id
    )
    VALUES (
      CASE (i % 10)
        WHEN 0 THEN 'יובל'
        WHEN 1 THEN 'נועה'
        WHEN 2 THEN 'איתי'
        WHEN 3 THEN 'מאיה'
        WHEN 4 THEN 'עידו'
        WHEN 5 THEN 'תמר'
        WHEN 6 THEN 'אורי'
        WHEN 7 THEN 'ליאור'
        WHEN 8 THEN 'שירה'
        WHEN 9 THEN 'עמית'
      END,
      CASE (i / 10)
        WHEN 0 THEN 'כהן'
        WHEN 1 THEN 'לוי'
        ELSE 'ישראלי'
      END,
      CURRENT_DATE - ((4 + (i % 8)) * INTERVAL '1 year'),
      CASE WHEN i % 2 = 0 THEN 'male' ELSE 'female' END,
      v_demo_user_id,
      CASE (i % 4)
        WHEN 0 THEN 'beginner'
        WHEN 1 THEN 'intermediate'
        WHEN 2 THEN 'advanced'
        ELSE 'beginner'
      END,
      v_school_id
    );
  END LOOP;

  -- Enroll swimmers in sessions
  INSERT INTO enrollments (swimmer_id, session_id, status, type, enrolled_by, school_id)
  SELECT 
    sw.id,
    se.id,
    'confirmed',
    'permanent',
    v_demo_user_id,
    v_school_id
  FROM swimmers sw
  CROSS JOIN LATERAL (
    SELECT id FROM sessions WHERE school_id = v_school_id ORDER BY random() LIMIT 2
  ) se
  WHERE sw.school_id = v_school_id
  ON CONFLICT DO NOTHING;

  -- Create Products
  INSERT INTO products (name, description, type, price, credits_amount, duration_days, active, school_id)
  VALUES 
    ('מנוי חודשי', 'מנוי חודשי ללא הגבלת שיעורים', 'subscription', 450, NULL, 30, true, v_school_id),
    ('כרטיסייה 10 שיעורים', 'כרטיסייה ל-10 שיעורים', 'punch_card', 350, 10, 90, true, v_school_id),
    ('שיעור ניסיון', 'שיעור ניסיון חינם', 'trial', 0, 1, 7, true, v_school_id),
    ('שיעור בודד', 'שיעור שחייה בודד', 'single_session', 50, 1, NULL, true, v_school_id);

  RETURN json_build_object('success', true, 'school_id', v_school_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_demo_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_school() TO authenticated;

-- Update RLS policies to block demo user from modifications
-- We'll add a deny check to key tables

-- Products table - block demo user
DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
CREATE POLICY "Staff can insert products" ON public.products
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can update products" ON public.products;
CREATE POLICY "Staff can update products" ON public.products
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
) WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can delete products" ON public.products;
CREATE POLICY "Staff can delete products" ON public.products
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Swimmers table - block demo user
DROP POLICY IF EXISTS "Parents can insert their swimmers" ON public.swimmers;
CREATE POLICY "Parents can insert their swimmers" ON public.swimmers
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR ((parent_id = auth.uid()) AND (school_id = get_user_school_id())) OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Users can update swimmers" ON public.swimmers;
CREATE POLICY "Users can update swimmers" ON public.swimmers
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (parent_id = auth.uid()) OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
) WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (parent_id = auth.uid()) OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Users can delete swimmers" ON public.swimmers;
CREATE POLICY "Users can delete swimmers" ON public.swimmers
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (parent_id = auth.uid()) OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Sessions table - block demo user
DROP POLICY IF EXISTS "Staff can insert sessions" ON public.sessions;
CREATE POLICY "Staff can insert sessions" ON public.sessions
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can update sessions" ON public.sessions;
CREATE POLICY "Staff can update sessions" ON public.sessions
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
) WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can delete sessions" ON public.sessions;
CREATE POLICY "Staff can delete sessions" ON public.sessions
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Enrollments table - block demo user
DROP POLICY IF EXISTS "Users can insert enrollments" ON public.enrollments;
CREATE POLICY "Users can insert enrollments" ON public.enrollments
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR ((swimmer_id IN (SELECT id FROM swimmers WHERE parent_id = auth.uid())) AND (school_id = get_user_school_id())) OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Users can update enrollments" ON public.enrollments;
CREATE POLICY "Users can update enrollments" ON public.enrollments
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (swimmer_id IN (SELECT id FROM swimmers WHERE parent_id = auth.uid())) OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can delete enrollments" ON public.enrollments;
CREATE POLICY "Staff can delete enrollments" ON public.enrollments
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Locations table - block demo user
DROP POLICY IF EXISTS "Staff can insert locations" ON public.locations;
CREATE POLICY "Staff can insert locations" ON public.locations
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can update locations" ON public.locations;
CREATE POLICY "Staff can update locations" ON public.locations
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
) WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can delete locations" ON public.locations;
CREATE POLICY "Staff can delete locations" ON public.locations
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Class levels - block demo user
DROP POLICY IF EXISTS "Staff can insert class levels" ON public.class_levels;
CREATE POLICY "Staff can insert class levels" ON public.class_levels
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can update class levels" ON public.class_levels;
CREATE POLICY "Staff can update class levels" ON public.class_levels
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
) WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can delete class levels" ON public.class_levels;
CREATE POLICY "Staff can delete class levels" ON public.class_levels
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Class types - block demo user
DROP POLICY IF EXISTS "Staff can insert class types" ON public.class_types;
CREATE POLICY "Staff can insert class types" ON public.class_types
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can update class types" ON public.class_types;
CREATE POLICY "Staff can update class types" ON public.class_types
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
) WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can delete class types" ON public.class_types;
CREATE POLICY "Staff can delete class types" ON public.class_types
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Skills - block demo user
DROP POLICY IF EXISTS "Staff can insert skills" ON public.skills;
CREATE POLICY "Staff can insert skills" ON public.skills
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can update skills" ON public.skills;
CREATE POLICY "Staff can update skills" ON public.skills
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
) WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can delete skills" ON public.skills;
CREATE POLICY "Staff can delete skills" ON public.skills
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

-- Schedule series - block demo user
DROP POLICY IF EXISTS "Staff can insert schedule series" ON public.schedule_series;
CREATE POLICY "Staff can insert schedule series" ON public.schedule_series
FOR INSERT WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can update schedule series" ON public.schedule_series;
CREATE POLICY "Staff can update schedule series" ON public.schedule_series
FOR UPDATE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
) WITH CHECK (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);

DROP POLICY IF EXISTS "Staff can delete schedule series" ON public.schedule_series;
CREATE POLICY "Staff can delete schedule series" ON public.schedule_series
FOR DELETE USING (
  NOT is_demo_user() AND (is_super_admin() OR (is_staff(auth.uid()) AND (school_id = get_user_school_id())))
);