-- Prevent admins from locking themselves out by changing their own role

-- 1) Harden RLS policy (blocks direct UPDATE/upsert on own row)
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_id <> auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_id <> auth.uid()
);

-- 2) Harden role assignment by email (SECURITY DEFINER bypasses RLS, so we must guard inside)
CREATE OR REPLACE FUNCTION public.set_user_role_by_email(_email text, _role app_role)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה לביצוע פעולה זו');
  END IF;

  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = _email;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'משתמש לא נמצא - ודא שהמשתמש נרשם למערכת');
  END IF;

  -- Block self role change
  IF v_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'לא ניתן לשנות את התפקיד של עצמך');
  END IF;

  -- Upsert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = _role, updated_at = now();

  RETURN json_build_object('success', true, 'user_id', v_user_id);
END;
$function$;

-- 3) Add a user_id-based RPC so the admin UI can enforce the same rule
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'אין הרשאה לביצוע פעולה זו');
  END IF;

  -- Block self role change
  IF _user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'לא ניתן לשנות את התפקיד של עצמך');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = _role, updated_at = now();

  RETURN json_build_object('success', true, 'user_id', _user_id);
END;
$function$;
