-- Create system_policies table for configurable business rules
CREATE TABLE public.system_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_policies ENABLE ROW LEVEL SECURITY;

-- Everyone can read policies
CREATE POLICY "Anyone can read system policies"
  ON public.system_policies
  FOR SELECT
  USING (true);

-- Only admins can modify policies
CREATE POLICY "Admins can manage system policies"
  ON public.system_policies
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create make_up_tokens table
CREATE TABLE public.make_up_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
  issued_by UUID REFERENCES public.profiles(id),
  original_enrollment_id UUID REFERENCES public.enrollments(id),
  reason TEXT,
  expiry_date DATE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_for_enrollment_id UUID REFERENCES public.enrollments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.make_up_tokens ENABLE ROW LEVEL SECURITY;

-- Parents can view their children's tokens
CREATE POLICY "Parents can view their children tokens"
  ON public.make_up_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.swimmers s
      WHERE s.id = make_up_tokens.swimmer_id
        AND s.parent_id = auth.uid()
    )
  );

-- Staff can manage all tokens
CREATE POLICY "Staff can manage all tokens"
  ON public.make_up_tokens
  FOR ALL
  USING (public.is_staff(auth.uid()));

-- Create waitlist table
CREATE TABLE public.waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.profiles(id),
  position INTEGER NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'enrolled', 'expired', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, swimmer_id)
);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Parents can view and manage their waitlist entries
CREATE POLICY "Parents can view their waitlist entries"
  ON public.waitlist
  FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can join waitlist"
  ON public.waitlist
  FOR INSERT
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can cancel their waitlist"
  ON public.waitlist
  FOR UPDATE
  USING (parent_id = auth.uid());

-- Staff can manage all waitlist entries
CREATE POLICY "Staff can manage waitlist"
  ON public.waitlist
  FOR ALL
  USING (public.is_staff(auth.uid()));

-- Create function to issue make-up token on valid cancellation
CREATE OR REPLACE FUNCTION public.handle_enrollment_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_start TIMESTAMP WITH TIME ZONE;
  v_cancellation_hours INTEGER := 24; -- Default cancellation window
  v_token_validity_days INTEGER := 30; -- Default token validity
  v_policy_value JSONB;
BEGIN
  -- Only process if status changed to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Get session start time
    SELECT start_time INTO v_session_start
    FROM public.sessions
    WHERE id = NEW.session_id;

    -- Try to get cancellation policy
    SELECT value INTO v_policy_value
    FROM public.system_policies
    WHERE key = 'cancellation_policy';

    IF v_policy_value IS NOT NULL THEN
      v_cancellation_hours := COALESCE((v_policy_value->>'hours_before')::INTEGER, 24);
      v_token_validity_days := COALESCE((v_policy_value->>'token_validity_days')::INTEGER, 30);
    END IF;

    -- Check if cancelled in time (before the cancellation window)
    IF v_session_start - INTERVAL '1 hour' * v_cancellation_hours > now() THEN
      -- Issue make-up token
      INSERT INTO public.make_up_tokens (
        swimmer_id,
        original_enrollment_id,
        reason,
        expiry_date
      ) VALUES (
        NEW.swimmer_id,
        NEW.id,
        'ביטול בזמן - שיעור ' || to_char(v_session_start, 'DD/MM/YYYY'),
        CURRENT_DATE + v_token_validity_days
      );
    END IF;

    -- Notify next person in waitlist
    UPDATE public.waitlist
    SET status = 'notified',
        notified_at = now(),
        expires_at = now() + INTERVAL '2 hours'
    WHERE session_id = NEW.session_id
      AND status = 'waiting'
      AND position = (
        SELECT MIN(position)
        FROM public.waitlist
        WHERE session_id = NEW.session_id
          AND status = 'waiting'
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for cancellation handling
CREATE TRIGGER on_enrollment_cancelled
  AFTER UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_enrollment_cancellation();

-- Create function to get next waitlist position
CREATE OR REPLACE FUNCTION public.get_next_waitlist_position(p_session_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM public.waitlist
  WHERE session_id = p_session_id
    AND status IN ('waiting', 'notified');
$$;

-- Insert default policies
INSERT INTO public.system_policies (key, value, description) VALUES
  ('cancellation_policy', '{"hours_before": 24, "token_validity_days": 30}', 'מדיניות ביטולים - שעות לפני השיעור וימי תוקף אסימון'),
  ('waitlist_policy', '{"notification_expiry_hours": 2, "max_waitlist_size": 5}', 'מדיניות רשימת המתנה - שעות תפוגת הודעה וגודל מקסימלי');

-- Add triggers for updated_at
CREATE TRIGGER update_system_policies_updated_at
  BEFORE UPDATE ON public.system_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_make_up_tokens_updated_at
  BEFORE UPDATE ON public.make_up_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();