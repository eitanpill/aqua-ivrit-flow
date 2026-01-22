-- Create enrollment_status enum
CREATE TYPE public.enrollment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'attended', 'no_show');

-- Create enrollments table (הרשמות לשיעורים)
CREATE TABLE public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  swimmer_id UUID REFERENCES public.swimmers(id) ON DELETE CASCADE NOT NULL,
  status public.enrollment_status NOT NULL DEFAULT 'confirmed',
  enrolled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Prevent duplicate enrollments
  UNIQUE(session_id, swimmer_id)
);

-- Create wallet_transaction_type enum
CREATE TYPE public.wallet_transaction_type AS ENUM ('purchase', 'usage', 'refund', 'adjustment', 'expiry');

-- Create customer_wallets table (ארנקים)
CREATE TABLE public.customer_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_transactions table (היסטוריית עסקאות)
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES public.customer_wallets(id) ON DELETE CASCADE NOT NULL,
  type public.wallet_transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrollments
CREATE POLICY "Parents can view enrollments for their swimmers"
  ON public.enrollments FOR SELECT
  USING (
    swimmer_id IN (
      SELECT id FROM public.swimmers WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can create enrollments for their swimmers"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    swimmer_id IN (
      SELECT id FROM public.swimmers WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can cancel their enrollments"
  ON public.enrollments FOR UPDATE
  USING (
    swimmer_id IN (
      SELECT id FROM public.swimmers WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage all enrollments"
  ON public.enrollments FOR ALL
  USING (is_staff(auth.uid()));

-- RLS Policies for customer_wallets
CREATE POLICY "Users can view their own wallet"
  ON public.customer_wallets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view all wallets"
  ON public.customer_wallets FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff can manage wallets"
  ON public.customer_wallets FOR ALL
  USING (is_staff(auth.uid()));

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM public.customer_wallets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage all transactions"
  ON public.wallet_transactions FOR ALL
  USING (is_staff(auth.uid()));

-- Create updated_at triggers
CREATE TRIGGER update_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_wallets_updated_at
  BEFORE UPDATE ON public.customer_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check for double booking
CREATE OR REPLACE FUNCTION public.check_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.sessions s1 ON e.session_id = s1.id
    JOIN public.sessions s2 ON s2.id = NEW.session_id
    WHERE e.swimmer_id = NEW.swimmer_id
      AND e.status NOT IN ('cancelled')
      AND e.id IS DISTINCT FROM NEW.id
      AND s1.start_time < s2.end_time
      AND s1.end_time > s2.start_time
  ) THEN
    RAISE EXCEPTION 'הילד כבר רשום לשעה זו';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for double booking prevention
CREATE TRIGGER prevent_double_booking
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_double_booking();

-- Auto-create wallet for new users
CREATE OR REPLACE FUNCTION public.create_customer_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customer_wallets (user_id, credits_balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER create_wallet_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_customer_wallet();