-- Create skills table for tracking swimmer abilities
CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  level_id UUID REFERENCES public.class_levels(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create swimmer_evaluations table for tracking skill progress
CREATE TABLE public.swimmer_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  achieved BOOLEAN NOT NULL DEFAULT false,
  achieved_at TIMESTAMP WITH TIME ZONE,
  evaluated_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(swimmer_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swimmer_evaluations ENABLE ROW LEVEL SECURITY;

-- Skills policies - everyone can view, staff can manage
CREATE POLICY "Authenticated users can view skills"
  ON public.skills FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage skills"
  ON public.skills FOR ALL
  USING (is_staff(auth.uid()));

-- Evaluations policies
CREATE POLICY "Staff can manage evaluations"
  ON public.swimmer_evaluations FOR ALL
  USING (is_staff(auth.uid()));

CREATE POLICY "Parents can view their swimmers evaluations"
  ON public.swimmer_evaluations FOR SELECT
  USING (swimmer_id IN (
    SELECT id FROM public.swimmers WHERE parent_id = auth.uid()
  ));

-- Triggers for updated_at
CREATE TRIGGER update_skills_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_swimmer_evaluations_updated_at
  BEFORE UPDATE ON public.swimmer_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample skills for different levels
INSERT INTO public.skills (name, description, sort_order) VALUES
  ('כניסה בטוחה למים', 'יכולת להיכנס למים בצורה מבוקרת ובטוחה', 1),
  ('צפייה על הגב', 'יכולת לצוף על הגב למשך 10 שניות', 2),
  ('צפייה על הבטן', 'יכולת לצוף על הבטן למשך 10 שניות', 3),
  ('בעיטות רגליים', 'ביצוע בעיטות רגליים נכונות', 4),
  ('תנועות ידיים בסיסיות', 'ביצוע תנועות ידיים בסיסיות בשחייה', 5),
  ('נשימה צידית', 'יכולת לבצע נשימה צידית בזמן שחייה', 6),
  ('צלילה למים רדודים', 'יכולת לצלול למים רדודים בביטחון', 7),
  ('צלילה למים עמוקים', 'יכולת לצלול למים עמוקים ולהישאר מתחת למים', 8),
  ('שחיית חזה', 'ביצוע שחיית חזה בצורה נכונה', 9),
  ('שחיית גב', 'ביצוע שחיית גב בצורה נכונה', 10),
  ('שחיית פרפר', 'ביצוע שחיית פרפר בצורה נכונה', 11),
  ('סיבולת - 50 מטר', 'יכולת לשחות 50 מטר ללא הפסקה', 12);