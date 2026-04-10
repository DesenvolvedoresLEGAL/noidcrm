
-- 1. Alter ai_agent_versions
ALTER TABLE public.ai_agent_versions
ADD COLUMN IF NOT EXISTS builder_status text NOT NULL DEFAULT 'incomplete',
ADD COLUMN IF NOT EXISTS config_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS validation_json jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.ai_agent_versions
  ADD CONSTRAINT ai_agent_versions_builder_status_check
  CHECK (builder_status IN ('incomplete', 'draft_ready', 'review_required', 'publish_ready'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ai_agent_triggers
CREATE TABLE IF NOT EXISTS public.ai_agent_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  trigger_kind text NOT NULL,
  trigger_name text NOT NULL,
  entity_type text,
  event_name text,
  schedule_cron text,
  condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_triggers_kind_check CHECK (trigger_kind IN ('event', 'schedule', 'condition', 'hybrid')),
  CONSTRAINT ai_agent_triggers_entity_type_check CHECK (
    entity_type IS NULL OR entity_type IN (
      'lead','contact','account','opportunity','proposal',
      'activity','pipeline','forecast','playbook','external_signal'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_triggers_agent ON public.ai_agent_triggers(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_triggers_version ON public.ai_agent_triggers(agent_version_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_triggers_kind ON public.ai_agent_triggers(trigger_kind);
CREATE INDEX IF NOT EXISTS idx_ai_agent_triggers_event ON public.ai_agent_triggers(event_name);

ALTER TABLE public.ai_agent_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_triggers" ON public.ai_agent_triggers
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_insert_triggers" ON public.ai_agent_triggers
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_update_triggers" ON public.ai_agent_triggers
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_delete_triggers" ON public.ai_agent_triggers
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- 3. ai_tools_registry (global catalog)
CREATE TABLE IF NOT EXISTS public.ai_tools_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  entity_scope text[] NOT NULL DEFAULT '{}',
  action_type text NOT NULL,
  input_schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'medium',
  requires_approval_by_default boolean NOT NULL DEFAULT false,
  supports_autonomous boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tools_registry_risk_check CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_ai_tools_registry_category ON public.ai_tools_registry(category);
CREATE INDEX IF NOT EXISTS idx_ai_tools_registry_action_type ON public.ai_tools_registry(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_tools_registry_active ON public.ai_tools_registry(is_active);

ALTER TABLE public.ai_tools_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_tools_registry" ON public.ai_tools_registry
  FOR SELECT TO authenticated USING (true);

-- 4. ai_agent_tools
CREATE TABLE IF NOT EXISTS public.ai_agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.ai_tools_registry(id) ON DELETE RESTRICT,
  is_enabled boolean NOT NULL DEFAULT true,
  execution_mode text NOT NULL DEFAULT 'allowed',
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  guardrails_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_tools_execution_mode_check CHECK (execution_mode IN ('allowed', 'approval_required', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_agent ON public.ai_agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_version ON public.ai_agent_tools(agent_version_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tools_tool ON public.ai_agent_tools(tool_id);

ALTER TABLE public.ai_agent_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_agent_tools" ON public.ai_agent_tools
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_insert_agent_tools" ON public.ai_agent_tools
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_update_agent_tools" ON public.ai_agent_tools
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_delete_agent_tools" ON public.ai_agent_tools
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- 5. ai_agent_memory_profiles
CREATE TABLE IF NOT EXISTS public.ai_agent_memory_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  short_term_enabled boolean NOT NULL DEFAULT true,
  operational_memory_enabled boolean NOT NULL DEFAULT false,
  learning_memory_enabled boolean NOT NULL DEFAULT false,
  short_term_window integer NOT NULL DEFAULT 10,
  context_sources_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_policy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agent_memory_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_memory" ON public.ai_agent_memory_profiles
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_insert_memory" ON public.ai_agent_memory_profiles
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_update_memory" ON public.ai_agent_memory_profiles
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_delete_memory" ON public.ai_agent_memory_profiles
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- 6. ai_agent_rulesets
CREATE TABLE IF NOT EXISTS public.ai_agent_rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  rules_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_constraints_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_controls_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agent_rulesets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_rulesets" ON public.ai_agent_rulesets
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_insert_rulesets" ON public.ai_agent_rulesets
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_update_rulesets" ON public.ai_agent_rulesets
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_delete_rulesets" ON public.ai_agent_rulesets
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- 7. ai_agent_prompt_layers
CREATE TABLE IF NOT EXISTS public.ai_agent_prompt_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  system_prompt text,
  role_prompt text,
  context_builder_prompt text,
  deliberation_prompt text,
  generation_prompt text,
  review_prompt text,
  output_contract_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  style_rules_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  forbidden_patterns_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agent_prompt_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_prompt_layers" ON public.ai_agent_prompt_layers
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_insert_prompt_layers" ON public.ai_agent_prompt_layers
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_update_prompt_layers" ON public.ai_agent_prompt_layers
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_delete_prompt_layers" ON public.ai_agent_prompt_layers
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- 8. ai_agent_escalation_policies
CREATE TABLE IF NOT EXISTS public.ai_agent_escalation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  escalation_mode text NOT NULL DEFAULT 'conditional',
  confidence_threshold numeric(5,4),
  risk_threshold text,
  escalation_targets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_rules_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  fallback_actions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_escalation_mode_check CHECK (escalation_mode IN ('never', 'always', 'conditional'))
);

ALTER TABLE public.ai_agent_escalation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_escalation" ON public.ai_agent_escalation_policies
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_insert_escalation" ON public.ai_agent_escalation_policies
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_update_escalation" ON public.ai_agent_escalation_policies
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_member_delete_escalation" ON public.ai_agent_escalation_policies
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- 9. Seed tools registry
INSERT INTO public.ai_tools_registry (key, name, description, category, entity_scope, action_type, risk_level, requires_approval_by_default, supports_autonomous)
VALUES
  ('read_opportunity', 'Ler oportunidade', 'Lê dados da oportunidade e contexto relacionado', 'read', ARRAY['opportunity'], 'read', 'low', false, true),
  ('read_account', 'Ler conta', 'Consulta conta e histórico comercial', 'read', ARRAY['account'], 'read', 'low', false, true),
  ('read_contact', 'Ler contato', 'Consulta dados do contato', 'read', ARRAY['contact'], 'read', 'low', false, true),
  ('read_proposal', 'Ler proposta', 'Consulta proposta e status de visualização', 'read', ARRAY['proposal'], 'read', 'low', false, true),
  ('read_activity_history', 'Ler histórico de atividades', 'Consulta histórico relevante de atividades', 'read', ARRAY['activity','opportunity','contact'], 'read', 'low', false, true),
  ('read_pipeline_context', 'Ler contexto do pipeline', 'Consulta estágio e métricas do pipeline', 'read', ARRAY['pipeline','opportunity'], 'read', 'low', false, true),
  ('read_forecast_snapshot', 'Ler snapshot de forecast', 'Consulta previsão de receita atual', 'read', ARRAY['forecast'], 'read', 'low', false, true),
  ('create_activity', 'Criar atividade', 'Cria atividade no CRM', 'write', ARRAY['activity','opportunity'], 'write', 'medium', false, true),
  ('update_opportunity_field', 'Atualizar campo da oportunidade', 'Atualiza campos permitidos da oportunidade', 'write', ARRAY['opportunity'], 'write', 'high', true, false),
  ('update_contact_field', 'Atualizar campo do contato', 'Atualiza campos permitidos do contato', 'write', ARRAY['contact'], 'write', 'high', true, false),
  ('send_email', 'Enviar email', 'Dispara email usando canal configurado', 'communication', ARRAY['contact','opportunity','proposal'], 'send', 'high', true, false),
  ('log_internal_note', 'Registrar nota interna', 'Escreve nota interna no CRM', 'write', ARRAY['opportunity','account'], 'write', 'low', false, true),
  ('suggest_next_action', 'Sugerir próxima ação', 'Gera recomendação operacional', 'assist', ARRAY['opportunity','pipeline'], 'assist', 'low', false, true)
ON CONFLICT (key) DO NOTHING;
