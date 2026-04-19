-- =====================================================
-- SPRINT 1.5 — PRODUCTION HARDENING DO EMAIL AGENT
-- =====================================================

-- 1. POLICY GRANULAR — adicionar 3 colunas JSONB em ai_agent_escalation_policies
ALTER TABLE public.ai_agent_escalation_policies
  ADD COLUMN IF NOT EXISTS auto_send_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS require_approval_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS block_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ai_agent_escalation_policies.auto_send_rules IS 'Regras pra auto-envio: { confidence_min, deal_value_max, risk_max }';
COMMENT ON COLUMN public.ai_agent_escalation_policies.require_approval_rules IS 'Regras pra exigir aprovação: { deal_value_min, risk_min, confidence_max }';
COMMENT ON COLUMN public.ai_agent_escalation_policies.block_rules IS 'Regras pra bloquear envio: { last_contact_hours_min, max_emails_window_7d }';

-- 2. MEMORY — adicionar suporte a recent_interactions
ALTER TABLE public.ai_agent_memory_profiles
  ADD COLUMN IF NOT EXISTS recent_interactions_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recent_interactions_lookback_hours INTEGER NOT NULL DEFAULT 72;

-- 3. OUTCOMES — tabela ponte run → email → progressão
CREATE TABLE IF NOT EXISTS public.ai_agent_run_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_version_id UUID NOT NULL REFERENCES public.ai_agent_versions(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.ai_agent_execution_runs(id) ON DELETE CASCADE,
  email_message_id UUID REFERENCES public.ai_email_messages(id) ON DELETE SET NULL,
  opportunity_id UUID,
  account_id UUID,
  contact_id UUID,
  
  -- Outcome timestamps
  email_sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  deal_progressed_at TIMESTAMP WITH TIME ZONE,
  deal_won_at TIMESTAMP WITH TIME ZONE,
  deal_lost_at TIMESTAMP WITH TIME ZONE,
  
  -- Attribution metadata
  attribution_window_days INTEGER NOT NULL DEFAULT 7,
  attribution_closes_at TIMESTAMP WITH TIME ZONE,
  computed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(run_id)
);

CREATE INDEX IF NOT EXISTS idx_run_outcomes_org ON public.ai_agent_run_outcomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_run_outcomes_agent ON public.ai_agent_run_outcomes(agent_id);
CREATE INDEX IF NOT EXISTS idx_run_outcomes_opp ON public.ai_agent_run_outcomes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_run_outcomes_attribution ON public.ai_agent_run_outcomes(attribution_closes_at) WHERE computed_at IS NULL;

ALTER TABLE public.ai_agent_run_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_run_outcomes"
  ON public.ai_agent_run_outcomes
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger pra updated_at
CREATE OR REPLACE FUNCTION public.update_run_outcomes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_run_outcomes_updated_at ON public.ai_agent_run_outcomes;
CREATE TRIGGER trg_run_outcomes_updated_at
  BEFORE UPDATE ON public.ai_agent_run_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_run_outcomes_updated_at();

-- 4. POPULAR cooldown do Email Agent (b48649bd-534b-4557-845f-3eeef18b0ca0 / org d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d)
INSERT INTO public.ai_email_cooldown_policies (
  organization_id, agent_id,
  min_hours_between_emails_per_contact,
  min_hours_between_emails_per_opportunity,
  min_hours_between_same_subject,
  min_hours_between_same_purpose,
  max_emails_per_contact_7d,
  max_emails_per_opportunity_7d,
  max_emails_per_account_7d,
  stop_if_recent_bounce,
  stop_if_opt_out,
  stop_if_manual_contact_recent_hours,
  respect_business_hours,
  allowed_weekdays_json,
  daily_send_window_start,
  daily_send_window_end,
  timezone
)
SELECT
  'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d'::uuid,
  'b48649bd-534b-4557-845f-3eeef18b0ca0'::uuid,
  48, 24, 72, 48, 3, 4, 6, true, true, 24, true,
  '[1,2,3,4,5]'::jsonb,
  '09:00:00'::time, '18:00:00'::time,
  'America/Sao_Paulo'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_email_cooldown_policies
  WHERE agent_id = 'b48649bd-534b-4557-845f-3eeef18b0ca0'::uuid
    AND applies_to_pipeline_id IS NULL
    AND applies_to_stage_id IS NULL
);

-- 5. POPULAR policy granular do Email Agent (atualiza linha existente da escalation policy)
UPDATE public.ai_agent_escalation_policies
SET
  auto_send_rules = jsonb_build_object(
    'confidence_min', 0.85,
    'deal_value_max', 50000,
    'risk_max', 0.5
  ),
  require_approval_rules = jsonb_build_object(
    'deal_value_min', 50000,
    'risk_min', 0.6,
    'confidence_max', 0.85
  ),
  block_rules = jsonb_build_object(
    'last_contact_hours_min', 24,
    'max_emails_window_7d', 4
  ),
  updated_at = now()
WHERE agent_id = 'b48649bd-534b-4557-845f-3eeef18b0ca0'::uuid;

-- 6. POPULAR memory profile do Email Agent
UPDATE public.ai_agent_memory_profiles
SET
  recent_interactions_enabled = true,
  recent_interactions_lookback_hours = 72,
  updated_at = now()
WHERE agent_id = 'b48649bd-534b-4557-845f-3eeef18b0ca0'::uuid;