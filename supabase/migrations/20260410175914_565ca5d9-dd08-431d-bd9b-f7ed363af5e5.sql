
-- 1. ai_agent_execution_runs
CREATE TABLE public.ai_agent_execution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  trigger_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  scenario_label text,
  execution_mode text NOT NULL DEFAULT 'controlled_live',
  execution_status text NOT NULL DEFAULT 'queued',
  approval_status text NOT NULL DEFAULT 'not_required',
  decision_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  tool_plan_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_preview_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_tokens integer,
  estimated_cost numeric(12,6),
  execution_time_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_execution_runs_entity_type_check CHECK (entity_type IN ('lead','contact','account','opportunity','proposal','activity')),
  CONSTRAINT ai_agent_execution_runs_mode_check CHECK (execution_mode IN ('controlled_live','approval_pending','blocked')),
  CONSTRAINT ai_agent_execution_runs_status_check CHECK (execution_status IN ('queued','running','awaiting_approval','approved','executed','skipped','blocked','failed','cancelled')),
  CONSTRAINT ai_agent_execution_runs_approval_check CHECK (approval_status IN ('not_required','pending','approved','rejected'))
);

CREATE INDEX idx_exec_runs_org ON public.ai_agent_execution_runs(organization_id);
CREATE INDEX idx_exec_runs_agent ON public.ai_agent_execution_runs(agent_id);
CREATE INDEX idx_exec_runs_version ON public.ai_agent_execution_runs(agent_version_id);
CREATE INDEX idx_exec_runs_status ON public.ai_agent_execution_runs(execution_status);
CREATE INDEX idx_exec_runs_created ON public.ai_agent_execution_runs(created_at DESC);
CREATE INDEX idx_exec_runs_entity ON public.ai_agent_execution_runs(entity_type, entity_id);

ALTER TABLE public.ai_agent_execution_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_exec_runs" ON public.ai_agent_execution_runs
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_insert_exec_runs" ON public.ai_agent_execution_runs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_update_exec_runs" ON public.ai_agent_execution_runs
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 2. ai_agent_execution_actions
CREATE TABLE public.ai_agent_execution_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.ai_agent_execution_runs(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  tool_key text NOT NULL,
  action_type text NOT NULL,
  action_status text NOT NULL DEFAULT 'planned',
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_reference text,
  requires_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_execution_actions_status_check CHECK (action_status IN ('planned','pending_approval','approved','executed','failed','cancelled'))
);

CREATE INDEX idx_exec_actions_run ON public.ai_agent_execution_actions(run_id);
CREATE INDEX idx_exec_actions_org ON public.ai_agent_execution_actions(organization_id);

ALTER TABLE public.ai_agent_execution_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_exec_actions" ON public.ai_agent_execution_actions
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_insert_exec_actions" ON public.ai_agent_execution_actions
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_update_exec_actions" ON public.ai_agent_execution_actions
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 3. ai_email_messages
CREATE TABLE public.ai_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.ai_agent_execution_runs(id) ON DELETE CASCADE,
  action_id uuid REFERENCES public.ai_agent_execution_actions(id),
  opportunity_id uuid,
  account_id uuid,
  contact_id uuid,
  proposal_id uuid,
  activity_id uuid,
  sender_user_id uuid,
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  preview_text text,
  body_text text,
  body_html text,
  cta_text text,
  email_purpose text,
  send_status text NOT NULL DEFAULT 'draft',
  delivery_status text NOT NULL DEFAULT 'pending',
  gmail_message_id text,
  smtp_message_id text,
  sent_at timestamptz,
  was_human_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_email_messages_send_status_check CHECK (send_status IN ('draft','pending_approval','approved','sent','failed','cancelled')),
  CONSTRAINT ai_email_messages_delivery_status_check CHECK (delivery_status IN ('pending','queued','sent','delivered','opened','replied','bounced','failed'))
);

CREATE INDEX idx_email_messages_org ON public.ai_email_messages(organization_id);
CREATE INDEX idx_email_messages_run ON public.ai_email_messages(run_id);
CREATE INDEX idx_email_messages_opp ON public.ai_email_messages(opportunity_id);

ALTER TABLE public.ai_email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_email_msgs" ON public.ai_email_messages
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_insert_email_msgs" ON public.ai_email_messages
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_update_email_msgs" ON public.ai_email_messages
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 4. ai_email_delivery_events
CREATE TABLE public.ai_email_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_message_id uuid NOT NULL REFERENCES public.ai_email_messages(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  provider text,
  provider_message_id text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_email_delivery_events_type_check CHECK (event_type IN ('queued','sent','delivered','opened','replied','bounced','failed'))
);

CREATE INDEX idx_email_delivery_msg ON public.ai_email_delivery_events(email_message_id);
CREATE INDEX idx_email_delivery_org ON public.ai_email_delivery_events(organization_id);

ALTER TABLE public.ai_email_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_delivery_events" ON public.ai_email_delivery_events
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_insert_delivery_events" ON public.ai_email_delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 5. ai_agent_approval_queue
CREATE TABLE public.ai_agent_approval_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.ai_agent_execution_runs(id) ON DELETE CASCADE,
  action_id uuid REFERENCES public.ai_agent_execution_actions(id),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  approval_type text NOT NULL DEFAULT 'send_email',
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  rejected_by uuid REFERENCES public.profiles(id),
  approval_reason text,
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_approval_queue_status_check CHECK (status IN ('pending','approved','rejected','expired')),
  CONSTRAINT ai_agent_approval_queue_type_check CHECK (approval_type IN ('send_email','critical_tool','policy_exception'))
);

CREATE INDEX idx_approval_queue_org ON public.ai_agent_approval_queue(organization_id);
CREATE INDEX idx_approval_queue_status ON public.ai_agent_approval_queue(status);
CREATE INDEX idx_approval_queue_run ON public.ai_agent_approval_queue(run_id);

ALTER TABLE public.ai_agent_approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_approval" ON public.ai_agent_approval_queue
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_insert_approval" ON public.ai_agent_approval_queue
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_update_approval" ON public.ai_agent_approval_queue
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 6. ai_agent_impact_events
CREATE TABLE public.ai_agent_impact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id uuid NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.ai_agent_execution_runs(id) ON DELETE CASCADE,
  opportunity_id uuid,
  account_id uuid,
  contact_id uuid,
  impact_type text NOT NULL,
  impact_value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_impact_events_type_check CHECK (impact_type IN ('timeline_logged','email_sent','email_opened','email_replied','activity_completed','opportunity_advanced','opportunity_reactivated','deal_influenced'))
);

CREATE INDEX idx_impact_events_org ON public.ai_agent_impact_events(organization_id);
CREATE INDEX idx_impact_events_run ON public.ai_agent_impact_events(run_id);
CREATE INDEX idx_impact_events_opp ON public.ai_agent_impact_events(opportunity_id);

ALTER TABLE public.ai_agent_impact_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_impact" ON public.ai_agent_impact_events
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_insert_impact" ON public.ai_agent_impact_events
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
