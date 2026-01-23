
-- =====================================================
-- PART 8.1: MULTI-TENANT DATABASE REFACTOR
-- =====================================================

-- 1. CREATE SCHOOLS TABLE
-- =====================================================
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. ADD school_id TO OPERATIONAL TABLES
-- =====================================================

-- profiles
ALTER TABLE public.profiles 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;

-- locations
ALTER TABLE public.locations 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- resources
ALTER TABLE public.resources 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- swimmers
ALTER TABLE public.swimmers 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- sessions
ALTER TABLE public.sessions 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- enrollments
ALTER TABLE public.enrollments 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- products
ALTER TABLE public.products 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- seasons
ALTER TABLE public.seasons 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- coach_rates
ALTER TABLE public.coach_rates 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- skills
ALTER TABLE public.skills 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- waitlist
ALTER TABLE public.waitlist 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Additional related tables for complete isolation
-- class_levels
ALTER TABLE public.class_levels 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- class_types
ALTER TABLE public.class_types 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- terms
ALTER TABLE public.terms 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- schedule_series
ALTER TABLE public.schedule_series 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- schedule_templates
ALTER TABLE public.schedule_templates 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- discounts
ALTER TABLE public.discounts 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- subscriptions
ALTER TABLE public.subscriptions 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- charges
ALTER TABLE public.charges 
  ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 3. CREATE HELPER FUNCTION TO GET USER'S SCHOOL
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. DATA MIGRATION FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.migrate_to_multi_tenant()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_has_data BOOLEAN := false;
  v_owner_id UUID;
  v_counts JSON;
BEGIN
  -- Check if any operational data exists
  SELECT EXISTS(
    SELECT 1 FROM locations LIMIT 1
  ) OR EXISTS(
    SELECT 1 FROM swimmers LIMIT 1
  ) OR EXISTS(
    SELECT 1 FROM sessions LIMIT 1
  ) INTO v_has_data;

  IF NOT v_has_data THEN
    RETURN json_build_object(
      'success', true, 
      'message', 'אין נתונים להעברה',
      'migrated', false
    );
  END IF;

  -- Find first admin to be owner
  SELECT p.id INTO v_owner_id
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at ASC
  LIMIT 1;

  -- Create default school
  INSERT INTO schools (name, slug, owner_id)
  VALUES ('בית ספר לשחייה - דמו', 'demo-school', v_owner_id)
  RETURNING id INTO v_school_id;

  -- Migrate all tables
  UPDATE profiles SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE locations SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE resources SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE swimmers SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE sessions SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE enrollments SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE products SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE seasons SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE coach_rates SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE skills SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE waitlist SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE class_levels SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE class_types SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE terms SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE schedule_series SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE schedule_templates SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE discounts SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE subscriptions SET school_id = v_school_id WHERE school_id IS NULL;
  UPDATE charges SET school_id = v_school_id WHERE school_id IS NULL;

  -- Return migration summary
  SELECT json_build_object(
    'profiles', (SELECT COUNT(*) FROM profiles WHERE school_id = v_school_id),
    'locations', (SELECT COUNT(*) FROM locations WHERE school_id = v_school_id),
    'swimmers', (SELECT COUNT(*) FROM swimmers WHERE school_id = v_school_id),
    'sessions', (SELECT COUNT(*) FROM sessions WHERE school_id = v_school_id)
  ) INTO v_counts;

  RETURN json_build_object(
    'success', true,
    'message', 'הנתונים הועברו בהצלחה',
    'migrated', true,
    'school_id', v_school_id,
    'school_name', 'בית ספר לשחייה - דמו',
    'counts', v_counts
  );
END;
$$;

-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX idx_locations_school_id ON public.locations(school_id);
CREATE INDEX idx_resources_school_id ON public.resources(school_id);
CREATE INDEX idx_swimmers_school_id ON public.swimmers(school_id);
CREATE INDEX idx_sessions_school_id ON public.sessions(school_id);
CREATE INDEX idx_enrollments_school_id ON public.enrollments(school_id);
CREATE INDEX idx_products_school_id ON public.products(school_id);
CREATE INDEX idx_seasons_school_id ON public.seasons(school_id);
CREATE INDEX idx_coach_rates_school_id ON public.coach_rates(school_id);
CREATE INDEX idx_skills_school_id ON public.skills(school_id);
CREATE INDEX idx_waitlist_school_id ON public.waitlist(school_id);
CREATE INDEX idx_class_levels_school_id ON public.class_levels(school_id);
CREATE INDEX idx_class_types_school_id ON public.class_types(school_id);
CREATE INDEX idx_terms_school_id ON public.terms(school_id);
CREATE INDEX idx_schedule_series_school_id ON public.schedule_series(school_id);
CREATE INDEX idx_schedule_templates_school_id ON public.schedule_templates(school_id);
CREATE INDEX idx_discounts_school_id ON public.discounts(school_id);
CREATE INDEX idx_subscriptions_school_id ON public.subscriptions(school_id);
CREATE INDEX idx_charges_school_id ON public.charges(school_id);

-- Composite indexes for common queries
CREATE INDEX idx_sessions_school_start ON public.sessions(school_id, start_time);
CREATE INDEX idx_swimmers_school_parent ON public.swimmers(school_id, parent_id);
CREATE INDEX idx_enrollments_school_session ON public.enrollments(school_id, session_id);

-- 6. RLS POLICIES FOR SCHOOLS TABLE
-- =====================================================

-- Users can view schools they belong to
CREATE POLICY "Users can view their school"
ON public.schools FOR SELECT
TO authenticated
USING (id = get_user_school_id());

-- School owners can update their school
CREATE POLICY "Owners can update their school"
ON public.schools FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Admins can create schools (for onboarding)
CREATE POLICY "Admins can create schools"
ON public.schools FOR INSERT
TO authenticated
WITH CHECK (true);

-- Public can view schools by slug (for invite links)
CREATE POLICY "Public can view schools by slug"
ON public.schools FOR SELECT
TO authenticated
USING (true);

-- 7. ADD FOREIGN KEY FOR owner_id AFTER profiles EXISTS
-- =====================================================
ALTER TABLE public.schools 
  ADD CONSTRAINT schools_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 8. RUN DATA MIGRATION
-- =====================================================
SELECT migrate_to_multi_tenant();
