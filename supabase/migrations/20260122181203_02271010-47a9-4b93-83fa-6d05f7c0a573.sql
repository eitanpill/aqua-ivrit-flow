-- Add required_for_graduation to skills table
ALTER TABLE public.skills 
ADD COLUMN IF NOT EXISTS required_for_graduation BOOLEAN DEFAULT false;

-- Create substitutions table for coach shift management
CREATE TABLE public.substitutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  original_coach_id UUID NOT NULL REFERENCES public.profiles(id),
  sub_coach_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'cancelled')),
  reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;

-- RLS policies for substitutions
CREATE POLICY "Staff can view all substitutions"
  ON public.substitutions FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Coaches can request substitutions for their sessions"
  ON public.substitutions FOR INSERT
  TO authenticated
  WITH CHECK (
    original_coach_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Staff can update substitutions"
  ON public.substitutions FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_substitutions_updated_at
  BEFORE UPDATE ON public.substitutions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to approve substitution and update session
CREATE OR REPLACE FUNCTION public.approve_substitution(p_substitution_id UUID, p_sub_coach_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_session_id UUID;
BEGIN
  -- Get substitution
  SELECT * INTO v_sub
  FROM public.substitutions
  WHERE id = p_substitution_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'בקשת החלפה לא נמצאה');
  END IF;
  
  IF v_sub.status != 'requested' THEN
    RETURN json_build_object('success', false, 'error', 'בקשה זו כבר טופלה');
  END IF;
  
  -- Update substitution
  UPDATE public.substitutions
  SET status = 'approved',
      sub_coach_id = p_sub_coach_id,
      responded_at = now()
  WHERE id = p_substitution_id;
  
  -- Update session with new coach
  UPDATE public.sessions
  SET coach_id = p_sub_coach_id
  WHERE id = v_sub.session_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'ההחלפה אושרה והמאמן עודכן בשיעור'
  );
END;
$$;

-- Function to generate end-of-term report for a swimmer
CREATE OR REPLACE FUNCTION public.get_swimmer_report(p_swimmer_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_swimmer RECORD;
  v_skills JSON;
  v_achieved_count INTEGER;
  v_total_skills INTEGER;
  v_required_achieved INTEGER;
  v_required_total INTEGER;
  v_recommendation TEXT;
BEGIN
  -- Get swimmer
  SELECT s.*, cl.name as level_name
  INTO v_swimmer
  FROM public.swimmers s
  LEFT JOIN public.class_levels cl ON s.skill_level::text = cl.name
  WHERE s.id = p_swimmer_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'שחיין לא נמצא');
  END IF;
  
  -- Get all skills with achievement status
  SELECT json_agg(skill_data ORDER BY skill_data.sort_order) INTO v_skills
  FROM (
    SELECT 
      sk.id,
      sk.name,
      sk.description,
      sk.required_for_graduation,
      sk.sort_order,
      COALESCE(se.achieved, false) as achieved,
      se.achieved_at,
      se.notes
    FROM public.skills sk
    LEFT JOIN public.swimmer_evaluations se ON se.skill_id = sk.id AND se.swimmer_id = p_swimmer_id
    ORDER BY sk.sort_order
  ) skill_data;
  
  -- Count achievements
  SELECT 
    COUNT(*) FILTER (WHERE achieved = true),
    COUNT(*),
    COUNT(*) FILTER (WHERE achieved = true AND required_for_graduation = true),
    COUNT(*) FILTER (WHERE required_for_graduation = true)
  INTO v_achieved_count, v_total_skills, v_required_achieved, v_required_total
  FROM (
    SELECT 
      sk.required_for_graduation,
      COALESCE(se.achieved, false) as achieved
    FROM public.skills sk
    LEFT JOIN public.swimmer_evaluations se ON se.skill_id = sk.id AND se.swimmer_id = p_swimmer_id
  ) counts;
  
  -- Determine recommendation
  IF v_required_total > 0 AND v_required_achieved >= v_required_total THEN
    v_recommendation := 'move_up';
  ELSIF v_total_skills > 0 AND (v_achieved_count::NUMERIC / v_total_skills::NUMERIC) >= 0.8 THEN
    v_recommendation := 'move_up';
  ELSE
    v_recommendation := 'stay';
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'swimmer', json_build_object(
      'id', v_swimmer.id,
      'name', v_swimmer.first_name || ' ' || v_swimmer.last_name,
      'level', v_swimmer.level_name
    ),
    'skills', v_skills,
    'summary', json_build_object(
      'achieved', v_achieved_count,
      'total', v_total_skills,
      'required_achieved', v_required_achieved,
      'required_total', v_required_total,
      'percentage', CASE WHEN v_total_skills > 0 THEN ROUND((v_achieved_count::NUMERIC / v_total_skills::NUMERIC) * 100) ELSE 0 END
    ),
    'recommendation', v_recommendation
  );
END;
$$;