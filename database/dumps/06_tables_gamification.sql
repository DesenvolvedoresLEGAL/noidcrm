-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 06_tables_gamification.sql
-- Generated: 2026-01-07
-- Description: Gamification - Badges, Missions, Roleplay, Training
-- ============================================================

-- ==========================================
-- ACHIEVEMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  target_value integer NOT NULL,
  xp_reward integer NOT NULL DEFAULT 100,
  icon text NOT NULL DEFAULT 'trophy',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLER_ACHIEVEMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.seller_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  achievement_id uuid NOT NULL REFERENCES public.achievements(id),
  progress integer DEFAULT 0,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(seller_id, achievement_id)
);

ALTER TABLE public.seller_achievements ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- BADGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  icon text NOT NULL,
  rarity integer NOT NULL DEFAULT 1, -- 1-5
  xp_reward integer NOT NULL DEFAULT 50,
  criteria jsonb DEFAULT '{}'::jsonb,
  target_roles text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLER_BADGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.seller_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  badge_id uuid NOT NULL REFERENCES public.badges(id),
  earned_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(seller_id, badge_id)
);

ALTER TABLE public.seller_badges ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- MISSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  type text NOT NULL, -- daily, weekly, challenge, special
  category text, -- calls, meetings, roleplay, deals
  
  -- Requirements
  target_type text NOT NULL, -- count, streak, score
  target_value integer NOT NULL,
  target_metric text, -- calls_made, meetings_held, deals_won
  
  -- Rewards
  xp_reward integer DEFAULT 0,
  badge_reward_id uuid REFERENCES public.badges(id),
  
  -- Validity
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text, -- daily, weekly
  
  -- Targeting
  target_roles seller_role_type[],
  target_seller_ids uuid[],
  
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLER_MISSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.seller_missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  
  -- Progress
  progress integer DEFAULT 0,
  status text DEFAULT 'active', -- active, completed, expired, claimed
  
  -- Dates
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  expires_at timestamp with time zone,
  claimed_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.seller_missions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- DYNAMIC_MISSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.dynamic_missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  
  -- AI Generated
  name text NOT NULL,
  description text,
  reasoning text,
  
  -- Target
  target_metric text NOT NULL,
  target_value integer NOT NULL,
  current_value integer DEFAULT 0,
  
  -- Rewards
  xp_reward integer DEFAULT 0,
  difficulty text, -- easy, medium, hard
  
  -- Status
  status text DEFAULT 'active',
  completed_at timestamp with time zone,
  expires_at timestamp with time zone,
  
  -- AI Metadata
  generated_by text DEFAULT 'ai',
  ai_confidence numeric(4,2),
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.dynamic_missions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- CLIENT_ARCHETYPES (Personagens de Roleplay)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.client_archetypes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  persona text NOT NULL, -- Descrição do comportamento
  difficulty_level integer DEFAULT 1, -- 1-5
  archetype_level archetype_level_type DEFAULT 'Entrada',
  client_type client_type DEFAULT 'Empresa Contratante',
  tone tone_style_type DEFAULT 'técnico',
  industry text,
  company_size text,
  pain_points text[],
  objections text[],
  buying_signals text[],
  avatar_url text,
  is_active boolean DEFAULT true,
  is_global boolean DEFAULT false, -- Available to all orgs
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.client_archetypes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SIMULATED_CLIENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.simulated_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  archetype_id uuid REFERENCES public.client_archetypes(id),
  name text NOT NULL,
  company_name text,
  role text,
  industry text,
  scenario text NOT NULL, -- Cenário da simulação
  context text, -- Contexto adicional
  initial_message text,
  success_criteria text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.simulated_clients ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ROLEPLAY_SESSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.roleplay_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  simulated_client_id uuid REFERENCES public.simulated_clients(id),
  archetype_id uuid REFERENCES public.client_archetypes(id),
  
  -- Session Info
  scenario_name text,
  status text DEFAULT 'active', -- active, completed, abandoned
  
  -- Scores
  overall_score numeric(4,2),
  rapport_score numeric(4,2),
  discovery_score numeric(4,2),
  objection_handling_score numeric(4,2),
  closing_score numeric(4,2),
  
  -- Feedback
  feedback_summary text,
  strengths text[],
  areas_to_improve text[],
  
  -- Metrics
  message_count integer DEFAULT 0,
  duration_seconds integer,
  
  -- XP
  xp_earned integer DEFAULT 0,
  
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.roleplay_sessions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ROLEPLAY_MESSAGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.roleplay_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.roleplay_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  
  -- Message
  sender_type roleplay_sender_type NOT NULL,
  content text NOT NULL,
  
  -- AI Analysis
  intent_detected text,
  sentiment text,
  technique_used text,
  feedback text,
  score numeric(4,2),
  
  -- Order
  message_index integer NOT NULL,
  
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.roleplay_messages ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- EVALUATION_RUBRICS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.evaluation_rubrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  name text NOT NULL,
  category text NOT NULL, -- rapport, discovery, objection, closing, general
  description text,
  criteria jsonb NOT NULL, -- Array of {name, weight, levels: [{score, description}]}
  max_score integer DEFAULT 100,
  is_active boolean DEFAULT true,
  is_global boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.evaluation_rubrics ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLER_EVALUATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.seller_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  evaluator_id uuid,
  rubric_id uuid REFERENCES public.evaluation_rubrics(id),
  
  -- Scores
  scores jsonb NOT NULL, -- {criterion: score}
  total_score numeric(5,2),
  
  -- Context
  evaluation_type text, -- roleplay, call_review, meeting_review
  reference_id uuid, -- ID of the related entity
  
  -- Feedback
  feedback text,
  action_items text[],
  
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.seller_evaluations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ATTENDANCE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  date date NOT NULL,
  present boolean DEFAULT true,
  training_window text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(seller_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ACCELERATOR_POLICIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.accelerator_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  tier accelerator_tier_type NOT NULL,
  min_attendance_pct numeric(5,2) NOT NULL,
  min_avg_score numeric(4,2) NOT NULL,
  multiplier numeric(4,2) NOT NULL,
  notes text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.accelerator_policies ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PERFORMANCE_ACTIVITIES (Atividades de Performance)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.performance_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  category text, -- calls, meetings, emails, deals, other
  points integer DEFAULT 1,
  is_automated boolean DEFAULT false,
  automation_source text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, code)
);

ALTER TABLE public.performance_activities ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PERFORMANCE_GATES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.performance_gates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  activity_id uuid NOT NULL REFERENCES public.performance_activities(id),
  name text NOT NULL,
  description text,
  gate_type text, -- minimum, target, stretch
  threshold integer NOT NULL,
  multiplier numeric(4,2) DEFAULT 1.0,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.performance_gates ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ACTIVITY_LOGS (Log de Atividades de Performance)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  seller_id uuid REFERENCES public.sellers(id),
  activity_id uuid NOT NULL REFERENCES public.performance_activities(id),
  entity_type text,
  entity_id text,
  quantity integer DEFAULT 1,
  source text, -- manual, automation, sync
  validated boolean DEFAULT false,
  validation_method text,
  metadata jsonb DEFAULT '{}'::jsonb,
  logged_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ACTIVITY_TARGETS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activity_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  activity_id uuid NOT NULL REFERENCES public.performance_activities(id),
  ote_level_id uuid REFERENCES public.ote_levels(id),
  role_name text,
  daily_target integer,
  weekly_target integer,
  monthly_target integer,
  weight_override numeric(4,2),
  calculation_window integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(activity_id, ote_level_id, organization_id)
);

ALTER TABLE public.activity_targets ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- BADGE_PRESERVATION_HISTORY
-- ==========================================
CREATE TABLE IF NOT EXISTS public.badge_preservation_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  badge_id uuid NOT NULL REFERENCES public.badges(id),
  original_earned_at timestamp with time zone NOT NULL,
  preserved_at timestamp with time zone DEFAULT now(),
  preservation_reason text,
  legacy_criteria jsonb,
  new_criteria_met boolean DEFAULT false
);

ALTER TABLE public.badge_preservation_history ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ACTIVITY_MAPPINGS
-- ==========================================
DROP TABLE IF EXISTS public.activity_mappings CASCADE;
CREATE TABLE public.activity_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  legacy_activity_type text NOT NULL,
  legacy_activity_code text,
  new_activity_id uuid REFERENCES public.performance_activities(id),
  mapping_rules jsonb DEFAULT '{}'::jsonb,
  migrated_count integer DEFAULT 0,
  last_migrated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.activity_mappings ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLER_PERFORMANCE_SCORES
-- ==========================================
DROP TABLE IF EXISTS public.seller_performance_scores CASCADE;
CREATE TABLE public.seller_performance_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Conversion Score (CS)
  cs_7d numeric(5,2) DEFAULT 0,
  cs_30d numeric(5,2) DEFAULT 0,
  cs_90d numeric(5,2) DEFAULT 0,
  cs_final numeric(5,2) DEFAULT 0,
  cs_breakdown jsonb DEFAULT '{}'::jsonb,
  cs_explainability jsonb DEFAULT '{}'::jsonb,
  
  -- Behavior Score (BS)
  bs_7d numeric(5,2) DEFAULT 0,
  bs_30d numeric(5,2) DEFAULT 0,
  bs_90d numeric(5,2) DEFAULT 0,
  bs_final numeric(5,2) DEFAULT 0,
  bs_breakdown jsonb DEFAULT '{}'::jsonb,
  bs_explainability jsonb DEFAULT '{}'::jsonb,
  
  -- Development Score (DS)
  ds_7d numeric(5,2) DEFAULT 0,
  ds_30d numeric(5,2) DEFAULT 0,
  ds_90d numeric(5,2) DEFAULT 0,
  ds_final numeric(5,2) DEFAULT 0,
  ds_breakdown jsonb DEFAULT '{}'::jsonb,
  ds_explainability jsonb DEFAULT '{}'::jsonb,
  
  -- Role Alignment Score (RAS)
  ras_final numeric(5,2) DEFAULT 0,
  ras_status text DEFAULT 'aligned',
  ras_breakdown jsonb DEFAULT '{}'::jsonb,
  ras_explainability jsonb DEFAULT '{}'::jsonb,
  
  -- Metadata
  algorithm_version text DEFAULT 'v2.0',
  calculation_inputs jsonb DEFAULT '{}'::jsonb,
  calculated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT seller_performance_scores_ras_status_check CHECK (ras_status = ANY (ARRAY['under_allocated'::text, 'aligned'::text, 'misaligned'::text, 'out_of_position'::text]))
);

ALTER TABLE public.seller_performance_scores ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLER_SCORE_HISTORY
-- ==========================================
DROP TABLE IF EXISTS public.seller_score_history CASCADE;
CREATE TABLE public.seller_score_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  score_type text NOT NULL,
  period_type text NOT NULL,
  score_value numeric(5,2) NOT NULL,
  breakdown jsonb DEFAULT '{}'::jsonb,
  algorithm_version text,
  recorded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT seller_score_history_score_type_check CHECK (score_type = ANY (ARRAY['CS'::text, 'BS'::text, 'DS'::text, 'RAS'::text])),
  CONSTRAINT seller_score_history_period_type_check CHECK (period_type = ANY (ARRAY['7d'::text, '30d'::text, '90d'::text, 'final'::text]))
);

ALTER TABLE public.seller_score_history ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLER_STATS
-- ==========================================
DROP TABLE IF EXISTS public.seller_stats CASCADE;
CREATE TABLE public.seller_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period text NOT NULL, -- YYYY-MM
  
  -- Activity Metrics
  calls_made integer DEFAULT 0,
  meetings_held integer DEFAULT 0,
  proposals_sent integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  
  -- Pipeline Metrics
  opportunities_created integer DEFAULT 0,
  opportunities_won integer DEFAULT 0,
  opportunities_lost integer DEFAULT 0,
  revenue_closed numeric(15,2) DEFAULT 0,
  
  -- Performance Metrics
  avg_deal_size numeric(15,2) DEFAULT 0,
  win_rate numeric(5,2) DEFAULT 0,
  avg_cycle_days integer DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT seller_stats_seller_id_period_key UNIQUE (seller_id, period)
);

ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- DAILY_ACTIVITY_LOG
-- ==========================================
DROP TABLE IF EXISTS public.daily_activity_log CASCADE;
CREATE TABLE public.daily_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  
  -- Activity Counts
  calls_made integer DEFAULT 0,
  leads_generated integer DEFAULT 0,
  proposals_sent integer DEFAULT 0,
  sales_closed integer DEFAULT 0,
  revenue_closed numeric DEFAULT 0,
  outbound_calls integer DEFAULT 0,
  inbound_leads integer DEFAULT 0,
  referral_requests integer DEFAULT 0,
  
  -- Pace
  pace_score text DEFAULT 'pending',
  pace_percentage numeric DEFAULT 0,
  
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT daily_activity_log_organization_id_user_id_log_date_key UNIQUE (organization_id, user_id, log_date)
);

ALTER TABLE public.daily_activity_log ENABLE ROW LEVEL SECURITY;
