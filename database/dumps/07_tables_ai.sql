-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 07_tables_ai.sql
-- Generated: 2026-01-07
-- Description: AI tables - Scores, Suggestions, Playbooks, Runs
-- ============================================================

-- See full schema in src/integrations/supabase/types.ts
-- Key tables: ai_actions, ai_alerts, ai_feedback, ai_forecast_logs,
-- ai_playbooks, ai_runs, ai_scores, ai_suggestions, ai_usage_logs,
-- memories, memory_reads, lead_emotional_memory

-- ==========================================
-- AI_SCORES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ai_scores (
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
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
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
CREATE TABLE IF NOT EXISTS public.ai_playbooks (
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
  version integer DEFAULT 1,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ai_playbooks ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- MEMORIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.memories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  memory_type memory_type NOT NULL,
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
