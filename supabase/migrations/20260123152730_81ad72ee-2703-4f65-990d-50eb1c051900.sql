-- Fix search_path for is_demo_user function
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((SELECT auth.email() = 'demo@aquaflow.app'), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Fix search_path for seed_demo_school function  
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
  i INT;
BEGIN
  SELECT id INTO v_school_id FROM public.schools WHERE slug = 'demo-school';
  IF v_school_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Demo school not found');
  END IF;

  SELECT id INTO v_demo_user_id FROM auth.users WHERE email = 'demo@aquaflow.app';
  IF v_demo_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Demo user not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.locations WHERE school_id = v_school_id) THEN
    RETURN json_build_object('success', true, 'message', 'Already seeded');
  END IF;

  INSERT INTO public.locations (name, address, phone, school_id)
  VALUES ('בריכת גורדון', 'רחוב גורדון 52, תל אביב', '03-5555551', v_school_id)
  RETURNING id INTO v_location1_id;
  
  INSERT INTO public.locations (name, address, phone, school_id)
  VALUES ('קאנטרי דרום', 'שדרות הנשיא 100, באר שבע', '08-5555552', v_school_id)
  RETURNING id INTO v_location2_id;

  INSERT INTO public.resources (name, type, location_id, capacity, school_id)
  VALUES ('בריכה ראשית', 'pool', v_location1_id, 6, v_school_id)
  RETURNING id INTO v_pool1_id;
  
  INSERT INTO public.resources (name, type, location_id, capacity, school_id)
  VALUES ('בריכה אולימפית', 'pool', v_location2_id, 8, v_school_id)
  RETURNING id INTO v_pool2_id;

  INSERT INTO public.class_levels (name, description, min_age, max_age, sort_order, school_id)
  VALUES ('מתחילים', 'שחייה למתחילים', 4, 12, 1, v_school_id)
  RETURNING id INTO v_class_level_id;

  INSERT INTO public.class_types (name, description, duration_min, max_participants, level_id, school_id)
  VALUES ('שיעור קבוצתי', 'שיעור שחייה קבוצתי', 45, 8, v_class_level_id, v_school_id)
  RETURNING id INTO v_class_type_id;

  INSERT INTO public.terms (name, start_date, end_date, active, school_id)
  VALUES ('סמסטר א 2026', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '120 days', true, v_school_id)
  RETURNING id INTO v_term_id;

  INSERT INTO public.products (name, description, type, price, credits_amount, duration_days, active, school_id)
  VALUES 
    ('מנוי חודשי', 'מנוי חודשי ללא הגבלת שיעורים', 'subscription', 450, NULL, 30, true, v_school_id),
    ('כרטיסייה 10 שיעורים', 'כרטיסייה ל-10 שיעורים', 'punch_card', 350, 10, 90, true, v_school_id),
    ('שיעור ניסיון', 'שיעור ניסיון חינם', 'trial', 0, 1, 7, true, v_school_id),
    ('שיעור בודד', 'שיעור שחייה בודד', 'single_session', 50, 1, NULL, true, v_school_id);

  RETURN json_build_object('success', true, 'school_id', v_school_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;