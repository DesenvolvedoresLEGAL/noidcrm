-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 07_tables_ai.sql
-- Generated: 2026-01-07
-- Description: AI tables - Scores, Suggestions, Playbooks, Runs
-- ============================================================

-- ==========================================
-- AI_ACTIONS
-- ==========================================
DROP TABLE IF EXISTS public.ai_actions CASCADE;
CREATE TABLE public.ai_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  confidence_score numeric(4,2) DEFAULT 0.5,
  status text DEFAULT 'pending',
  decision_data jsonb DEFAULT '{}'::jsonb,
  context_data jsonb DEFAULT '{}'::jsonb,
  executed_at timestamp with time zone,
  approved_by uuid,
  approved_at timestamp with time zone,
  override_data jsonb,
  override_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI_ALERTS
-- ==========================================
DROP TABLE IF EXISTS public.ai_alerts CASCADE;
CREATE TABLE public.ai_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  alert_type text NOT NULL,
  priority text DEFAULT 'medium',
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  acknowledged_at timestamp with time zone,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI_FEEDBACK
-- ==========================================
DROP TABLE IF EXISTS public.ai_feedback CASCADE;
CREATE TABLE public.ai_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  ai_action_id uuid REFERENCES public.ai_actions(id),
  feedback_type text NOT NULL,
  original_decision jsonb NOT NULL,
  corrected_decision jsonb,
  feedback_reason text,
  feedback_rating integer,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI_FORECAST_LOGS
-- ==========================================
DROP TABLE IF EXISTS public.ai_forecast_logs CASCADE;
CREATE TABLE public.ai_forecast_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  pipeline_id uuid,
  user_id uuid,
  forecast_type text DEFAULT 'pipeline',
  period_start date NOT NULL,
  period_end date NOT NULL,
  pessimistic_value numeric(15,2) DEFAULT 0,
  realistic_value numeric(15,2) DEFAULT 0,
  optimistic_value numeric(15,2) DEFAULT 0,
  actual_value numeric(15,2),
  confidence_score numeric(4,2),
  accuracy_score numeric(4,2),
  factors jsonb DEFAULT '{}'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  ai_reasoning text,
  model_version text,
  input_data jsonb,
  evaluated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_forecast_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI_RUNS
-- ==========================================
DROP TABLE IF EXISTS public.ai_runs CASCADE;
CREATE TABLE public.ai_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  trace_id text NOT NULL,
  feature text NOT NULL,
  run_type text NOT NULL,
  model_used text NOT NULL,
  entity_type text,
  entity_id uuid,
  status text DEFAULT 'running',
  input_context jsonb DEFAULT '{}'::jsonb,
  output_result jsonb,
  tokens_input integer,
  tokens_output integer,
  latency_ms integer,
  volts_consumed numeric(10,4),
  error_message text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI_USAGE_LOGS
-- ==========================================
DROP TABLE IF EXISTS public.ai_usage_logs CASCADE;
CREATE TABLE public.ai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid,
  feature text NOT NULL,
  action text NOT NULL,
  model_used text NOT NULL,
  entity_type text,
  entity_id uuid,
  tokens_input integer,
  tokens_output integer,
  tokens_total integer,
  volts_used numeric(10,4),
  volts_rate numeric(10,6),
  latency_ms integer,
  success boolean DEFAULT true,
  error_message text,
  request_metadata jsonb,
  response_metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI_SCORES
-- ==========================================
DROP TABLE IF EXISTS public.ai_scores CASCADE;
CREATE TABLE public.ai_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  score_type text NOT NULL,
  score numeric(5,2) NOT NULL,
  grade text,
  confidence numeric(4,2),
  factors jsonb,
  reasons jsonb,
  recommendations jsonb,
  next_actions jsonb,
  explanation text,
  model_version text,
  status text DEFAULT 'active',
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(entity_type, entity_id, score_type)
);

ALTER TABLE public.ai_scores ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI_SUGGESTIONS
-- ==========================================
DROP TABLE IF EXISTS public.ai_suggestions CASCADE;
CREATE TABLE public.ai_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  opportunity_id uuid REFERENCES public.opportunities(id),
  entity_type text,
  entity_id text,
  suggestion_type text NOT NULL,
  field_name text,
  current_value jsonb,
  suggested_value jsonb,
  reasoning text,
  confidence_score numeric(4,2),
  status text DEFAULT 'pending',
  action_taken_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI_PLAYBOOKS
-- ==========================================
DROP TABLE IF EXISTS public.ai_playbooks CASCADE;
CREATE TABLE public.ai_playbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  category text,
  target_stage text,
  target_temperature text,
  target_persona text,
  trigger_conditions jsonb DEFAULT '{}'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  success_metrics jsonb,
  is_active boolean DEFAULT true,
  is_ai_generated boolean DEFAULT false,
  success_rate numeric(5,2),
  usage_count integer DEFAULT 0,
  conversion_rate numeric(5,2),
  avg_deal_value numeric(15,2),
  avg_cycle_time_days integer,
  total_revenue_generated numeric(15,2),
  total_cost_hours numeric(10,2),
  roi_score numeric(5,2),
  roi_threshold numeric(5,2),
  min_sample_size integer,
  auto_disabled boolean DEFAULT false,
  disabled_at timestamp with time zone,
  disabled_reason text,
  complexity text,
  estimated_hours numeric(5,2),
  current_version_id uuid,
  version integer DEFAULT 1,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_playbooks ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PLAYBOOK_VERSIONS
-- ==========================================
DROP TABLE IF EXISTS public.playbook_versions CASCADE;
CREATE TABLE public.playbook_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id uuid NOT NULL REFERENCES public.ai_playbooks(id),
  version_number integer NOT NULL,
  name text NOT NULL,
  description text,
  steps jsonb NOT NULL,
  trigger_conditions jsonb DEFAULT '{}'::jsonb,
  success_metrics jsonb,
  change_summary text,
  change_reason text,
  is_active boolean DEFAULT false,
  activated_at timestamp with time zone,
  deactivated_at timestamp with time zone,
  performance_snapshot jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(playbook_id, version_number)
);

ALTER TABLE public.playbook_versions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PLAYBOOK_EXECUTIONS
-- ==========================================
DROP TABLE IF EXISTS public.playbook_executions CASCADE;
CREATE TABLE public.playbook_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  playbook_id uuid NOT NULL REFERENCES public.ai_playbooks(id),
  playbook_version_id uuid REFERENCES public.playbook_versions(id),
  opportunity_id uuid,
  seller_id uuid,
  status text DEFAULT 'running',
  current_step integer DEFAULT 0,
  steps_completed jsonb DEFAULT '[]'::jsonb,
  steps_skipped jsonb DEFAULT '[]'::jsonb,
  context_data jsonb DEFAULT '{}'::jsonb,
  outcome text,
  outcome_data jsonb,
  revenue_generated numeric(15,2),
  hours_invested numeric(10,2),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  paused_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.playbook_executions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ALGORITHM_VERSIONS
-- ==========================================
DROP TABLE IF EXISTS public.algorithm_versions CASCADE;
CREATE TABLE public.algorithm_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  algorithm_type text NOT NULL,
  version text NOT NULL,
  description text,
  weights jsonb DEFAULT '{}'::jsonb,
  inputs jsonb DEFAULT '{}'::jsonb,
  data_sources jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  deprecated_at timestamp with time zone,
  deprecated_reason text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, algorithm_type, version)
);

ALTER TABLE public.algorithm_versions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- MEMORIES
-- ==========================================
DROP TABLE IF EXISTS public.memories CASCADE;
CREATE TABLE public.memories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  memory_type text NOT NULL,
  source_type text,
  source_id uuid,
  content text NOT NULL,
  context jsonb,
  embedding vector(1536),
  relevance_score numeric(4,2),
  usage_count integer DEFAULT 0,
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- MEMORY_READS
-- ==========================================
DROP TABLE IF EXISTS public.memory_reads CASCADE;
CREATE TABLE public.memory_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  memory_id uuid NOT NULL REFERENCES public.memories(id),
  reader_type text NOT NULL,
  reader_id uuid,
  context text,
  relevance_score numeric(4,2),
  was_useful boolean,
  read_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.memory_reads ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- LEAD_EMOTIONAL_MEMORY
-- ==========================================
DROP TABLE IF EXISTS public.lead_emotional_memory CASCADE;
CREATE TABLE public.lead_emotional_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  account_id uuid REFERENCES public.accounts(id),
  contact_id uuid REFERENCES public.contacts(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  interaction_id uuid,
  emotion_detected text NOT NULL,
  confidence numeric(4,2),
  context text,
  triggers jsonb DEFAULT '[]'::jsonb,
  recommended_approach text,
  recorded_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.lead_emotional_memory ENABLE ROW LEVEL SECURITY;
