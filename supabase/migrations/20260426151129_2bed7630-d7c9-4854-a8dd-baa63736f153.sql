-- ============================================================
-- SPRINT 1.1 — MCP REGISTRY FOUNDATION (NOID Intelligence)
-- 8 tables, constraints, indexes, RLS, triggers
-- ============================================================

-- ============================================================
-- 1. mcp_servers
-- ============================================================
CREATE TABLE public.mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text NULL,
  server_type text NOT NULL DEFAULT 'internal',
  transport_type text NOT NULL DEFAULT 'http',
  base_url text NULL,
  status text NOT NULL DEFAULT 'draft',
  auth_type text NOT NULL DEFAULT 'none',
  risk_level text NOT NULL DEFAULT 'low',
  created_by uuid NULL,
  updated_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_servers_server_type_chk CHECK (server_type IN ('internal','external')),
  CONSTRAINT mcp_servers_transport_type_chk CHECK (transport_type IN ('http','stdio','sse')),
  CONSTRAINT mcp_servers_status_chk CHECK (status IN ('draft','active','inactive','archived')),
  CONSTRAINT mcp_servers_auth_type_chk CHECK (auth_type IN ('none','api_key','oauth','service_role')),
  CONSTRAINT mcp_servers_risk_level_chk CHECK (risk_level IN ('low','medium','high','critical'))
);

CREATE INDEX idx_mcp_servers_organization_id ON public.mcp_servers(organization_id);
CREATE INDEX idx_mcp_servers_status ON public.mcp_servers(status);
CREATE INDEX idx_mcp_servers_server_type ON public.mcp_servers(server_type);
CREATE INDEX idx_mcp_servers_slug ON public.mcp_servers(slug);
CREATE UNIQUE INDEX idx_mcp_servers_org_slug ON public.mcp_servers(organization_id, slug) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX idx_mcp_servers_global_slug ON public.mcp_servers(slug) WHERE organization_id IS NULL;

-- ============================================================
-- 2. mcp_tools
-- ============================================================
CREATE TABLE public.mcp_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  server_id uuid NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text NULL,
  category text NULL,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'low',
  execution_mode text NOT NULL DEFAULT 'read_only',
  requires_approval boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  updated_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_tools_risk_level_chk CHECK (risk_level IN ('low','medium','high','critical')),
  CONSTRAINT mcp_tools_execution_mode_chk CHECK (execution_mode IN ('read_only','suggestion_only','approval_required','automatic_controlled'))
);

CREATE INDEX idx_mcp_tools_organization_id ON public.mcp_tools(organization_id);
CREATE INDEX idx_mcp_tools_server_id ON public.mcp_tools(server_id);
CREATE INDEX idx_mcp_tools_slug ON public.mcp_tools(slug);
CREATE INDEX idx_mcp_tools_is_enabled ON public.mcp_tools(is_enabled);
CREATE INDEX idx_mcp_tools_execution_mode ON public.mcp_tools(execution_mode);
CREATE INDEX idx_mcp_tools_risk_level ON public.mcp_tools(risk_level);
CREATE UNIQUE INDEX idx_mcp_tools_org_slug ON public.mcp_tools(organization_id, server_id, slug) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX idx_mcp_tools_global_slug ON public.mcp_tools(server_id, slug) WHERE organization_id IS NULL;

-- ============================================================
-- 3. mcp_resources
-- ============================================================
CREATE TABLE public.mcp_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  server_id uuid NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  uri_pattern text NOT NULL,
  description text NULL,
  resource_type text NOT NULL DEFAULT 'crm',
  read_scope text NOT NULL DEFAULT 'tenant',
  risk_level text NOT NULL DEFAULT 'low',
  is_enabled boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  updated_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_resources_resource_type_chk CHECK (resource_type IN ('crm','sales','proposal','activity','report','playbook','tenant','user','external')),
  CONSTRAINT mcp_resources_read_scope_chk CHECK (read_scope IN ('public','tenant','owner','role_based','admin_only')),
  CONSTRAINT mcp_resources_risk_level_chk CHECK (risk_level IN ('low','medium','high','critical'))
);

CREATE INDEX idx_mcp_resources_organization_id ON public.mcp_resources(organization_id);
CREATE INDEX idx_mcp_resources_server_id ON public.mcp_resources(server_id);
CREATE INDEX idx_mcp_resources_resource_type ON public.mcp_resources(resource_type);
CREATE INDEX idx_mcp_resources_read_scope ON public.mcp_resources(read_scope);
CREATE INDEX idx_mcp_resources_is_enabled ON public.mcp_resources(is_enabled);
CREATE INDEX idx_mcp_resources_uri_pattern ON public.mcp_resources(uri_pattern);

-- ============================================================
-- 4. mcp_prompts
-- ============================================================
CREATE TABLE public.mcp_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text NULL,
  prompt_type text NOT NULL DEFAULT 'template',
  content text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NULL,
  updated_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_prompts_prompt_type_chk CHECK (prompt_type IN ('template','system','agent_instruction','workflow','sales_script','objection_handling','analysis')),
  CONSTRAINT mcp_prompts_status_chk CHECK (status IN ('draft','active','inactive','archived')),
  CONSTRAINT mcp_prompts_version_chk CHECK (version >= 1)
);

CREATE INDEX idx_mcp_prompts_organization_id ON public.mcp_prompts(organization_id);
CREATE INDEX idx_mcp_prompts_slug ON public.mcp_prompts(slug);
CREATE INDEX idx_mcp_prompts_prompt_type ON public.mcp_prompts(prompt_type);
CREATE INDEX idx_mcp_prompts_status ON public.mcp_prompts(status);
CREATE INDEX idx_mcp_prompts_version ON public.mcp_prompts(version);
CREATE UNIQUE INDEX idx_mcp_prompts_org_slug_version ON public.mcp_prompts(organization_id, slug, version) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX idx_mcp_prompts_global_slug_version ON public.mcp_prompts(slug, version) WHERE organization_id IS NULL;

-- ============================================================
-- 5. mcp_permissions
-- ============================================================
CREATE TABLE public.mcp_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  agent_id uuid NULL REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  role_name text NULL,
  user_id uuid NULL,
  tool_id uuid NULL REFERENCES public.mcp_tools(id) ON DELETE CASCADE,
  resource_id uuid NULL REFERENCES public.mcp_resources(id) ON DELETE CASCADE,
  prompt_id uuid NULL REFERENCES public.mcp_prompts(id) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT false,
  can_suggest boolean NOT NULL DEFAULT false,
  can_execute boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT true,
  max_calls_per_day integer NULL,
  allowed_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NULL,
  updated_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_permissions_status_chk CHECK (status IN ('active','inactive','archived')),
  CONSTRAINT mcp_permissions_max_calls_chk CHECK (max_calls_per_day IS NULL OR max_calls_per_day > 0),
  CONSTRAINT mcp_permissions_has_subject CHECK (agent_id IS NOT NULL OR role_name IS NOT NULL OR user_id IS NOT NULL),
  CONSTRAINT mcp_permissions_has_object CHECK (tool_id IS NOT NULL OR resource_id IS NOT NULL OR prompt_id IS NOT NULL)
);

CREATE INDEX idx_mcp_permissions_organization_id ON public.mcp_permissions(organization_id);
CREATE INDEX idx_mcp_permissions_agent_id ON public.mcp_permissions(agent_id);
CREATE INDEX idx_mcp_permissions_role_name ON public.mcp_permissions(role_name);
CREATE INDEX idx_mcp_permissions_user_id ON public.mcp_permissions(user_id);
CREATE INDEX idx_mcp_permissions_tool_id ON public.mcp_permissions(tool_id);
CREATE INDEX idx_mcp_permissions_resource_id ON public.mcp_permissions(resource_id);
CREATE INDEX idx_mcp_permissions_prompt_id ON public.mcp_permissions(prompt_id);
CREATE INDEX idx_mcp_permissions_status ON public.mcp_permissions(status);

-- ============================================================
-- 6. mcp_tool_invocations
-- ============================================================
CREATE TABLE public.mcp_tool_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  agent_id uuid NULL REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  user_id uuid NULL,
  tool_id uuid NULL REFERENCES public.mcp_tools(id) ON DELETE SET NULL,
  tool_slug text NOT NULL,
  invocation_type text NOT NULL DEFAULT 'simulated',
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NULL,
  risk_level text NOT NULL DEFAULT 'low',
  execution_mode text NOT NULL DEFAULT 'read_only',
  approval_required boolean NOT NULL DEFAULT true,
  approval_status text NOT NULL DEFAULT 'not_required',
  execution_status text NOT NULL DEFAULT 'pending',
  error_message text NULL,
  volts_consumed numeric NOT NULL DEFAULT 0,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_invocations_invocation_type_chk CHECK (invocation_type IN ('simulated','real')),
  CONSTRAINT mcp_invocations_approval_status_chk CHECK (approval_status IN ('not_required','pending','approved','rejected','expired')),
  CONSTRAINT mcp_invocations_execution_status_chk CHECK (execution_status IN ('pending','running','success','failed','cancelled','blocked')),
  CONSTRAINT mcp_invocations_risk_level_chk CHECK (risk_level IN ('low','medium','high','critical')),
  CONSTRAINT mcp_invocations_execution_mode_chk CHECK (execution_mode IN ('read_only','suggestion_only','approval_required','automatic_controlled')),
  CONSTRAINT mcp_invocations_volts_chk CHECK (volts_consumed >= 0)
);

CREATE INDEX idx_mcp_tool_invocations_organization_id ON public.mcp_tool_invocations(organization_id);
CREATE INDEX idx_mcp_tool_invocations_agent_id ON public.mcp_tool_invocations(agent_id);
CREATE INDEX idx_mcp_tool_invocations_user_id ON public.mcp_tool_invocations(user_id);
CREATE INDEX idx_mcp_tool_invocations_tool_id ON public.mcp_tool_invocations(tool_id);
CREATE INDEX idx_mcp_tool_invocations_tool_slug ON public.mcp_tool_invocations(tool_slug);
CREATE INDEX idx_mcp_tool_invocations_execution_status ON public.mcp_tool_invocations(execution_status);
CREATE INDEX idx_mcp_tool_invocations_approval_status ON public.mcp_tool_invocations(approval_status);
CREATE INDEX idx_mcp_tool_invocations_created_at ON public.mcp_tool_invocations(created_at DESC);

-- ============================================================
-- 7. mcp_audit_logs
-- ============================================================
CREATE TABLE public.mcp_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  user_id uuid NULL,
  agent_id uuid NULL REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  action text NOT NULL,
  before_json jsonb NULL,
  after_json jsonb NULL,
  ip_address text NULL,
  user_agent text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_audit_logs_organization_id ON public.mcp_audit_logs(organization_id);
CREATE INDEX idx_mcp_audit_logs_user_id ON public.mcp_audit_logs(user_id);
CREATE INDEX idx_mcp_audit_logs_agent_id ON public.mcp_audit_logs(agent_id);
CREATE INDEX idx_mcp_audit_logs_entity_type ON public.mcp_audit_logs(entity_type);
CREATE INDEX idx_mcp_audit_logs_entity_id ON public.mcp_audit_logs(entity_id);
CREATE INDEX idx_mcp_audit_logs_action ON public.mcp_audit_logs(action);
CREATE INDEX idx_mcp_audit_logs_created_at ON public.mcp_audit_logs(created_at DESC);

-- ============================================================
-- 8. mcp_registry_settings
-- ============================================================
CREATE TABLE public.mcp_registry_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  is_mcp_enabled boolean NOT NULL DEFAULT false,
  allow_external_servers boolean NOT NULL DEFAULT false,
  default_requires_approval boolean NOT NULL DEFAULT true,
  default_daily_call_limit integer NOT NULL DEFAULT 100,
  log_retention_days integer NOT NULL DEFAULT 180,
  created_by uuid NULL,
  updated_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_registry_settings_daily_limit_chk CHECK (default_daily_call_limit > 0),
  CONSTRAINT mcp_registry_settings_retention_chk CHECK (log_retention_days > 0)
);

CREATE UNIQUE INDEX idx_mcp_registry_settings_org ON public.mcp_registry_settings(organization_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER trg_mcp_servers_updated_at BEFORE UPDATE ON public.mcp_servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mcp_tools_updated_at BEFORE UPDATE ON public.mcp_tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mcp_resources_updated_at BEFORE UPDATE ON public.mcp_resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mcp_prompts_updated_at BEFORE UPDATE ON public.mcp_prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mcp_permissions_updated_at BEFORE UPDATE ON public.mcp_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mcp_registry_settings_updated_at BEFORE UPDATE ON public.mcp_registry_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tool_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_registry_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES — mcp_servers
-- ============================================================
CREATE POLICY "mcp_servers_select" ON public.mcp_servers FOR SELECT TO authenticated
USING (organization_id IS NULL OR public.user_is_org_member(organization_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "mcp_servers_insert" ON public.mcp_servers FOR INSERT TO authenticated
WITH CHECK (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_servers_update" ON public.mcp_servers FOR UPDATE TO authenticated
USING (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_servers_no_delete" ON public.mcp_servers FOR DELETE TO authenticated USING (false);

-- ============================================================
-- RLS POLICIES — mcp_tools
-- ============================================================
CREATE POLICY "mcp_tools_select" ON public.mcp_tools FOR SELECT TO authenticated
USING (organization_id IS NULL OR public.user_is_org_member(organization_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "mcp_tools_insert" ON public.mcp_tools FOR INSERT TO authenticated
WITH CHECK (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_tools_update" ON public.mcp_tools FOR UPDATE TO authenticated
USING (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_tools_no_delete" ON public.mcp_tools FOR DELETE TO authenticated USING (false);

-- ============================================================
-- RLS POLICIES — mcp_resources
-- ============================================================
CREATE POLICY "mcp_resources_select" ON public.mcp_resources FOR SELECT TO authenticated
USING (organization_id IS NULL OR public.user_is_org_member(organization_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "mcp_resources_insert" ON public.mcp_resources FOR INSERT TO authenticated
WITH CHECK (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_resources_update" ON public.mcp_resources FOR UPDATE TO authenticated
USING (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_resources_no_delete" ON public.mcp_resources FOR DELETE TO authenticated USING (false);

-- ============================================================
-- RLS POLICIES — mcp_prompts
-- ============================================================
CREATE POLICY "mcp_prompts_select" ON public.mcp_prompts FOR SELECT TO authenticated
USING (organization_id IS NULL OR public.user_is_org_member(organization_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "mcp_prompts_insert" ON public.mcp_prompts FOR INSERT TO authenticated
WITH CHECK (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_prompts_update" ON public.mcp_prompts FOR UPDATE TO authenticated
USING (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_prompts_no_delete" ON public.mcp_prompts FOR DELETE TO authenticated USING (false);

-- ============================================================
-- RLS POLICIES — mcp_permissions (admin-only, no globals)
-- ============================================================
CREATE POLICY "mcp_permissions_select" ON public.mcp_permissions FOR SELECT TO authenticated
USING (public.user_is_org_admin(organization_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "mcp_permissions_insert" ON public.mcp_permissions FOR INSERT TO authenticated
WITH CHECK (public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_permissions_update" ON public.mcp_permissions FOR UPDATE TO authenticated
USING (public.user_is_org_admin(organization_id))
WITH CHECK (public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_permissions_no_delete" ON public.mcp_permissions FOR DELETE TO authenticated USING (false);

-- ============================================================
-- RLS POLICIES — mcp_tool_invocations (read-only from frontend)
-- ============================================================
CREATE POLICY "mcp_tool_invocations_select" ON public.mcp_tool_invocations FOR SELECT TO authenticated
USING (
  public.user_is_org_admin(organization_id)
  OR public.is_platform_admin(auth.uid())
  OR (public.user_is_org_member(organization_id) AND user_id = auth.uid())
);

CREATE POLICY "mcp_tool_invocations_no_insert" ON public.mcp_tool_invocations FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "mcp_tool_invocations_no_update" ON public.mcp_tool_invocations FOR UPDATE TO authenticated USING (false);
CREATE POLICY "mcp_tool_invocations_no_delete" ON public.mcp_tool_invocations FOR DELETE TO authenticated USING (false);

-- ============================================================
-- RLS POLICIES — mcp_audit_logs (immutable from frontend)
-- ============================================================
CREATE POLICY "mcp_audit_logs_select" ON public.mcp_audit_logs FOR SELECT TO authenticated
USING (
  (organization_id IS NOT NULL AND public.user_is_org_admin(organization_id))
  OR public.is_platform_admin(auth.uid())
);

CREATE POLICY "mcp_audit_logs_no_insert" ON public.mcp_audit_logs FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "mcp_audit_logs_no_update" ON public.mcp_audit_logs FOR UPDATE TO authenticated USING (false);
CREATE POLICY "mcp_audit_logs_no_delete" ON public.mcp_audit_logs FOR DELETE TO authenticated USING (false);

-- ============================================================
-- RLS POLICIES — mcp_registry_settings (admin-only per org)
-- ============================================================
CREATE POLICY "mcp_registry_settings_select" ON public.mcp_registry_settings FOR SELECT TO authenticated
USING (public.user_is_org_admin(organization_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "mcp_registry_settings_insert" ON public.mcp_registry_settings FOR INSERT TO authenticated
WITH CHECK (public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_registry_settings_update" ON public.mcp_registry_settings FOR UPDATE TO authenticated
USING (public.user_is_org_admin(organization_id))
WITH CHECK (public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_registry_settings_no_delete" ON public.mcp_registry_settings FOR DELETE TO authenticated USING (false);

-- ============================================================
-- COMMENTS (documentação inline)
-- ============================================================
COMMENT ON TABLE public.mcp_servers IS 'MCP Registry: servidores MCP (internos/externos). organization_id NULL = registro global da plataforma.';
COMMENT ON TABLE public.mcp_tools IS 'MCP Registry: catálogo de ferramentas expostas por servers. Nascem desabilitadas e exigindo aprovação por padrão.';
COMMENT ON TABLE public.mcp_resources IS 'MCP Registry: recursos de leitura disponíveis (CRM, sales, proposal, etc).';
COMMENT ON TABLE public.mcp_prompts IS 'MCP Registry: templates/prompts versionados para agentes e workflows.';
COMMENT ON TABLE public.mcp_permissions IS 'MCP Registry: matriz de permissões (agent/role/user) x (tool/resource/prompt). Apenas admins gerenciam.';
COMMENT ON TABLE public.mcp_tool_invocations IS 'MCP Registry: log de invocações de tools (simulated/real). INSERT/UPDATE bloqueados pelo frontend — escrita futura via RPC SECURITY DEFINER.';
COMMENT ON TABLE public.mcp_audit_logs IS 'MCP Registry: trilha de auditoria imutável. INSERT/UPDATE/DELETE bloqueados pelo frontend — escrita futura via trigger/RPC interno.';
COMMENT ON TABLE public.mcp_registry_settings IS 'MCP Registry: configuração por organização (1:1). Define se o MCP está habilitado e políticas default.';