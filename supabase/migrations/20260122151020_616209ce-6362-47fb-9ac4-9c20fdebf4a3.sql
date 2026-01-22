-- Create seasons table (עונות פעילות)
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create class_levels table (רמות לימוד)
CREATE TABLE public.class_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product type enum
CREATE TYPE public.product_type AS ENUM ('subscription', 'punch_card', 'single_session', 'trial');

-- Create products table (מוצרים ומחירון)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type product_type NOT NULL DEFAULT 'subscription',
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  credits_amount INTEGER DEFAULT 1,
  duration_days INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Seasons policies (readable by all authenticated, editable by staff)
CREATE POLICY "Authenticated users can view seasons"
  ON public.seasons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage seasons"
  ON public.seasons FOR ALL
  USING (public.is_staff(auth.uid()));

-- Class levels policies
CREATE POLICY "Authenticated users can view class levels"
  ON public.class_levels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage class levels"
  ON public.class_levels FOR ALL
  USING (public.is_staff(auth.uid()));

-- Products policies
CREATE POLICY "Authenticated users can view active products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage products"
  ON public.products FOR ALL
  USING (public.is_staff(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_levels_updated_at
  BEFORE UPDATE ON public.class_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();