
-- 1. ai_email_cadence_policies
CREATE TABLE public.ai_email_cadence_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid REFERENCES public.ai_agent_versions(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  applies_to_pipeline_id uuid,
  applies_to_stage_id uuid,
  cadence_type text NOT NULL DEFAULT 'stage_based',
  max_steps integer NOT NULL DEFAULT 7,
  stop_on_reply boolean NOT NULL DEFAULT true,
  stop_on_stage_change boolean NOT NULL DEFAULT false,
  stop_on_manual_override boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_email_cadence_policies_type_check CHECK (cadence_type IN ('stage_based','trigger_based','reactivation','hybrid'))
);
ALTER TABLE public.ai_email_cadence_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.ai_email_cadence_policies FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_cadence_policies_agent ON public.ai_email_cadence_policies(agent_id);
CREATE INDEX idx_cadence_policies_org ON public.ai_email_cadence_policies(organization_id);

-- 2. ai_email_cadence_steps
CREATE TABLE public.ai_email_cadence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cadence_policy_id uuid NOT NULL REFERENCES public.ai_email_cadence_policies(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  step_name text NOT NULL,
  email_purpose text NOT NULL,
  objective_primary text,
  objective_secondary text,
  min_delay_hours integer NOT NULL DEFAULT 24,
  max_delay_hours integer,
  trigger_dependency text,
  requires_proposal_view boolean DEFAULT false,
  requires_no_response boolean DEFAULT false,
  requires_open_event boolean DEFAULT false,
  allowed_stage_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_stage_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone_guidance text,
  cta_guidance text,
  angle_guidance text,
  approval_override boolean,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_email_cadence_steps_order_unique UNIQUE (cadence_policy_id, step_order)
);
ALTER TABLE public.ai_email_cadence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.ai_email_cadence_steps FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_cadence_steps_policy ON public.ai_email_cadence_steps(cadence_policy_id);

-- 3. ai_email_cooldown_policies
CREATE TABLE public.ai_email_cooldown_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  applies_to_pipeline_id uuid,
  applies_to_stage_id uuid,
  min_hours_between_emails_per_contact integer NOT NULL DEFAULT 24,
  min_hours_between_emails_per_opportunity integer NOT NULL DEFAULT 24,
  min_hours_between_same_subject integer NOT NULL DEFAULT 72,
  min_hours_between_same_purpose integer NOT NULL DEFAULT 48,
  max_emails_per_contact_7d integer NOT NULL DEFAULT 3,
  max_emails_per_opportunity_7d integer NOT NULL DEFAULT 4,
  max_emails_per_account_7d integer NOT NULL DEFAULT 6,
  stop_if_last_email_unopened_count integer,
  stop_if_recent_bounce boolean NOT NULL DEFAULT true,
  stop_if_opt_out boolean NOT NULL DEFAULT true,
  stop_if_manual_contact_recent_hours integer,
  respect_business_hours boolean NOT NULL DEFAULT true,
  allowed_weekdays_json jsonb NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  daily_send_window_start time,
  daily_send_window_end time,
  timezone text DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_email_cooldown_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.ai_email_cooldown_policies FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_cooldown_policies_agent ON public.ai_email_cooldown_policies(agent_id);

-- 4. ai_email_pipeline_rules
CREATE TABLE public.ai_email_pipeline_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL,
  stage_id uuid,
  is_enabled boolean NOT NULL DEFAULT true,
  allow_email_agent boolean NOT NULL DEFAULT true,
  allowed_email_purposes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_email_purposes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_cadence_policy_id uuid REFERENCES public.ai_email_cadence_policies(id) ON DELETE SET NULL,
  default_cooldown_policy_id uuid REFERENCES public.ai_email_cooldown_policies(id) ON DELETE SET NULL,
  approval_required boolean,
  autonomy_override text,
  priority integer NOT NULL DEFAULT 100,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_email_pipeline_rules_autonomy_check CHECK (autonomy_override IS NULL OR autonomy_override IN ('observer','recommender','assisted','autonomous','multi_agent'))
);
ALTER TABLE public.ai_email_pipeline_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.ai_email_pipeline_rules FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_pipeline_rules_agent ON public.ai_email_pipeline_rules(agent_id);
CREATE INDEX idx_pipeline_rules_pipeline ON public.ai_email_pipeline_rules(pipeline_id);

-- 5. ai_email_cadence_progress
CREATE TABLE public.ai_email_cadence_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL,
  account_id uuid,
  contact_id uuid,
  cadence_policy_id uuid NOT NULL REFERENCES public.ai_email_cadence_policies(id) ON DELETE CASCADE,
  current_step_id uuid REFERENCES public.ai_email_cadence_steps(id) ON DELETE SET NULL,
  current_step_order integer,
  status text NOT NULL DEFAULT 'active',
  last_email_message_id uuid,
  last_email_sent_at timestamptz,
  next_eligible_at timestamptz,
  steps_completed integer NOT NULL DEFAULT 0,
  replies_received integer NOT NULL DEFAULT 0,
  opens_detected integer NOT NULL DEFAULT 0,
  approvals_required_count integer NOT NULL DEFAULT 0,
  human_edits_count integer NOT NULL DEFAULT 0,
  stop_reason text,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_email_cadence_progress_status_check CHECK (status IN ('active','paused','completed','stopped','exhausted'))
);
ALTER TABLE public.ai_email_cadence_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.ai_email_cadence_progress FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_cadence_progress_opp ON public.ai_email_cadence_progress(opportunity_id);
CREATE INDEX idx_cadence_progress_agent ON public.ai_email_cadence_progress(agent_id);
CREATE INDEX idx_cadence_progress_next ON public.ai_email_cadence_progress(next_eligible_at) WHERE status = 'active';

-- 6. ai_email_agent_metrics_daily
CREATE TABLE public.ai_email_agent_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid,
  pipeline_id uuid,
  stage_id uuid,
  seller_id uuid,
  cadence_policy_id uuid,
  emails_generated integer NOT NULL DEFAULT 0,
  emails_sent integer NOT NULL DEFAULT 0,
  emails_approved integer NOT NULL DEFAULT 0,
  emails_rejected integer NOT NULL DEFAULT 0,
  emails_opened integer NOT NULL DEFAULT 0,
  emails_replied integer NOT NULL DEFAULT 0,
  bounced integer NOT NULL DEFAULT 0,
  opportunities_advanced integer NOT NULL DEFAULT 0,
  opportunities_reactivated integer NOT NULL DEFAULT 0,
  influenced_deals integer NOT NULL DEFAULT 0,
  cooldown_blocks integer NOT NULL DEFAULT 0,
  policy_blocks integer NOT NULL DEFAULT 0,
  approval_waits integer NOT NULL DEFAULT 0,
  human_edits integer NOT NULL DEFAULT 0,
  estimated_cost numeric(12,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_email_agent_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.ai_email_agent_metrics_daily FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_metrics_daily_agent_date ON public.ai_email_agent_metrics_daily(agent_id, metric_date);
CREATE INDEX idx_metrics_daily_org_date ON public.ai_email_agent_metrics_daily(organization_id, metric_date);

-- 7. ai_email_agent_outcomes
CREATE TABLE public.ai_email_agent_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid,
  run_id uuid NOT NULL REFERENCES public.ai_agent_execution_runs(id) ON DELETE CASCADE,
  email_message_id uuid,
  opportunity_id uuid,
  account_id uuid,
  contact_id uuid,
  pipeline_id uuid,
  stage_id uuid,
  cadence_policy_id uuid,
  cadence_step_id uuid,
  outcome_type text NOT NULL,
  outcome_value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_email_agent_outcomes_type_check CHECK (outcome_type IN ('email_generated','email_sent','email_opened','email_replied','email_bounced','approval_required','approval_rejected','cooldown_blocked','policy_blocked','cadence_advanced','cadence_stopped','opportunity_advanced','opportunity_reactivated','deal_influenced'))
);
ALTER TABLE public.ai_email_agent_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.ai_email_agent_outcomes FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE INDEX idx_outcomes_agent ON public.ai_email_agent_outcomes(agent_id);
CREATE INDEX idx_outcomes_run ON public.ai_email_agent_outcomes(run_id);
CREATE INDEX idx_outcomes_opp ON public.ai_email_agent_outcomes(opportunity_id);
CREATE INDEX idx_outcomes_type ON public.ai_email_agent_outcomes(outcome_type);
