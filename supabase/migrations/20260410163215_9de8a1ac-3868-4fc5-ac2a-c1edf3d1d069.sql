
-- =============================================
-- Sprint 1.2: Simulator + Dry Run + Validation
-- =============================================

-- 1. ai_agent_simulation_runs
CREATE TABLE public.ai_agent_simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  executed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scenario_type text NOT NULL,
  scenario_source text NOT NULL DEFAULT 'manual',
  scenario_reference_id uuid,
  input_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  deliberation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  tool_plan_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_preview_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_mode text NOT NULL DEFAULT 'dry_run',
  run_status text NOT NULL DEFAULT 'completed',
  total_tokens integer,
  estimated_cost numeric(12,6),
  execution_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_simulation_runs_execution_mode_check CHECK (execution_mode IN ('preview_only', 'dry_run', 'guarded_test')),
  CONSTRAINT ai_agent_simulation_runs_run_status_check CHECK (run_status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_ai_agent_sim_runs_agent ON public.ai_agent_simulation_runs(agent_id);
CREATE INDEX idx_ai_agent_sim_runs_version ON public.ai_agent_simulation_runs(agent_version_id);
CREATE INDEX idx_ai_agent_sim_runs_org ON public.ai_agent_simulation_runs(organization_id);
CREATE INDEX idx_ai_agent_sim_runs_status ON public.ai_agent_simulation_runs(run_status);
CREATE INDEX idx_ai_agent_sim_runs_created ON public.ai_agent_simulation_runs(created_at DESC);

ALTER TABLE public.ai_agent_simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage simulation runs"
  ON public.ai_agent_simulation_runs FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 2. ai_agent_test_scenarios
CREATE TABLE public.ai_agent_test_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  scenario_type text NOT NULL,
  source_type text NOT NULL DEFAULT 'synthetic',
  target_entity_type text,
  target_entity_id uuid,
  input_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_behavior_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_tools_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_constraints_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_template boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_test_scenarios_source_type_check CHECK (source_type IN ('synthetic', 'real_snapshot', 'manual_payload')),
  CONSTRAINT ai_agent_test_scenarios_target_entity_type_check CHECK (
    target_entity_type IS NULL OR target_entity_type IN (
      'lead','contact','account','opportunity','proposal','activity','pipeline','forecast','playbook','external_signal'
    )
  )
);

CREATE INDEX idx_ai_agent_test_scenarios_org ON public.ai_agent_test_scenarios(organization_id);
CREATE INDEX idx_ai_agent_test_scenarios_type ON public.ai_agent_test_scenarios(scenario_type);

ALTER TABLE public.ai_agent_test_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage test scenarios"
  ON public.ai_agent_test_scenarios FOR ALL
  TO authenticated
  USING (
    organization_id IS NULL OR
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

-- Allow reading global templates
CREATE POLICY "anyone can read global templates"
  ON public.ai_agent_test_scenarios FOR SELECT
  TO authenticated
  USING (is_template = true AND organization_id IS NULL);

-- 3. ai_agent_validation_reports
CREATE TABLE public.ai_agent_validation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  simulation_run_id uuid REFERENCES public.ai_agent_simulation_runs(id) ON DELETE SET NULL,
  validation_type text NOT NULL DEFAULT 'assisted',
  overall_status text NOT NULL DEFAULT 'review_required',
  score numeric(5,2),
  blocking_issues_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  readiness_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_validation_reports_overall_status_check CHECK (overall_status IN ('passed', 'review_required', 'blocked'))
);

CREATE INDEX idx_ai_agent_val_reports_agent ON public.ai_agent_validation_reports(agent_id);
CREATE INDEX idx_ai_agent_val_reports_version ON public.ai_agent_validation_reports(agent_version_id);
CREATE INDEX idx_ai_agent_val_reports_org ON public.ai_agent_validation_reports(organization_id);

ALTER TABLE public.ai_agent_validation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage validation reports"
  ON public.ai_agent_validation_reports FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 4. ai_agent_simulation_feedback
CREATE TABLE public.ai_agent_simulation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  simulation_run_id uuid NOT NULL REFERENCES public.ai_agent_simulation_runs(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating integer,
  feedback_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_simulation_feedback_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX idx_ai_agent_sim_feedback_run ON public.ai_agent_simulation_feedback(simulation_run_id);
CREATE INDEX idx_ai_agent_sim_feedback_agent ON public.ai_agent_simulation_feedback(agent_id);

ALTER TABLE public.ai_agent_simulation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage simulation feedback"
  ON public.ai_agent_simulation_feedback FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 5. Seed template scenarios (global, no org)
INSERT INTO public.ai_agent_test_scenarios (name, description, scenario_type, source_type, is_template, input_payload_json) VALUES
('Proposta visualizada sem resposta', 'Proposta foi visualizada pelo contato há 48h mas não houve resposta', 'proposal_no_response', 'synthetic', true,
 '{"trigger":"proposal_viewed","hours_since_view":48,"contact_responded":false,"proposal_status":"sent"}'::jsonb),
('Oportunidade parada há 7 dias', 'Oportunidade sem atividade ou mudança de estágio há 7 dias', 'opportunity_stalled', 'synthetic', true,
 '{"trigger":"opportunity_stalled","days_stalled":7,"last_activity_type":"email","stage":"negotiation"}'::jsonb),
('Atividade de email vencida', 'Atividade de follow-up por email vencida há 2 dias', 'activity_overdue', 'synthetic', true,
 '{"trigger":"activity_due","activity_type":"email","days_overdue":2,"contact_name":"Maria Silva"}'::jsonb),
('Conta VIP com risco elevado', 'Conta VIP com indicadores de risco financeiro elevado', 'vip_risk', 'synthetic', true,
 '{"trigger":"risk_detected","account_type":"vip","risk_score":0.85,"risk_factors":["payment_delay","contract_expiring"]}'::jsonb),
('Contexto insuficiente', 'Cenário sem dados suficientes para decisão do agente', 'insufficient_context', 'synthetic', true,
 '{"trigger":"manual","context_quality":"low","missing_fields":["contact_email","last_activity","proposal_status"]}'::jsonb),
('Cliente recorrente com nova oportunidade', 'Cliente existente abrindo nova oportunidade de negócio', 'recurring_client', 'synthetic', true,
 '{"trigger":"opportunity_created","is_recurring_client":true,"previous_deals":3,"avg_deal_value":15000}'::jsonb),
('Tool crítica exigindo aprovação', 'Cenário onde a tool sugerida requer aprovação obrigatória', 'critical_tool', 'synthetic', true,
 '{"trigger":"stage_changed","suggested_tool":"update_opportunity_field","tool_risk":"high","requires_approval":true}'::jsonb),
('Mudança de estágio com alta confiança', 'Trigger híbrido de mudança de estágio com scoring alto', 'stage_change_confident', 'synthetic', true,
 '{"trigger":"stage_changed","from_stage":"qualification","to_stage":"proposal","confidence":0.92,"signals":["budget_confirmed","decision_maker_engaged"]}'::jsonb);
