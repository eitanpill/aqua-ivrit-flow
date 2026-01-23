-- Add per_student_bonus to existing coach_rates table
ALTER TABLE public.coach_rates 
ADD COLUMN IF NOT EXISTS per_student_bonus numeric DEFAULT 0;

-- Create payroll_adjustments table
CREATE TABLE public.payroll_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month date NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id),
  school_id uuid REFERENCES public.schools(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payroll_adjustments
CREATE POLICY "Admins can manage payroll adjustments"
ON public.payroll_adjustments
FOR ALL
USING (
  is_super_admin() OR 
  (has_role(auth.uid(), 'admin') AND school_id = get_user_school_id())
);

CREATE POLICY "Coaches can view their own adjustments"
ON public.payroll_adjustments
FOR SELECT
USING (coach_id = auth.uid());

-- Create index for performance
CREATE INDEX idx_payroll_adjustments_coach_month 
ON public.payroll_adjustments(coach_id, month);

-- Function to calculate coach payroll for a month
CREATE OR REPLACE FUNCTION public.calculate_coach_payroll(
  p_coach_id uuid,
  p_month date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_base_rate numeric := 0;
  v_per_student_bonus numeric := 0;
  v_completed_sessions integer := 0;
  v_total_students integer := 0;
  v_adjustments_total numeric := 0;
  v_base_pay numeric := 0;
  v_bonus_pay numeric := 0;
  v_total_pay numeric := 0;
  v_month_start date;
  v_month_end date;
BEGIN
  -- Calculate month boundaries
  v_month_start := date_trunc('month', p_month)::date;
  v_month_end := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  
  -- Get coach rate (most recent effective rate)
  SELECT rate_per_hour, COALESCE(per_student_bonus, 0)
  INTO v_base_rate, v_per_student_bonus
  FROM coach_rates
  WHERE coach_id = p_coach_id
    AND effective_from <= v_month_end
    AND (effective_to IS NULL OR effective_to >= v_month_start)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Count completed sessions for the month
  SELECT COUNT(*)
  INTO v_completed_sessions
  FROM sessions
  WHERE coach_id = p_coach_id
    AND status = 'completed'
    AND start_time >= v_month_start
    AND start_time < v_month_end + interval '1 day';
  
  -- Count total students attended
  SELECT COALESCE(COUNT(*), 0)
  INTO v_total_students
  FROM attendance a
  JOIN sessions s ON s.id = a.session_id
  WHERE s.coach_id = p_coach_id
    AND s.status = 'completed'
    AND a.status = 'present'
    AND s.start_time >= v_month_start
    AND s.start_time < v_month_end + interval '1 day';
  
  -- Sum adjustments for the month
  SELECT COALESCE(SUM(amount), 0)
  INTO v_adjustments_total
  FROM payroll_adjustments
  WHERE coach_id = p_coach_id
    AND month >= v_month_start
    AND month <= v_month_end;
  
  -- Calculate totals
  v_base_pay := v_completed_sessions * COALESCE(v_base_rate, 0);
  v_bonus_pay := v_total_students * COALESCE(v_per_student_bonus, 0);
  v_total_pay := v_base_pay + v_bonus_pay + v_adjustments_total;
  
  v_result := json_build_object(
    'coach_id', p_coach_id,
    'month', p_month,
    'base_rate', v_base_rate,
    'per_student_bonus', v_per_student_bonus,
    'completed_sessions', v_completed_sessions,
    'total_students_attended', v_total_students,
    'base_pay', v_base_pay,
    'bonus_pay', v_bonus_pay,
    'adjustments_total', v_adjustments_total,
    'total_pay', v_total_pay
  );
  
  RETURN v_result;
END;
$$;

-- Function to get all coaches payroll summary for a month
CREATE OR REPLACE FUNCTION public.get_monthly_payroll_summary(
  p_month date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_school_id uuid;
BEGIN
  -- Get caller's school
  v_school_id := get_user_school_id();
  
  SELECT json_agg(
    json_build_object(
      'coach_id', p.id,
      'coach_name', COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      'payroll', calculate_coach_payroll(p.id, p_month)
    )
  )
  INTO v_result
  FROM profiles p
  WHERE p.school_id = v_school_id
    AND p.role = 'coach';
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;