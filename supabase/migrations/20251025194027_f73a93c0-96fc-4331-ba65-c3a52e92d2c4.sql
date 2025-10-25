-- FASE 1: Estrutura de Dados Multi-Tenant

-- 1.1 Criar tabela organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE,
  
  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  
  -- Metadados
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Limites do plano
  max_users INTEGER DEFAULT 5,
  max_opportunities INTEGER DEFAULT 100
);

-- Índices para performance
CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_domain ON public.organizations(domain);
CREATE INDEX idx_organizations_status ON public.organizations(status);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 1.2 Criar tabela organization_members
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role dentro da organização
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);

-- Enable RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 1.3 Adicionar organization_id em todas as tabelas
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.opportunities ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.activities ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.contacts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.accounts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.contracts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.proposals ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.sequences ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.pipelines ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.stages ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.settings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.automation_config ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Criar índices para performance
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX idx_opportunities_org_new ON public.opportunities(organization_id);
CREATE INDEX idx_activities_org_new ON public.activities(organization_id);
CREATE INDEX idx_contacts_org ON public.contacts(organization_id);
CREATE INDEX idx_accounts_org ON public.accounts(organization_id);
CREATE INDEX idx_contracts_org ON public.contracts(organization_id);
CREATE INDEX idx_proposals_org ON public.proposals(organization_id);
CREATE INDEX idx_sequences_org ON public.sequences(organization_id);
CREATE INDEX idx_pipelines_org ON public.pipelines(organization_id);
CREATE INDEX idx_stages_org ON public.stages(organization_id);
CREATE INDEX idx_settings_org ON public.settings(organization_id);
CREATE INDEX idx_automation_config_org ON public.automation_config(organization_id);

-- FASE 2: Funções Helper de Segurança

-- 2.1 Função para pegar organization_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1
$$;

-- 2.2 Função para verificar se usuário pertence à organização
CREATE OR REPLACE FUNCTION public.user_is_org_member(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND status = 'active'
  )
$$;

-- 2.3 Função para verificar se usuário é owner/admin da org
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND role IN ('owner', 'admin')
      AND status = 'active'
  )
$$;

-- FASE 3: Row-Level Security Policies

-- 3.1 RLS para organizations
CREATE POLICY "Users can view their organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Org admins can update organization"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(id))
  WITH CHECK (user_is_org_admin(id));

CREATE POLICY "System can insert organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3.2 RLS para organization_members
CREATE POLICY "Users can view their org members"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Org admins can manage members"
  ON public.organization_members FOR ALL
  TO authenticated
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "System can insert members"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3.3 Atualizar RLS das tabelas existentes para multi-tenant

-- Drop políticas antigas que conflitam
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and managers can view all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admins and managers can view all activities" ON public.activities;

-- Profiles
CREATE POLICY "Users can view org profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Opportunities
CREATE POLICY "Users can view org opportunities"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can insert in own org opps"
  ON public.opportunities FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Activities
CREATE POLICY "Users can view org activities"
  ON public.activities FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can insert in own org activities"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Contacts
CREATE POLICY "Users can view org contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can insert org contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Accounts
CREATE POLICY "Users can view org accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can insert org accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Contracts
CREATE POLICY "Users can view org contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can insert org contracts"
  ON public.contracts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Proposals
CREATE POLICY "Users can view org proposals"
  ON public.proposals FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can insert org proposals"
  ON public.proposals FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Sequences
CREATE POLICY "Users can view org sequences"
  ON public.sequences FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Pipelines
CREATE POLICY "Users can view org pipelines"
  ON public.pipelines FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Stages
CREATE POLICY "Users can view org stages"
  ON public.stages FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Settings
CREATE POLICY "Users can view org settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Automation Config
CREATE POLICY "Users can view org automation config"
  ON public.automation_config FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- FASE 4: Atualizar trigger handle_new_user para criar organização

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
BEGIN
  -- Gerar slug único da organização baseado no email
  org_slug := LOWER(REGEXP_REPLACE(
    SPLIT_PART(NEW.email, '@', 1), 
    '[^a-z0-9]+', 
    '-', 
    'g'
  )) || '-' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);
  
  -- Criar organização automaticamente
  INSERT INTO public.organizations (name, slug, status, trial_ends_at)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', SPLIT_PART(NEW.email, '@', 1) || ' CRM'),
    org_slug,
    'trial',
    NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO new_org_id;
  
  -- Criar perfil associado à organização
  INSERT INTO public.profiles (user_id, full_name, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    new_org_id
  );
  
  -- Adicionar como owner da organização
  INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
  VALUES (new_org_id, NEW.id, 'owner', 'active', NOW());
  
  -- Atribuir role admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  RETURN NEW;
END;
$$;

-- FASE 5: Migração de dados existentes

-- Criar organização default para dados existentes
INSERT INTO public.organizations (id, name, slug, status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Organização Padrão',
  'default',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Associar usuários existentes à org default
INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  user_id,
  CASE 
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = profiles.user_id AND role = 'admin') 
    THEN 'admin'
    ELSE 'member'
  END,
  'active',
  created_at
FROM public.profiles
WHERE user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Atualizar organization_id em todas as tabelas
UPDATE public.profiles SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.opportunities SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.activities SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.contacts SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.accounts SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.contracts SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.proposals SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.sequences SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.pipelines SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.stages SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.settings SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.automation_config SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;