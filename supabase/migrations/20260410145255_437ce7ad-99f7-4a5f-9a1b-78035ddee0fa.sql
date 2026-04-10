
-- 1. Alter ai_agents
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS last_published_version_id uuid,
  ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false;

ALTER TABLE public.ai_agents
  ADD CONSTRAINT ai_agents_environment_check
  CHECK (environment IN ('draft', 'test', 'production', 'paused'));

ALTER TABLE public.ai_agents
  ADD CONSTRAINT ai_agents_last_published_version_fk
  FOREIGN KEY (last_published_version_id) REFERENCES public.ai_agent_versions(id);

-- 2. Alter ai_agent_versions
ALTER TABLE public.ai_agent_versions
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- published_by already exists on ai_agent_versions

-- 3. ai_agent_permissions
CREATE TABLE public.ai_agent_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_publish boolean DEFAULT false,
  can_execute boolean DEFAULT false,
  can_run_autonomous boolean DEFAULT false,
  can_approve boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.ai_agent_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_permissions_org_access" ON public.ai_agent_permissions
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 4. ai_agent_environments
CREATE TABLE public.ai_agent_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL,
  allow_execution boolean DEFAULT false,
  require_approval boolean DEFAULT true,
  allow_autonomous boolean DEFAULT false,
  max_actions_per_hour integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, environment),
  CONSTRAINT ai_agent_env_check CHECK (environment IN ('draft', 'test', 'production', 'paused'))
);

ALTER TABLE public.ai_agent_environments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_environments_org_access" ON public.ai_agent_environments
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 5. ai_agent_publish_history
CREATE TABLE public.ai_agent_publish_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  published_by uuid REFERENCES public.profiles(id),
  previous_version_id uuid REFERENCES public.ai_agent_versions(id),
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_agent_publish_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_publish_history_org_access" ON public.ai_agent_publish_history
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 6. ai_agent_execution_policies
CREATE TABLE public.ai_agent_execution_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  environment text,
  autonomy_level text,
  requires_approval boolean DEFAULT false,
  blocked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_agent_execution_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_execution_policies_org_access" ON public.ai_agent_execution_policies
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 7. Initialize default environment configs (function for orgs)
CREATE OR REPLACE FUNCTION public.initialize_agent_environments(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_agent_environments (organization_id, environment, allow_execution, require_approval, allow_autonomous, max_actions_per_hour)
  VALUES
    (p_organization_id, 'draft', false, true, false, 0),
    (p_organization_id, 'test', true, true, false, 50),
    (p_organization_id, 'production', true, false, true, 500),
    (p_organization_id, 'paused', false, true, false, 0)
  ON CONFLICT (organization_id, environment) DO NOTHING;
END;
$$;
