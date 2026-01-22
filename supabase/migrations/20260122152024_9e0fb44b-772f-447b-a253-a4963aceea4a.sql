-- Create class_types table (סוגי שיעורים)
CREATE TABLE public.class_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL DEFAULT 45,
  level_id UUID REFERENCES public.class_levels(id) ON DELETE SET NULL,
  max_participants INTEGER DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create schedule_templates table (תבניות לוח זמנים)
CREATE TABLE public.schedule_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  class_type_id UUID REFERENCES public.class_types(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create session_status enum
CREATE TYPE public.session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Create sessions table (שיעורים)
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.schedule_templates(id) ON DELETE SET NULL,
  class_type_id UUID REFERENCES public.class_types(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  status public.session_status NOT NULL DEFAULT 'scheduled',
  max_participants INTEGER DEFAULT 8,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.class_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_types
CREATE POLICY "Authenticated users can view class types"
  ON public.class_types FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage class types"
  ON public.class_types FOR ALL
  USING (is_staff(auth.uid()));

-- RLS Policies for schedule_templates
CREATE POLICY "Authenticated users can view schedule templates"
  ON public.schedule_templates FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage schedule templates"
  ON public.schedule_templates FOR ALL
  USING (is_staff(auth.uid()));

-- RLS Policies for sessions
CREATE POLICY "Authenticated users can view sessions"
  ON public.sessions FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage sessions"
  ON public.sessions FOR ALL
  USING (is_staff(auth.uid()));

-- Create updated_at triggers
CREATE TRIGGER update_class_types_updated_at
  BEFORE UPDATE ON public.class_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedule_templates_updated_at
  BEFORE UPDATE ON public.schedule_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();