-- ===== SECURITY FIX: Secure RPC functions for payment config management =====
-- These functions prevent direct table access and exposure of raw API keys/secrets

-- Function to upsert payment configuration securely
CREATE OR REPLACE FUNCTION public.upsert_payment_config(
  p_school_id UUID,
  p_provider_name TEXT,
  p_api_key TEXT,
  p_api_secret TEXT DEFAULT NULL,
  p_plugin_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_result JSON;
BEGIN
  -- Check if user is admin for this school
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה לבצע פעולה זו');
  END IF;
  
  -- Verify user belongs to this school
  IF public.get_user_school_id() != p_school_id THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה לשנות הגדרות של בית ספר אחר');
  END IF;
  
  -- Block demo users
  IF public.block_demo_writes() THEN
    RETURN json_build_object('success', false, 'error', 'לא ניתן לשנות הגדרות במצב דמו');
  END IF;

  -- Check if config already exists for this school and provider
  SELECT id INTO v_existing_id
  FROM payment_configs
  WHERE school_id = p_school_id AND provider_name = p_provider_name::payment_provider;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing config
    UPDATE payment_configs
    SET 
      api_key = p_api_key,
      api_secret = COALESCE(p_api_secret, api_secret),
      plugin_id = COALESCE(p_plugin_id, plugin_id),
      is_active = true,
      updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    -- Insert new config
    INSERT INTO payment_configs (school_id, provider_name, api_key, api_secret, plugin_id, is_active)
    VALUES (p_school_id, p_provider_name::payment_provider, p_api_key, p_api_secret, p_plugin_id, true);
  END IF;

  -- Deactivate other providers for this school
  UPDATE payment_configs
  SET is_active = false
  WHERE school_id = p_school_id AND provider_name != p_provider_name::payment_provider;

  RETURN json_build_object(
    'success', true,
    'api_key_masked', public.get_masked_secret(p_api_key)
  );
END;
$$;

-- Function to delete payment configuration securely
CREATE OR REPLACE FUNCTION public.delete_payment_config(
  p_config_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- Check if user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה לבצע פעולה זו');
  END IF;
  
  -- Block demo users
  IF public.block_demo_writes() THEN
    RETURN json_build_object('success', false, 'error', 'לא ניתן לשנות הגדרות במצב דמו');
  END IF;

  -- Get the school_id for verification
  SELECT school_id INTO v_school_id
  FROM payment_configs
  WHERE id = p_config_id;

  IF v_school_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'הגדרת תשלום לא נמצאה');
  END IF;

  -- Verify user belongs to this school
  IF public.get_user_school_id() != v_school_id THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה למחוק הגדרות של בית ספר אחר');
  END IF;

  -- Delete the config
  DELETE FROM payment_configs WHERE id = p_config_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Drop direct INSERT/UPDATE/DELETE policies to force RPC usage
-- Keep only SELECT policy for viewing masked configs
DROP POLICY IF EXISTS "Admins can insert payment configs" ON public.payment_configs;
DROP POLICY IF EXISTS "Admins can update payment configs" ON public.payment_configs;
DROP POLICY IF EXISTS "Admins can delete payment configs" ON public.payment_configs;