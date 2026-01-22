-- Coach rates table for payroll calculations
CREATE TABLE public.coach_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rate_per_hour NUMERIC(10, 2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Enable RLS
ALTER TABLE public.coach_rates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage coach rates
CREATE POLICY "Admins can manage coach rates"
  ON public.coach_rates
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Coaches can view their own rates
CREATE POLICY "Coaches can view own rates"
  ON public.coach_rates
  FOR SELECT
  USING (coach_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_coach_rates_updated_at
  BEFORE UPDATE ON public.coach_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient lookups
CREATE INDEX idx_coach_rates_coach_id ON public.coach_rates(coach_id);
CREATE INDEX idx_coach_rates_effective_dates ON public.coach_rates(effective_from, effective_to);