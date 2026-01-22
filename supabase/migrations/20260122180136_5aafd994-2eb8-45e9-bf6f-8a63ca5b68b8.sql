-- =====================================================
-- PART 3: FINANCIAL ENGINE & PRORATION
-- =====================================================

-- 1. Create subscription_status enum
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create discount_type enum
DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage', 'fixed', 'family');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  parent_id UUID NOT NULL REFERENCES public.profiles(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  next_billing_date DATE,
  status subscription_status NOT NULL DEFAULT 'active',
  price_override NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create discounts table
CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type discount_type NOT NULL DEFAULT 'percentage',
  value NUMERIC(10,2) NOT NULL,
  min_children INTEGER, -- For family discount: minimum active children required
  max_uses INTEGER, -- NULL = unlimited
  valid_from DATE,
  valid_to DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  auto_apply BOOLEAN NOT NULL DEFAULT false, -- Auto-apply if conditions match
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create charges table for detailed billing
CREATE TABLE IF NOT EXISTS public.charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.profiles(id),
  swimmer_id UUID REFERENCES public.swimmers(id),
  subscription_id UUID REFERENCES public.subscriptions(id),
  product_id UUID REFERENCES public.products(id),
  base_amount NUMERIC(10,2) NOT NULL,
  proration_amount NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_id UUID REFERENCES public.discounts(id),
  final_amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for subscriptions
CREATE POLICY "Parents can view their subscriptions"
  ON public.subscriptions FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Staff can manage all subscriptions"
  ON public.subscriptions FOR ALL
  USING (is_staff(auth.uid()));

-- 8. RLS Policies for discounts
CREATE POLICY "Anyone can view active discounts"
  ON public.discounts FOR SELECT
  USING (active = true);

CREATE POLICY "Staff can manage discounts"
  ON public.discounts FOR ALL
  USING (is_staff(auth.uid()));

-- 9. RLS Policies for charges
CREATE POLICY "Parents can view their charges"
  ON public.charges FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Staff can manage all charges"
  ON public.charges FOR ALL
  USING (is_staff(auth.uid()));

-- 10. Create updated_at triggers
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discounts_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_charges_updated_at
  BEFORE UPDATE ON public.charges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Function to calculate proration
CREATE OR REPLACE FUNCTION calculate_proration(
  p_base_price NUMERIC,
  p_start_date DATE,
  p_period_start DATE,
  p_period_end DATE
) RETURNS JSON
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total_days INTEGER;
  v_remaining_days INTEGER;
  v_proration_factor NUMERIC;
  v_prorated_amount NUMERIC;
  v_discount_amount NUMERIC;
BEGIN
  -- Calculate total days in period
  v_total_days := p_period_end - p_period_start + 1;
  
  -- Calculate remaining days from start date
  IF p_start_date <= p_period_start THEN
    v_remaining_days := v_total_days;
  ELSIF p_start_date > p_period_end THEN
    v_remaining_days := 0;
  ELSE
    v_remaining_days := p_period_end - p_start_date + 1;
  END IF;
  
  -- Calculate proration factor
  v_proration_factor := v_remaining_days::NUMERIC / v_total_days::NUMERIC;
  
  -- Calculate prorated amount
  v_prorated_amount := ROUND(p_base_price * v_proration_factor, 2);
  v_discount_amount := p_base_price - v_prorated_amount;
  
  RETURN json_build_object(
    'base_price', p_base_price,
    'total_days', v_total_days,
    'remaining_days', v_remaining_days,
    'proration_factor', ROUND(v_proration_factor, 4),
    'prorated_amount', v_prorated_amount,
    'discount_amount', v_discount_amount
  );
END;
$$;

-- 12. Function to check family discount eligibility
CREATE OR REPLACE FUNCTION check_family_discount(
  p_parent_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_active_children INTEGER;
  v_discount RECORD;
  v_applicable_discount JSON := NULL;
BEGIN
  -- Count active subscriptions for this parent's children
  SELECT COUNT(DISTINCT s.swimmer_id) INTO v_active_children
  FROM public.subscriptions s
  WHERE s.parent_id = p_parent_id
    AND s.status = 'active';
  
  -- Find applicable family discount
  SELECT * INTO v_discount
  FROM public.discounts
  WHERE type = 'family'
    AND active = true
    AND auto_apply = true
    AND (min_children IS NULL OR v_active_children >= min_children)
    AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
  ORDER BY value DESC
  LIMIT 1;
  
  IF v_discount.id IS NOT NULL THEN
    v_applicable_discount := json_build_object(
      'id', v_discount.id,
      'name', v_discount.name,
      'type', v_discount.type,
      'value', v_discount.value
    );
  END IF;
  
  RETURN json_build_object(
    'active_children', v_active_children,
    'applicable_discount', v_applicable_discount
  );
END;
$$;

-- 13. Function to create a charge with proration and discounts
CREATE OR REPLACE FUNCTION create_charge_with_calculations(
  p_parent_id UUID,
  p_swimmer_id UUID,
  p_product_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_apply_family_discount BOOLEAN DEFAULT true
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_term RECORD;
  v_proration JSON;
  v_family_check JSON;
  v_base_amount NUMERIC;
  v_prorated_amount NUMERIC;
  v_proration_discount NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_discount_id UUID := NULL;
  v_final_amount NUMERIC;
  v_charge_id UUID;
  v_subscription_id UUID;
BEGIN
  -- Get product details
  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'מוצר לא נמצא או לא פעיל');
  END IF;
  
  v_base_amount := v_product.price;
  
  -- Get current/next term for proration
  SELECT * INTO v_term
  FROM public.terms
  WHERE active = true
    OR (start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE)
  ORDER BY start_date ASC
  LIMIT 1;
  
  -- Calculate proration if we have a term
  IF v_term.id IS NOT NULL AND p_start_date > v_term.start_date THEN
    v_proration := calculate_proration(
      v_base_amount,
      p_start_date,
      v_term.start_date,
      v_term.end_date
    );
    v_prorated_amount := (v_proration->>'prorated_amount')::NUMERIC;
    v_proration_discount := v_base_amount - v_prorated_amount;
  ELSE
    v_prorated_amount := v_base_amount;
  END IF;
  
  -- Check family discount
  IF p_apply_family_discount THEN
    v_family_check := check_family_discount(p_parent_id);
    
    IF v_family_check->'applicable_discount' IS NOT NULL 
       AND v_family_check->'applicable_discount' != 'null' THEN
      v_discount_id := (v_family_check->'applicable_discount'->>'id')::UUID;
      
      IF (v_family_check->'applicable_discount'->>'type') = 'percentage' THEN
        v_discount_amount := ROUND(v_prorated_amount * (v_family_check->'applicable_discount'->>'value')::NUMERIC / 100, 2);
      ELSE
        v_discount_amount := (v_family_check->'applicable_discount'->>'value')::NUMERIC;
      END IF;
    END IF;
  END IF;
  
  -- Calculate final amount
  v_final_amount := GREATEST(0, v_prorated_amount - v_discount_amount);
  
  -- Create subscription
  INSERT INTO public.subscriptions (swimmer_id, product_id, parent_id, start_date, end_date, status)
  VALUES (p_swimmer_id, p_product_id, p_parent_id, p_start_date, v_term.end_date, 'active')
  RETURNING id INTO v_subscription_id;
  
  -- Create charge
  INSERT INTO public.charges (
    parent_id,
    swimmer_id,
    subscription_id,
    product_id,
    base_amount,
    proration_amount,
    discount_amount,
    discount_id,
    final_amount,
    description,
    status,
    due_date
  ) VALUES (
    p_parent_id,
    p_swimmer_id,
    v_subscription_id,
    p_product_id,
    v_base_amount,
    v_proration_discount,
    v_discount_amount,
    v_discount_id,
    v_final_amount,
    'רישום ל' || v_product.name || ' - ' || (SELECT first_name || ' ' || last_name FROM swimmers WHERE id = p_swimmer_id),
    'pending',
    CURRENT_DATE
  )
  RETURNING id INTO v_charge_id;
  
  RETURN json_build_object(
    'success', true,
    'charge_id', v_charge_id,
    'subscription_id', v_subscription_id,
    'breakdown', json_build_object(
      'base_amount', v_base_amount,
      'proration_discount', v_proration_discount,
      'family_discount', v_discount_amount,
      'final_amount', v_final_amount
    )
  );
END;
$$;

-- 14. Function to get family debts
CREATE OR REPLACE FUNCTION get_family_debts()
RETURNS TABLE (
  parent_id UUID,
  parent_name TEXT,
  parent_email TEXT,
  total_pending NUMERIC,
  oldest_due_date DATE,
  pending_charges_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.parent_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'לא ידוע') as parent_name,
    COALESCE(u.email, '') as parent_email,
    SUM(c.final_amount) as total_pending,
    MIN(c.due_date) as oldest_due_date,
    COUNT(*) as pending_charges_count
  FROM public.charges c
  LEFT JOIN public.profiles p ON c.parent_id = p.id
  LEFT JOIN auth.users u ON c.parent_id = u.id
  WHERE c.status IN ('pending', 'failed')
  GROUP BY c.parent_id, p.first_name, p.last_name, u.email
  HAVING SUM(c.final_amount) > 0
  ORDER BY total_pending DESC;
END;
$$;

-- 15. Insert default family discount
INSERT INTO public.discounts (name, description, type, value, min_children, auto_apply, active)
VALUES 
  ('הנחת משפחה - ילד שני', 'הנחה אוטומטית לילד השני ומעלה במשפחה', 'family', 10, 2, true, true),
  ('הנחת משפחה - ילד שלישי', 'הנחה מוגברת לילד השלישי ומעלה', 'family', 15, 3, true, true)
ON CONFLICT DO NOTHING;