
-- =============================================
-- NOID Intelligence Foundation — Sprint 0.1
-- =============================================

-- 1. ai_agents
CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  autonomy_level text NOT NULL DEFAULT 'observer',
  agent_scope text[] NOT NULL DEFAULT '{}',
  primary_channel text,
  objective text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_agents_status_check CHECK (status IN ('draft','test','production','paused')),
  CONSTRAINT ai_agents_autonomy_level_check CHECK (autonomy_level IN ('observer','recommender','assisted','autonomous','multi_agent')),
  CONSTRAINT ai_agents_name_org_unique UNIQUE (organization_id, name),
  CONSTRAINT ai_agents_slug_org_unique UNIQUE (organization_id, slug)
);

-- 2. ai_agent_versions
CREATE TABLE public.ai_agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_system text,
  prompt_deliberation text,
  prompt_generation text,
  prompt_review text,
  is_active boolean NOT NULL DEFAULT false,
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_agent_versions_agent_version_unique UNIQUE (agent_id, version_number)
);

-- 3. ai_agent_bindings
CREATE TABLE public.ai_agent_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  binding_role text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_agent_bindings_entity_type_check CHECK (entity_type IN (
    'lead','contact','account','opportunity','proposal',
    'activity','pipeline','stage','forecast','playbook'
  ))
);

-- 4. ai_agent_audit
CREATE TABLE public.ai_agent_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- INDICES
-- =============================================
CREATE INDEX idx_ai_agents_org ON public.ai_agents(organization_id);
CREATE INDEX idx_ai_agents_owner ON public.ai_agents(owner_id);
CREATE INDEX idx_ai_agents_status ON public.ai_agents(status);
CREATE INDEX idx_ai_agents_slug ON public.ai_agents(slug);

CREATE INDEX idx_ai_agent_versions_agent ON public.ai_agent_versions(agent_id);
CREATE INDEX idx_ai_agent_versions_org ON public.ai_agent_versions(organization_id);
CREATE INDEX idx_ai_agent_versions_active ON public.ai_agent_versions(agent_id, is_active);

CREATE INDEX idx_ai_agent_bindings_agent ON public.ai_agent_bindings(agent_id);
CREATE INDEX idx_ai_agent_bindings_org ON public.ai_agent_bindings(organization_id);
CREATE INDEX idx_ai_agent_bindings_entity ON public.ai_agent_bindings(entity_type, entity_id);

CREATE INDEX idx_ai_agent_audit_agent ON public.ai_agent_audit(agent_id);
CREATE INDEX idx_ai_agent_audit_org ON public.ai_agent_audit(organization_id);
CREATE INDEX idx_ai_agent_audit_action ON public.ai_agent_audit(action_type);

-- =============================================
-- TRIGGER: auto-update updated_at on ai_agents
-- =============================================
CREATE OR REPLACE FUNCTION public.update_ai_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_agents_updated_at();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_audit ENABLE ROW LEVEL SECURITY;

-- ai_agents policies
CREATE POLICY "ai_agents_select" ON public.ai_agents FOR SELECT
  USING (organization_id = public.get_user_organization_id());
CREATE POLICY "ai_agents_insert" ON public.ai_agents FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "ai_agents_update" ON public.ai_agents FOR UPDATE
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "ai_agents_delete" ON public.ai_agents FOR DELETE
  USING (organization_id = public.get_user_organization_id());

-- ai_agent_versions policies
CREATE POLICY "ai_agent_versions_select" ON public.ai_agent_versions FOR SELECT
  USING (organization_id = public.get_user_organization_id());
CREATE POLICY "ai_agent_versions_insert" ON public.ai_agent_versions FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "ai_agent_versions_update" ON public.ai_agent_versions FOR UPDATE
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- ai_agent_bindings policies
CREATE POLICY "ai_agent_bindings_select" ON public.ai_agent_bindings FOR SELECT
  USING (organization_id = public.get_user_organization_id());
CREATE POLICY "ai_agent_bindings_insert" ON public.ai_agent_bindings FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

-- ai_agent_audit policies
CREATE POLICY "ai_agent_audit_select" ON public.ai_agent_audit FOR SELECT
  USING (organization_id = public.get_user_organization_id());
CREATE POLICY "ai_agent_audit_insert" ON public.ai_agent_audit FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());
