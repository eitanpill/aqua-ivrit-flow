-- Create user_roles table for secure role management (separate from profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'customer',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Update has_role function to use user_roles table
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update is_staff function to use user_roles table
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'coach')
  )
$$;

-- Function to get user's role (Security Definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function for admins to set user role by email
CREATE OR REPLACE FUNCTION public.set_user_role_by_email(_email text, _role public.app_role)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
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

  -- Upsert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = _role, updated_at = now();

  RETURN json_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Trigger for new users - auto create customer role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Add updated_at trigger
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();