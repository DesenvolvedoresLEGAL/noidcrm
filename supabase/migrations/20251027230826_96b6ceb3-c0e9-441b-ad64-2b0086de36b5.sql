-- FASE 1: Estrutura de Dados para Sistema de Gestão de Usuários

-- 1. Adicionar campos necessários à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS cpf text;

-- 2. Criar tabela de convites de usuários
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) NOT NULL,
  org_role org_role NOT NULL DEFAULT 'sales',
  permission_set_id uuid REFERENCES public.permission_sets(id),
  team_id uuid REFERENCES public.teams(id),
  status text NOT NULL DEFAULT 'pending',
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, email)
);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS para user_invitations
CREATE POLICY "Admins can manage invitations"
ON public.user_invitations
FOR ALL
TO authenticated
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "Users can view org invitations"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (user_is_org_member(organization_id));

-- 3. Criar tabela de histórico de acessos
CREATE TABLE IF NOT EXISTS public.user_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) NOT NULL,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS para access logs
CREATE POLICY "Admins can view all logs"
ON public.user_access_logs
FOR SELECT
TO authenticated
USING (user_is_org_admin(organization_id));

CREATE POLICY "Users can view own logs"
ON public.user_access_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can insert logs"
ON public.user_access_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Criar função para atualizar last_login
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login_at = now() 
  WHERE user_id = NEW.id;
  
  -- Log do acesso
  INSERT INTO public.user_access_logs (user_id, organization_id, action, metadata)
  SELECT NEW.id, p.organization_id, 'login', jsonb_build_object('timestamp', now())
  FROM public.profiles p
  WHERE p.user_id = NEW.id AND p.organization_id IS NOT NULL;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para atualizar last_login no auth
CREATE OR REPLACE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.update_last_login();

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_org_status ON public.user_invitations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_org ON public.user_access_logs(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.user_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);