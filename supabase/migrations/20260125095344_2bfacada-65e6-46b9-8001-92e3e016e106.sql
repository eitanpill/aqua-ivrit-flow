-- Add optional clearing plugin / terminal identifier (Morning 'pluginId')
ALTER TABLE public.payment_configs
ADD COLUMN IF NOT EXISTS plugin_id text;

COMMENT ON COLUMN public.payment_configs.plugin_id IS 'Clearing plugin/terminal identifier (e.g., Morning payments/form pluginId).';

-- Drop old function to allow signature change
DROP FUNCTION IF EXISTS public.get_payment_configs(uuid);

-- Recreate with plugin_id column exposed
CREATE OR REPLACE FUNCTION public.get_payment_configs(p_school_id uuid)
RETURNS TABLE(
  id uuid,
  school_id uuid,
  provider_name payment_provider,
  api_key_masked text,
  has_secret boolean,
  is_active boolean,
  plugin_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    get_masked_secret(pc.api_key) AS api_key_masked,
    pc.api_secret IS NOT NULL AS has_secret,
    pc.is_active,
    pc.plugin_id,
    pc.created_at,
    pc.updated_at
  FROM payment_configs pc
  WHERE pc.school_id = p_school_id;
END;
$function$;

-- Drop old upsert to allow signature change
DROP FUNCTION IF EXISTS public.upsert_payment_config(uuid, payment_provider, text, text, boolean);

-- Recreate upsert with plugin_id parameter
CREATE OR REPLACE FUNCTION public.upsert_payment_config(
  p_school_id uuid,
  p_provider_name payment_provider,
  p_api_key text,
  p_api_secret text DEFAULT NULL::text,
  p_is_active boolean DEFAULT true,
  p_plugin_id text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config_id UUID;
BEGIN
  -- Only admins of the school can update payment configs
  IF NOT (
    is_super_admin() OR 
    (has_role(auth.uid(), 'admin'::app_role) AND p_school_id = get_user_school_id())
  ) THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה לביצוע פעולה זו');
  END IF;

  -- Demo users cannot modify payment configs
  IF is_demo_user() THEN
    RETURN json_build_object('success', false, 'error', 'לא ניתן לבצע שינויים במצב דמו');
  END IF;

  -- Upsert the config
  INSERT INTO payment_configs (school_id, provider_name, api_key, api_secret, is_active, plugin_id)
  VALUES (p_school_id, p_provider_name, p_api_key, p_api_secret, p_is_active, p_plugin_id)
  ON CONFLICT (school_id, provider_name) 
  DO UPDATE SET 
    api_key = p_api_key,
    api_secret = COALESCE(p_api_secret, payment_configs.api_secret),
    is_active = p_is_active,
    plugin_id = COALESCE(p_plugin_id, payment_configs.plugin_id),
    updated_at = now()
  RETURNING id INTO v_config_id;

  RETURN json_build_object(
    'success', true, 
    'config_id', v_config_id,
    'message', 'ההגדרות נשמרו בהצלחה'
  );
END;
$function$;

-- Also update get_active_payment_config to return plugin_id
DROP FUNCTION IF EXISTS public.get_active_payment_config(uuid);

CREATE OR REPLACE FUNCTION public.get_active_payment_config(p_school_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config RECORD;
BEGIN
  SELECT id, provider_name, api_key, api_secret, plugin_id
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
    'key_masked', '****' || RIGHT(v_config.api_key, 4),
    'plugin_id', v_config.plugin_id
  );
END;
$function$;