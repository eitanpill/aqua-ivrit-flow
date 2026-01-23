-- Create payment provider enum
CREATE TYPE public.payment_provider AS ENUM ('stripe', 'tranzila', 'cardcom', 'generic');

-- Create payment_configs table with encrypted storage
CREATE TABLE public.payment_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider_name payment_provider NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, provider_name)
);

-- Enable RLS
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;

-- Admins can INSERT their own school's payment config
CREATE POLICY "Admins can insert payment configs"
ON public.payment_configs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND school_id = get_user_school_id()
);

-- Admins can UPDATE their own school's payment config
CREATE POLICY "Admins can update payment configs"
ON public.payment_configs
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND school_id = get_user_school_id()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND school_id = get_user_school_id()
);

-- Admins can DELETE their own school's payment config
CREATE POLICY "Admins can delete payment configs"
ON public.payment_configs
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND school_id = get_user_school_id()
);

-- NO SELECT policy for direct table access - use function instead

-- Create function to get masked payment configs (security definer)
CREATE OR REPLACE FUNCTION public.get_payment_configs(p_school_id UUID)
RETURNS TABLE(
  id UUID,
  school_id UUID,
  provider_name payment_provider,
  api_key_masked TEXT,
  has_secret BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this school
  IF NOT (
    is_super_admin() OR 
    (has_role(auth.uid(), 'admin'::app_role) AND p_school_id = get_user_school_id())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    pc.id,
    pc.school_id,
    pc.provider_name,
    CASE 
      WHEN LENGTH(pc.api_key) > 8 THEN 
        '****' || RIGHT(pc.api_key, 4)
      ELSE 
        '****'
    END AS api_key_masked,
    pc.api_secret IS NOT NULL AS has_secret,
    pc.is_active,
    pc.created_at,
    pc.updated_at
  FROM payment_configs pc
  WHERE pc.school_id = p_school_id;
END;
$$;

-- Create function to get active payment config for processing (internal use)
CREATE OR REPLACE FUNCTION public.get_active_payment_config(p_school_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
BEGIN
  SELECT id, provider_name, api_key, api_secret
  INTO v_config
  FROM payment_configs
  WHERE school_id = p_school_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'לא הוגדר ספק תשלומים פעיל'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'provider', v_config.provider_name,
    'key_masked', '****' || RIGHT(v_config.api_key, 4)
  );
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_payment_configs_updated_at
BEFORE UPDATE ON public.payment_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();