
-- Create terms table (עונות/סמסטרים)
CREATE TABLE public.terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on terms
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

-- Policies for terms
CREATE POLICY "Authenticated users can view terms"
ON public.terms FOR SELECT
USING (true);

CREATE POLICY "Staff can manage terms"
ON public.terms FOR ALL
USING (is_staff(auth.uid()));

-- Create schedule_series table (סדרות שיעורים חוזרות)
CREATE TABLE public.schedule_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  class_type_id UUID NOT NULL REFERENCES public.class_types(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  max_participants INTEGER DEFAULT 8,
  recurrence_weeks INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on schedule_series
ALTER TABLE public.schedule_series ENABLE ROW LEVEL SECURITY;

-- Policies for schedule_series
CREATE POLICY "Authenticated users can view schedule series"
ON public.schedule_series FOR SELECT
USING (true);

CREATE POLICY "Staff can manage schedule series"
ON public.schedule_series FOR ALL
USING (is_staff(auth.uid()));

-- Add series_id and is_cancelled to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.schedule_series(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN NOT NULL DEFAULT false;

-- Create conflict detection function
CREATE OR REPLACE FUNCTION public.check_pool_conflict(
  p_resource_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE,
  p_end_time TIMESTAMP WITH TIME ZONE,
  p_exclude_session_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.resource_id = p_resource_id
      AND s.status != 'cancelled'
      AND s.is_cancelled = false
      AND (p_exclude_session_id IS NULL OR s.id != p_exclude_session_id)
      AND s.start_time < p_end_time
      AND s.end_time > p_start_time
  );
END;
$$;

-- Create function to generate sessions from a series
CREATE OR REPLACE FUNCTION public.generate_sessions_from_series(
  p_series_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_series RECORD;
  v_term RECORD;
  v_current_date DATE;
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
  v_sessions_created INTEGER := 0;
  v_conflicts INTEGER := 0;
  v_week_count INTEGER := 0;
BEGIN
  -- Get series details
  SELECT * INTO v_series FROM public.schedule_series WHERE id = p_series_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'סדרה לא נמצאה');
  END IF;

  -- Get term details
  SELECT * INTO v_term FROM public.terms WHERE id = v_series.term_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'עונה לא נמצאה');
  END IF;

  -- Find first occurrence of the day_of_week in the term
  v_current_date := v_term.start_date;
  WHILE EXTRACT(DOW FROM v_current_date) != v_series.day_of_week AND v_current_date <= v_term.end_date LOOP
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  -- Generate sessions for each week
  WHILE v_current_date <= v_term.end_date AND v_week_count < v_series.recurrence_weeks LOOP
    v_start_time := v_current_date + v_series.start_time;
    v_end_time := v_start_time + (v_series.duration_minutes || ' minutes')::INTERVAL;

    -- Check for conflicts
    IF v_series.resource_id IS NOT NULL AND check_pool_conflict(v_series.resource_id, v_start_time, v_end_time) THEN
      v_conflicts := v_conflicts + 1;
    ELSE
      -- Create session
      INSERT INTO public.sessions (
        series_id,
        class_type_id,
        coach_id,
        resource_id,
        start_time,
        end_time,
        max_participants,
        status
      ) VALUES (
        p_series_id,
        v_series.class_type_id,
        v_series.coach_id,
        v_series.resource_id,
        v_start_time,
        v_end_time,
        v_series.max_participants,
        'scheduled'
      );
      v_sessions_created := v_sessions_created + 1;
    END IF;

    v_current_date := v_current_date + INTERVAL '7 days';
    v_week_count := v_week_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'sessions_created', v_sessions_created,
    'conflicts_skipped', v_conflicts
  );
END;
$$;

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_terms_updated_at
BEFORE UPDATE ON public.terms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedule_series_updated_at
BEFORE UPDATE ON public.schedule_series
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
