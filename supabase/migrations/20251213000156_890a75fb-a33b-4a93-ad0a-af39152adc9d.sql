-- Create enum for platform admin roles
CREATE TYPE public.platform_admin_role AS ENUM ('super_admin', 'admin', 'support');

-- Create platform_admins table for Super Admin access
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role platform_admin_role NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  notes text
);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check platform admin status
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;

-- Create function to get platform admin role
CREATE OR REPLACE FUNCTION public.get_platform_admin_role(_user_id uuid DEFAULT auth.uid())
RETURNS platform_admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.platform_admins
  WHERE user_id = _user_id
    AND is_active = true
  LIMIT 1
$$;

-- RLS Policies - Only platform admins can view/manage platform_admins
CREATE POLICY "Platform admins can view all platform admins"
ON public.platform_admins
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Super admins can manage platform admins"
ON public.platform_admins
FOR ALL
TO authenticated
USING (get_platform_admin_role(auth.uid()) = 'super_admin')
WITH CHECK (get_platform_admin_role(auth.uid()) = 'super_admin');

-- Create admin_access_logs table for audit trail
CREATE TABLE public.admin_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text,
  resource_id uuid,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on admin_access_logs
ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view logs
CREATE POLICY "Platform admins can view admin logs"
ON public.admin_access_logs
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- System can insert logs
CREATE POLICY "System can insert admin logs"
ON public.admin_access_logs
FOR INSERT
TO authenticated
WITH CHECK (is_platform_admin(auth.uid()));