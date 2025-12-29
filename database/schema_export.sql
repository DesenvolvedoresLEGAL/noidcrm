-- ============================================================
-- HUMANOID CRM - COMPLETE DATABASE SCHEMA EXPORT
-- Generated: 2024-12-29
-- Supabase PostgreSQL Schema for External Deployment
-- ============================================================
-- 
-- INSTRUCTIONS FOR DEPLOYMENT:
-- 1. Create a new Supabase project (external)
-- 2. Run this SQL in the SQL Editor (Supabase Dashboard > SQL Editor)
-- 3. Execute section by section in order (ENUMs first, then tables, etc.)
-- 4. After running, create a new user and test login
--
-- IMPORTANT: This schema requires Supabase Auth to be enabled
-- ============================================================

-- ============================================================
-- SECTION 1: ENUMS (TIPOS CUSTOMIZADOS)
-- ============================================================

-- Drop existing enums if exist (for clean migration)
DO $$ BEGIN
    -- These may fail if they don't exist, that's fine
    DROP TYPE IF EXISTS accelerator_tier_type CASCADE;
    DROP TYPE IF EXISTS app_role CASCADE;
    DROP TYPE IF EXISTS archetype_level_type CASCADE;
    DROP TYPE IF EXISTS client_type CASCADE;
    DROP TYPE IF EXISTS decision_role_type CASCADE;
    DROP TYPE IF EXISTS graph_edge_type CASCADE;
    DROP TYPE IF EXISTS graph_insight_type CASCADE;
    DROP TYPE IF EXISTS graph_node_type CASCADE;
    DROP TYPE IF EXISTS interaction_channel CASCADE;
    DROP TYPE IF EXISTS interaction_type_enum CASCADE;
    DROP TYPE IF EXISTS memory_type CASCADE;
    DROP TYPE IF EXISTS tipo_pessoa_type CASCADE;
    DROP TYPE IF EXISTS tone_style_type CASCADE;
    DROP TYPE IF EXISTS video_level_type CASCADE;
    DROP TYPE IF EXISTS video_source_type CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Accelerator tiers for gamification
CREATE TYPE accelerator_tier_type AS ENUM ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND');

-- Application roles
CREATE TYPE app_role AS ENUM ('admin', 'manager', 'sales', 'cs');

-- Archetype complexity levels
CREATE TYPE archetype_level_type AS ENUM ('Entrada', 'Intermediário', 'Avançado', 'Enterprise');

-- Client types
CREATE TYPE client_type AS ENUM ('Organizador', 'Expositor', 'Agência', 'Empresa Contratante');

-- Decision roles for contacts
CREATE TYPE decision_role_type AS ENUM ('Decisor', 'Influenciador', 'Usuário-Chave');

-- Knowledge graph edge types
CREATE TYPE graph_edge_type AS ENUM (
    'works_at', 'owns', 'relates_to', 'influences', 
    'communicates_with', 'champions', 'blocks', 
    'participates_in', 'converts_to', 'decision_maker'
);

-- Knowledge graph insight types
CREATE TYPE graph_insight_type AS ENUM (
    'missing_champion', 'missing_decision_maker', 'silent_stakeholder',
    'isolated_deal', 'weak_relationship', 'network_gap',
    'high_centrality', 'engagement_decay'
);

-- Knowledge graph node types
CREATE TYPE graph_node_type AS ENUM (
    'account', 'contact', 'opportunity', 'interaction',
    'proposal', 'contract', 'user'
);

-- Communication channels
CREATE TYPE interaction_channel AS ENUM (
    'email', 'phone', 'whatsapp', 'linkedin', 'meeting',
    'form', 'chat', 'website', 'proposal', 'contract', 'other'
);

-- Interaction event types
CREATE TYPE interaction_type_enum AS ENUM (
    'call_made', 'call_received', 'call_missed',
    'email_sent', 'email_received', 'email_opened', 'email_clicked',
    'meeting_scheduled', 'meeting_held', 'meeting_canceled', 'meeting_no_show',
    'message_sent', 'message_received', 'form_submitted', 'chat_started',
    'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'proposal_rejected',
    'contract_sent', 'contract_signed',
    'linkedin_connection', 'linkedin_message', 'website_visit',
    'demo_requested', 'note_added', 'task_completed', 'other'
);

-- AI memory types
CREATE TYPE memory_type AS ENUM ('objection', 'win_pattern', 'loss_reason', 'competitor_intel', 'best_practice');

-- Person type (PF = Pessoa Física, PJ = Pessoa Jurídica)
CREATE TYPE tipo_pessoa_type AS ENUM ('PF', 'PJ');

-- Tone styles for roleplay
CREATE TYPE tone_style_type AS ENUM ('técnico', 'apressado', 'cético', 'indeciso', 'agressivo', 'metódico');

-- Video training levels
CREATE TYPE video_level_type AS ENUM ('Básico', 'Intermediário', 'Avançado');

-- Video sources
CREATE TYPE video_source_type AS ENUM ('YouTube', 'Vimeo', 'Internal');


-- ============================================================
-- SECTION 2: CORE HELPER FUNCTIONS (Required before tables)
-- ============================================================

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() AND status = 'active' 
  LIMIT 1
$$;

-- Check if user is org member
CREATE OR REPLACE FUNCTION public.user_is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND status = 'active'
  )
$$;

-- Check if user is org admin
CREATE OR REPLACE FUNCTION public.user_is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin')
  )
$$;

-- Check if user can view all records
CREATE OR REPLACE FUNCTION public.can_view_all(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'finance', 'operations', 'cs')
  )
$$;

-- Calculate lead grade from score
CREATE OR REPLACE FUNCTION public.calculate_lead_grade(score integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN CASE
    WHEN score >= 80 THEN 'A'
    WHEN score >= 60 THEN 'B'
    WHEN score >= 40 THEN 'C'
    WHEN score >= 20 THEN 'D'
    ELSE 'F'
  END;
END;
$$;


-- ============================================================
-- SECTION 3: CORE TABLES (Organizations, Profiles, Members)
-- ============================================================

-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    domain TEXT,
    logo_url TEXT,
    status TEXT DEFAULT 'active',
    plan TEXT DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    billing_email TEXT,
    billing_address JSONB,
    default_currency TEXT DEFAULT 'BRL',
    proposal_prefix TEXT DEFAULT 'PROP',
    proposal_sequence INTEGER DEFAULT 1,
    proposal_validity_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    organization_id UUID REFERENCES public.organizations(id),
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    phone TEXT,
    cargo TEXT,
    language TEXT DEFAULT 'pt-BR',
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    notification_preferences JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization members (user-org relationship)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    org_role TEXT NOT NULL DEFAULT 'sales',
    role TEXT,
    status TEXT DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT now(),
    invited_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, organization_id)
);

-- Onboarding status
CREATE TABLE IF NOT EXISTS public.onboarding_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    current_step INTEGER DEFAULT 1,
    steps_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECTION 4: CRM CORE TABLES
-- ============================================================

-- Accounts (Companies/Leads)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    tipo_pessoa tipo_pessoa_type DEFAULT 'PJ',
    cnpj TEXT,
    cpf TEXT,
    rg TEXT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    segmento TEXT,
    cnae TEXT,
    cnaes_secundarios TEXT[],
    tamanho TEXT,
    origem_principal TEXT,
    lifecycle_stage TEXT DEFAULT 'lead',
    lead_score INTEGER,
    lead_grade TEXT,
    fit_score INTEGER,
    intent_score INTEGER,
    scoring_factors JSONB,
    score_updated_at TIMESTAMPTZ,
    owner_user_id UUID,
    cs_user_id UUID,
    created_by UUID,
    -- Address
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    cep TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    -- Legal info
    inscricao_estadual TEXT,
    inscricao_municipal TEXT,
    natureza_juridica TEXT,
    porte TEXT,
    situacao_cadastral TEXT,
    data_situacao_cadastral DATE,
    data_fundacao DATE,
    data_nascimento DATE,
    capital_social NUMERIC,
    opcao_simples BOOLEAN,
    opcao_mei BOOLEAN,
    matriz_filial TEXT,
    tipo_empresa TEXT,
    -- Contact
    emails TEXT[],
    telefones JSONB,
    website TEXT,
    linkedin TEXT,
    instagram TEXT,
    facebook TEXT,
    email_nota_fiscal TEXT,
    -- Extra
    codigo_externo TEXT,
    logo_url TEXT,
    observacoes TEXT,
    pontuacao_nps INTEGER,
    data_tornou_cliente DATE,
    qualified_at TIMESTAMPTZ,
    parent_account_id UUID REFERENCES public.accounts(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Account Partners (Sócios/QSA)
CREATE TABLE IF NOT EXISTS public.account_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    nome_socio TEXT NOT NULL,
    cpf_cnpj_socio TEXT,
    qualificacao TEXT,
    data_entrada DATE,
    faixa_etaria TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    account_id UUID REFERENCES public.accounts(id),
    nome TEXT NOT NULL,
    cargo TEXT,
    departamento TEXT,
    is_decision_maker BOOLEAN DEFAULT false,
    decision_role decision_role_type,
    emails TEXT[],
    telefones JSONB,
    linkedin TEXT,
    foto_url TEXT,
    data_nascimento DATE,
    observacoes TEXT,
    engagement_score INTEGER,
    last_contact_at TIMESTAMPTZ,
    preferred_channel TEXT,
    owner_user_id UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pipelines
CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    pipeline_type TEXT DEFAULT 'sales',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline Stages
CREATE TABLE IF NOT EXISTS public.stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    probability INTEGER DEFAULT 0,
    is_won BOOLEAN DEFAULT false,
    is_lost BOOLEAN DEFAULT false,
    stage_type TEXT,
    sla_days INTEGER,
    auto_actions JSONB,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Opportunities (Deals)
CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    account_id UUID REFERENCES public.accounts(id),
    contact_id UUID REFERENCES public.contacts(id),
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id),
    stage_id UUID NOT NULL REFERENCES public.stages(id),
    owner_user_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open',
    temperature TEXT DEFAULT 'warm',
    valor_previsto NUMERIC DEFAULT 0,
    mrr NUMERIC,
    probability INTEGER,
    expected_close_date DATE,
    actual_close_date DATE,
    loss_reason TEXT,
    loss_reason_detail TEXT,
    win_reason TEXT,
    competitor_id UUID,
    source TEXT,
    campaign_id UUID,
    product_interest TEXT[],
    custom_fields JSONB,
    health_score INTEGER,
    last_activity_at TIMESTAMPTZ,
    days_in_stage INTEGER DEFAULT 0,
    stage_entered_at TIMESTAMPTZ DEFAULT now(),
    qualified_at TIMESTAMPTZ,
    qualified_by_user_id UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activities (Tasks)
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    owner_user_id UUID NOT NULL,
    account_id UUID REFERENCES public.accounts(id),
    contact_id UUID REFERENCES public.contacts(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    scheduled_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    sentiment TEXT,
    is_automated BOOLEAN DEFAULT false,
    ai_generated BOOLEAN DEFAULT false,
    sync_source TEXT,
    sync_provider TEXT,
    external_id TEXT,
    external_link TEXT,
    sync_metadata JSONB,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interactions (Activity Events)
CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    account_id UUID REFERENCES public.accounts(id),
    contact_id UUID REFERENCES public.contacts(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    actor_user_id UUID,
    channel interaction_channel NOT NULL,
    interaction_type interaction_type_enum NOT NULL,
    direction TEXT,
    subject TEXT,
    content TEXT,
    sentiment_score NUMERIC,
    duration_seconds INTEGER,
    metadata JSONB,
    external_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECTION 5: PROPOSALS & CONTRACTS
-- ============================================================

-- Proposals
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    account_id UUID REFERENCES public.accounts(id),
    contact_id UUID REFERENCES public.contacts(id),
    owner_user_id UUID NOT NULL,
    proposal_number TEXT NOT NULL,
    proposal_version INTEGER DEFAULT 1,
    parent_proposal_id UUID REFERENCES public.proposals(id),
    title TEXT,
    status TEXT DEFAULT 'draft',
    valid_until DATE,
    total_amount NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    discount_percentage NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    payment_terms TEXT,
    payment_conditions JSONB,
    introduction TEXT,
    scope TEXT,
    deliverables JSONB,
    terms_conditions TEXT,
    notes TEXT,
    internal_notes TEXT,
    template_id UUID,
    public_link_token TEXT UNIQUE,
    views_count INTEGER DEFAULT 0,
    first_viewed_at TIMESTAMPTZ,
    last_viewed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Proposal Items
CREATE TABLE IF NOT EXISTS public.proposal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    product_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC NOT NULL,
    discount_percentage NUMERIC DEFAULT 0,
    total_price NUMERIC NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    billing_frequency TEXT,
    order_index INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Contracts
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    proposal_id UUID REFERENCES public.proposals(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    account_id UUID REFERENCES public.accounts(id),
    contract_number TEXT NOT NULL,
    title TEXT,
    status TEXT DEFAULT 'draft',
    value NUMERIC,
    start_date DATE,
    end_date DATE,
    renewal_date DATE,
    auto_renew BOOLEAN DEFAULT false,
    payment_terms TEXT,
    content TEXT,
    signed_at TIMESTAMPTZ,
    signed_by TEXT,
    signature_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECTION 6: TEAMS & ASSIGNMENTS
-- ============================================================

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    manager_user_id UUID,
    parent_team_id UUID REFERENCES public.teams(id),
    is_active BOOLEAN DEFAULT true,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, user_id)
);

-- Deal Participants (multi-seller deals)
CREATE TABLE IF NOT EXISTS public.deal_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    role TEXT DEFAULT 'collaborator',
    share_percentage NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(opportunity_id, user_id)
);


-- ============================================================
-- SECTION 7: SELLERS & PERFORMANCE (Gamification)
-- ============================================================

-- Sellers (SDRs, Sales Reps)
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'sdr',
    team_id UUID REFERENCES public.teams(id),
    is_active BOOLEAN DEFAULT true,
    hire_date DATE,
    xp_total INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    last_session_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    xp_reward INTEGER DEFAULT 0,
    icon TEXT DEFAULT 'trophy',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seller Achievements
CREATE TABLE IF NOT EXISTS public.seller_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    current_progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(seller_id, achievement_id)
);

-- Roleplay Sessions
CREATE TABLE IF NOT EXISTS public.roleplay_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    seller_id UUID NOT NULL REFERENCES public.sellers(id),
    archetype_id UUID,
    icp_id UUID,
    status TEXT DEFAULT 'in_progress',
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    messages_count INTEGER DEFAULT 0,
    score_overall NUMERIC,
    score_rapport NUMERIC,
    score_discovery NUMERIC,
    score_objection NUMERIC,
    score_closing NUMERIC,
    xp_earned INTEGER DEFAULT 0,
    feedback_ai TEXT,
    feedback_highlights JSONB,
    transcript JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECTION 8: AI & AUTOMATION
-- ============================================================

-- AI Playbooks
CREATE TABLE IF NOT EXISTS public.ai_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    is_ai_generated BOOLEAN DEFAULT false,
    steps JSONB DEFAULT '[]',
    trigger_conditions JSONB DEFAULT '{}',
    success_metrics JSONB,
    target_stage TEXT,
    target_temperature TEXT,
    target_persona TEXT,
    complexity TEXT,
    estimated_hours NUMERIC,
    success_rate NUMERIC,
    usage_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Suggestions
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    opportunity_id UUID REFERENCES public.opportunities(id),
    suggestion_type TEXT NOT NULL,
    field_name TEXT,
    current_value JSONB,
    suggested_value JSONB,
    reasoning TEXT,
    confidence_score NUMERIC,
    status TEXT DEFAULT 'pending',
    action_taken_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Scores (Lead/Deal Scoring)
CREATE TABLE IF NOT EXISTS public.ai_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    score_type TEXT NOT NULL,
    score NUMERIC NOT NULL,
    grade TEXT,
    confidence NUMERIC,
    factors JSONB,
    reasons JSONB,
    recommendations JSONB,
    next_actions JSONB,
    explanation TEXT,
    model_version TEXT,
    status TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECTION 9: SETTINGS & CONFIGURATION
-- ============================================================

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    section TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, section, key)
);

-- Products/Services Catalog
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    category TEXT,
    unit_price NUMERIC,
    currency TEXT DEFAULT 'BRL',
    is_recurring BOOLEAN DEFAULT false,
    billing_frequency TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Competitors
CREATE TABLE IF NOT EXISTS public.competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    website TEXT,
    description TEXT,
    strengths TEXT[],
    weaknesses TEXT[],
    pricing_info TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    actor_user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    field_name TEXT,
    old_value JSONB,
    new_value JSONB,
    full_entity_data JSONB,
    metadata JSONB,
    trace_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECTION 10: INDEXES (Performance)
-- ============================================================

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_org ON public.accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON public.accounts(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_lead_score ON public.accounts(organization_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_lifecycle ON public.accounts(organization_id, lifecycle_stage);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON public.contacts(account_id);

-- Opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON public.opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline ON public.opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON public.opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_account ON public.opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(organization_id, status);

-- Activities
CREATE INDEX IF NOT EXISTS idx_activities_org ON public.activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON public.activities(organization_id, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_activities_scheduled ON public.activities(scheduled_date, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_activities_opportunity ON public.activities(opportunity_id);

-- Proposals
CREATE INDEX IF NOT EXISTS idx_proposals_org ON public.proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposals_opportunity ON public.proposals(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(organization_id, status);

-- Interactions
CREATE INDEX IF NOT EXISTS idx_interactions_org ON public.interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_interactions_account ON public.interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON public.interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_opportunity ON public.interactions(opportunity_id);

-- Sellers
CREATE INDEX IF NOT EXISTS idx_sellers_org ON public.sellers(organization_id);
CREATE INDEX IF NOT EXISTS idx_sellers_user ON public.sellers(user_id);


-- ============================================================
-- SECTION 11: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleplay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view org profiles" ON public.profiles FOR SELECT USING (organization_id = get_user_organization_id());

-- Organization Members
CREATE POLICY "Users can view org members" ON public.organization_members FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins can manage org members" ON public.organization_members FOR ALL USING (user_is_org_admin(organization_id));

-- Accounts
CREATE POLICY "Users view org accounts" ON public.accounts FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert accounts in own org" ON public.accounts FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update accounts in own org" ON public.accounts FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins delete accounts in own org" ON public.accounts FOR DELETE USING (organization_id = get_user_organization_id() AND can_view_all(auth.uid()));

-- Account Partners
CREATE POLICY "Users can view org account partners" ON public.account_partners FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users can insert org account partners" ON public.account_partners FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update org account partners" ON public.account_partners FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins can delete org account partners" ON public.account_partners FOR DELETE USING (user_is_org_admin(organization_id) OR organization_id = get_user_organization_id());

-- Contacts
CREATE POLICY "Users view org contacts" ON public.contacts FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org contacts" ON public.contacts FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update org contacts" ON public.contacts FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins delete org contacts" ON public.contacts FOR DELETE USING (organization_id = get_user_organization_id() AND can_view_all(auth.uid()));

-- Pipelines
CREATE POLICY "Users view org pipelines" ON public.pipelines FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org pipelines" ON public.pipelines FOR ALL USING (user_is_org_admin(organization_id));

-- Stages
CREATE POLICY "Users view org stages" ON public.stages FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org stages" ON public.stages FOR ALL USING (user_is_org_admin(organization_id));

-- Opportunities
CREATE POLICY "Users view org opportunities" ON public.opportunities FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org opportunities" ON public.opportunities FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update org opportunities" ON public.opportunities FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins delete org opportunities" ON public.opportunities FOR DELETE USING (organization_id = get_user_organization_id() AND can_view_all(auth.uid()));

-- Activities
CREATE POLICY "Users view org activities" ON public.activities FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org activities" ON public.activities FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update org activities" ON public.activities FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users delete org activities" ON public.activities FOR DELETE USING (organization_id = get_user_organization_id());

-- Interactions
CREATE POLICY "Users view org interactions" ON public.interactions FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org interactions" ON public.interactions FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- Proposals
CREATE POLICY "Users view org proposals" ON public.proposals FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org proposals" ON public.proposals FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update org proposals" ON public.proposals FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins delete org proposals" ON public.proposals FOR DELETE USING (organization_id = get_user_organization_id() AND can_view_all(auth.uid()));

-- Proposal Items
CREATE POLICY "Users view org proposal items" ON public.proposal_items FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org proposal items" ON public.proposal_items FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update org proposal items" ON public.proposal_items FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users delete org proposal items" ON public.proposal_items FOR DELETE USING (organization_id = get_user_organization_id());

-- Contracts
CREATE POLICY "Users view org contracts" ON public.contracts FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org contracts" ON public.contracts FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update org contracts" ON public.contracts FOR UPDATE USING (organization_id = get_user_organization_id());

-- Teams
CREATE POLICY "Users view org teams" ON public.teams FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org teams" ON public.teams FOR ALL USING (user_is_org_admin(organization_id));

-- Team Members
CREATE POLICY "Users view org team members" ON public.team_members FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org team members" ON public.team_members FOR ALL USING (user_is_org_admin(organization_id));

-- Deal Participants
CREATE POLICY "Users view org deal participants" ON public.deal_participants FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org deal participants" ON public.deal_participants FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update org deal participants" ON public.deal_participants FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "Users delete org deal participants" ON public.deal_participants FOR DELETE USING (organization_id = get_user_organization_id());

-- Sellers
CREATE POLICY "Users view org sellers" ON public.sellers FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org sellers" ON public.sellers FOR ALL USING (user_is_org_admin(organization_id));

-- Achievements
CREATE POLICY "Users can view achievements" ON public.achievements FOR SELECT USING (organization_id IS NULL OR organization_id = get_user_organization_id());
CREATE POLICY "Admins can manage achievements" ON public.achievements FOR ALL USING (user_is_org_admin(organization_id));

-- Seller Achievements
CREATE POLICY "Users view org seller achievements" ON public.seller_achievements FOR SELECT USING (organization_id = get_user_organization_id());

-- Roleplay Sessions
CREATE POLICY "Users view org roleplay sessions" ON public.roleplay_sessions FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users insert org roleplay sessions" ON public.roleplay_sessions FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users update org roleplay sessions" ON public.roleplay_sessions FOR UPDATE USING (organization_id = get_user_organization_id());

-- AI Playbooks
CREATE POLICY "Users view org playbooks" ON public.ai_playbooks FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org playbooks" ON public.ai_playbooks FOR ALL USING (user_is_org_admin(organization_id));

-- AI Suggestions
CREATE POLICY "Users view org suggestions" ON public.ai_suggestions FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users update own suggestions" ON public.ai_suggestions FOR UPDATE USING (organization_id = get_user_organization_id() AND user_id = auth.uid());

-- AI Scores
CREATE POLICY "Users view org scores" ON public.ai_scores FOR SELECT USING (organization_id = get_user_organization_id());

-- Settings
CREATE POLICY "Users view org settings" ON public.settings FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org settings" ON public.settings FOR ALL USING (user_is_org_admin(organization_id));

-- Products
CREATE POLICY "Users view org products" ON public.products FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org products" ON public.products FOR ALL USING (user_is_org_admin(organization_id));

-- Competitors
CREATE POLICY "Users view org competitors" ON public.competitors FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins manage org competitors" ON public.competitors FOR ALL USING (user_is_org_admin(organization_id));

-- Audit Log
CREATE POLICY "Admins view org audit log" ON public.audit_log FOR SELECT USING (organization_id = get_user_organization_id() AND can_view_all(auth.uid()));


-- ============================================================
-- SECTION 12: TRIGGERS & FUNCTIONS
-- ============================================================

-- Handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Create onboarding status
  INSERT INTO public.onboarding_status (user_id, completed, current_step)
  VALUES (NEW.id, false, 1);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sync lead grade from score
CREATE OR REPLACE FUNCTION public.sync_lead_grade_from_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.lead_score IS DISTINCT FROM OLD.lead_score THEN
    NEW.lead_grade := calculate_lead_grade(NEW.lead_score);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_lead_grade 
  BEFORE INSERT OR UPDATE OF lead_score ON public.accounts 
  FOR EACH ROW EXECUTE FUNCTION sync_lead_grade_from_score();


-- ============================================================
-- SECTION 13: INITIAL DATA (Optional)
-- ============================================================

-- You can add initial seed data here if needed
-- Example: Default achievements
INSERT INTO public.achievements (code, name, description, category, target_value, xp_reward, icon) VALUES
  ('first_session', 'Primeira Sessão', 'Complete sua primeira sessão de roleplay', 'milestone', 1, 50, 'play'),
  ('streak_3', 'Fogo Aceso', 'Mantenha um streak de 3 dias', 'streak', 3, 100, 'flame'),
  ('streak_7', 'Semana Perfeita', 'Mantenha um streak de 7 dias', 'streak', 7, 250, 'calendar'),
  ('sessions_10', 'Praticante', 'Complete 10 sessões de roleplay', 'milestone', 10, 200, 'target'),
  ('sessions_50', 'Veterano', 'Complete 50 sessões de roleplay', 'milestone', 50, 500, 'award'),
  ('score_8', 'Nota Alta', 'Alcance nota 8 ou mais em uma sessão', 'performance', 8, 150, 'star'),
  ('score_10', 'Perfeição', 'Alcance nota 10 em uma sessão', 'performance', 10, 300, 'trophy')
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- SECTION 14: STORAGE BUCKETS
-- ============================================================

-- Create storage buckets (run in Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-assets', 'proposal-assets', true);


-- ============================================================
-- END OF SCHEMA
-- ============================================================

-- Notes:
-- 1. This is a simplified version of the complete schema
-- 2. Some tables may have additional columns in the full system
-- 3. Run this in a new Supabase project SQL Editor
-- 4. Configure Auth in Supabase Dashboard after running this
-- 5. Set up email templates for authentication emails
-- 6. Configure Storage buckets as needed
