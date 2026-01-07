-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 05_tables_sales.sql
-- Generated: 2026-01-07
-- Description: Sales Performance - Sellers, Teams, OTE, Commissions
-- ============================================================

-- ==========================================
-- BUSINESS_UNITS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.business_units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  code text,
  description text,
  is_active boolean DEFAULT true,
  parent_id uuid REFERENCES public.business_units(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TEAMS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  manager_user_id uuid,
  business_unit_id uuid REFERENCES public.business_units(id),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TEAM_MEMBERS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  role text DEFAULT 'member',
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLERS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text,
  role seller_role_type DEFAULT 'Closer',
  team_id uuid REFERENCES public.teams(id),
  ote_level_id uuid,
  
  -- Stats
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  streak_days integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  total_roleplay_sessions integer DEFAULT 0,
  avg_roleplay_score numeric(4,2) DEFAULT 0,
  
  -- Status
  is_active boolean DEFAULT true,
  started_at date,
  deactivated_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OTE_LEVELS (Níveis de Comissão)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ote_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  base_salary numeric(15,2) DEFAULT 0,
  variable_target numeric(15,2) DEFAULT 0,
  ote_total numeric(15,2) GENERATED ALWAYS AS (base_salary + variable_target) STORED,
  commission_rate numeric(5,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ote_levels ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OTE_RULES (Regras de Comissão)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ote_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  ote_level_id uuid REFERENCES public.ote_levels(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  rule_type text, -- base, accelerator, decelerator, bonus
  condition_type text, -- quota_percentage, deal_count, activity_score
  condition_operator text, -- gte, lte, eq, between
  condition_value numeric(10,2),
  condition_value_max numeric(10,2),
  multiplier numeric(5,3) DEFAULT 1.0,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ote_rules ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OTE_MULTIPLIERS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ote_multipliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  ote_level_id uuid REFERENCES public.ote_levels(id) ON DELETE CASCADE,
  min_percentage numeric(5,2) NOT NULL,
  max_percentage numeric(5,2),
  multiplier numeric(5,3) NOT NULL DEFAULT 1.0,
  label text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ote_multipliers ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OTE_SELLER_CONFIG
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ote_seller_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  ote_level_id uuid REFERENCES public.ote_levels(id),
  custom_quota numeric(15,2),
  custom_commission_rate numeric(5,2),
  effective_from date,
  effective_until date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ote_seller_config ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OTE_MONTHLY_RESULTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ote_monthly_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  year_month text NOT NULL, -- Format: YYYY-MM
  
  -- Quotas
  quota numeric(15,2) DEFAULT 0,
  revenue_closed numeric(15,2) DEFAULT 0,
  quota_attainment numeric(5,2) DEFAULT 0,
  
  -- Commission
  commission_earned numeric(15,2) DEFAULT 0,
  accelerator_applied numeric(5,3) DEFAULT 1.0,
  
  -- Activity Scores
  activity_score numeric(4,2) DEFAULT 0,
  attendance_rate numeric(5,2) DEFAULT 0,
  
  -- Status
  status text DEFAULT 'open', -- open, locked, paid
  locked_at timestamp with time zone,
  paid_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(seller_id, year_month)
);

ALTER TABLE public.ote_monthly_results ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OTE_SALES_RECORDS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ote_sales_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  year_month text NOT NULL,
  
  -- Values
  value numeric(15,2) NOT NULL,
  commission_value numeric(15,2),
  commission_rate numeric(5,2),
  
  -- Metadata
  closed_at timestamp with time zone,
  product text,
  notes text,
  
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ote_sales_records ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SALES_GOALS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sales_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  pipeline_id uuid REFERENCES public.pipelines(id),
  team_id uuid REFERENCES public.teams(id),
  seller_id uuid REFERENCES public.sellers(id),
  
  -- Period
  period_type text NOT NULL, -- monthly, quarterly, yearly
  period_start date NOT NULL,
  period_end date NOT NULL,
  
  -- Goals
  revenue_goal numeric(15,2),
  deals_goal integer,
  activities_goal integer,
  
  -- Progress
  revenue_current numeric(15,2) DEFAULT 0,
  deals_current integer DEFAULT 0,
  activities_current integer DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SALES_CONFIG
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sales_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  section text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, section, key)
);

ALTER TABLE public.sales_config ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SELLER_TARGETS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.seller_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  year_month text NOT NULL,
  
  -- Targets
  revenue_target numeric(15,2),
  deals_target integer,
  calls_target integer,
  meetings_target integer,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(seller_id, year_month)
);

ALTER TABLE public.seller_targets ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- WIN_LOSS_RECORDS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.win_loss_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  outcome text NOT NULL, -- won, lost
  reason_id uuid,
  reason_category text,
  notes text,
  competitor text,
  deal_value numeric(15,2),
  recorded_by uuid,
  recorded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.win_loss_records ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TERRITORIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.territories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  type text, -- geographic, industry, named_accounts
  criteria jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TERRITORY_ASSIGNMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.territory_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  territory_id uuid NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  role text DEFAULT 'rep', -- rep, manager
  assigned_at timestamp with time zone DEFAULT now(),
  UNIQUE(territory_id, user_id)
);

ALTER TABLE public.territory_assignments ENABLE ROW LEVEL SECURITY;
