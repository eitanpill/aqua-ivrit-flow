-- Create attendance_status enum
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

-- Create attendance table (נוכחות)
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  swimmer_id UUID REFERENCES public.swimmers(id) ON DELETE CASCADE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  marked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- One attendance record per enrollment
  UNIQUE(enrollment_id)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attendance
CREATE POLICY "Staff can view all attendance"
  ON public.attendance FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff can manage attendance"
  ON public.attendance FOR ALL
  USING (is_staff(auth.uid()));

CREATE POLICY "Parents can view their swimmers attendance"
  ON public.attendance FOR SELECT
  USING (
    swimmer_id IN (
      SELECT id FROM public.swimmers WHERE parent_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();