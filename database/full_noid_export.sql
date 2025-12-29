-- ============================================================
-- NOID REVENUE OS - COMPLETE DATABASE EXPORT WITH DATA
-- Generated: 2024-12-29
-- Full Schema + Data for External Supabase Deployment
-- ============================================================
-- 
-- INSTRUCTIONS FOR DEPLOYMENT:
-- 1. Create a new Supabase project
-- 2. Go to SQL Editor in Supabase Dashboard
-- 3. Copy and execute this file section by section
-- 4. Create users through Auth interface or API
--
-- IMPORTANT: 
-- - This includes REAL DATA from the production system
-- - Run in ORDER (ENUMs → Tables → Data → RLS)
-- - Some UUIDs reference auth.users - create users first
-- ============================================================

-- ============================================================
-- SECTION 1: ENUMS (CUSTOM TYPES)
-- ============================================================

DO $$ BEGIN
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

CREATE TYPE accelerator_tier_type AS ENUM ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND');
CREATE TYPE app_role AS ENUM ('admin', 'manager', 'sales', 'cs');
CREATE TYPE archetype_level_type AS ENUM ('Entrada', 'Intermediário', 'Avançado', 'Enterprise');
CREATE TYPE client_type AS ENUM ('Organizador', 'Expositor', 'Agência', 'Empresa Contratante');
CREATE TYPE decision_role_type AS ENUM ('Decisor', 'Influenciador', 'Usuário-Chave');
CREATE TYPE graph_edge_type AS ENUM ('works_at', 'owns', 'relates_to', 'influences', 'communicates_with', 'champions', 'blocks', 'participates_in', 'converts_to', 'decision_maker');
CREATE TYPE graph_insight_type AS ENUM ('missing_champion', 'missing_decision_maker', 'silent_stakeholder', 'isolated_deal', 'weak_relationship', 'network_gap', 'high_centrality', 'engagement_decay');
CREATE TYPE graph_node_type AS ENUM ('account', 'contact', 'opportunity', 'interaction', 'proposal', 'contract', 'user');
CREATE TYPE interaction_channel AS ENUM ('email', 'phone', 'whatsapp', 'linkedin', 'meeting', 'form', 'chat', 'website', 'proposal', 'contract', 'other');
CREATE TYPE interaction_type_enum AS ENUM ('call_made', 'call_received', 'call_missed', 'email_sent', 'email_received', 'email_opened', 'email_clicked', 'meeting_scheduled', 'meeting_held', 'meeting_canceled', 'meeting_no_show', 'message_sent', 'message_received', 'form_submitted', 'chat_started', 'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'proposal_rejected', 'contract_sent', 'contract_signed', 'linkedin_connection', 'linkedin_message', 'website_visit', 'demo_requested', 'note_added', 'task_completed', 'other');
CREATE TYPE memory_type AS ENUM ('objection', 'win_pattern', 'loss_reason', 'competitor_intel', 'best_practice');
CREATE TYPE tipo_pessoa_type AS ENUM ('PF', 'PJ');
CREATE TYPE tone_style_type AS ENUM ('formal', 'casual', 'assertivo', 'consultivo');
CREATE TYPE video_level_type AS ENUM ('Básico', 'Intermediário', 'Avançado');
CREATE TYPE video_source_type AS ENUM ('youtube', 'vimeo', 'wistia', 'direct');

-- ============================================================
-- SECTION 2: PLANS TABLE (Required for organizations)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_month_cents INTEGER NOT NULL DEFAULT 0,
    price_year_cents INTEGER NOT NULL DEFAULT 0,
    trial_days INTEGER NOT NULL DEFAULT 14,
    features JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    visible_in_ui BOOLEAN NOT NULL DEFAULT true,
    promo_limit INTEGER NOT NULL DEFAULT 0,
    promo_accounts_used INTEGER NOT NULL DEFAULT 0,
    promo_price_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert plans data
INSERT INTO public.plans (id, name, price_month_cents, price_year_cents, trial_days, features, is_public, display_order, visible_in_ui, promo_limit, promo_accounts_used, promo_price_cents) VALUES
('freemium', 'Freemium', 0, 0, 30, '[]', true, 0, true, 0, 0, 0),
('internal_full', 'Internal Full Access', 0, 0, 0, '["Acesso completo", "Sem limites", "Modo desenvolvedor"]', false, 999, false, 0, 0, 0),
('neural', 'Neural', 19990, 191900, 30, '["CRM completo (leads, contatos, deals e pipelines)", "IA copiloto em todo o sistema", "Geração de e-mails, follow-ups e notas", "Lead e Opportunity Scoring com IA", "Insights inteligentes de pipeline", "Relatórios com IA", "Micro-learning e coaching", "Gamificação nativa", "Higiene e alertas inteligentes de CRM"]', true, 1, true, 100, 0, 19990),
('autonomous', 'Autonomous', 29990, 287900, 14, '["Tudo do Neural incluído", "Criação e execução de agentes de IA", "Agentes por função (SDR, Closer, CS, RevOps, Coach, Auditor)", "Execução automática de tarefas", "Follow-ups autônomos", "Movimentação automática de pipeline", "Atualização de CRM sem ação humana", "Execução de fluxos inteligentes", "Relatórios proativos gerados por agentes", "Aprendizado contínuo com histórico (Memory Engine)", "Consumo inteligente de VOLTS"]', true, 2, true, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 3: ORGANIZATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    cnpj TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    domain TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#000000',
    industry TEXT,
    team_size TEXT,
    status TEXT NOT NULL DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    current_plan_id TEXT REFERENCES public.plans(id),
    is_plan_locked BOOLEAN DEFAULT false,
    max_users INTEGER DEFAULT 5,
    max_opportunities INTEGER DEFAULT 100,
    proposal_prefix TEXT DEFAULT 'PROP',
    proposal_sequence INTEGER DEFAULT 0,
    proposal_validity_days INTEGER DEFAULT 30,
    default_currency TEXT DEFAULT 'BRL',
    goal_system_mode TEXT DEFAULT 'ote',
    settings JSONB DEFAULT '{}',
    responsible_user_id UUID,
    acquisition_channel TEXT DEFAULT 'plg',
    plg_score INTEGER DEFAULT 0,
    plg_score_avg DECIMAL(5,2) DEFAULT 0,
    plg_score_max INTEGER DEFAULT 0,
    plg_score_updated_at TIMESTAMPTZ,
    plg_classification TEXT,
    active_seats INTEGER DEFAULT 0,
    billing_cycle TEXT DEFAULT 'monthly',
    calculated_mrr DECIMAL(12,2) DEFAULT 0,
    calculated_arr DECIMAL(12,2) DEFAULT 0,
    last_mrr_calculated_at TIMESTAMPTZ,
    legal_name TEXT,
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip TEXT,
    state_registration TEXT,
    municipal_registration TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 4: PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    cpf TEXT,
    birth_date DATE,
    avatar_url TEXT,
    default_pipeline_id TEXT,
    monthly_goal DECIMAL(15,2) DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 5: USER ROLES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 6: BUSINESS UNITS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 7: PIPELINES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pipelines (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    pipeline_type TEXT DEFAULT 'sales',
    color TEXT,
    business_unit_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 8: STAGES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stages (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    order_index INTEGER NOT NULL DEFAULT 0,
    probability INTEGER DEFAULT 0,
    stagnation_alert_days INTEGER DEFAULT 7,
    allow_create_opportunity BOOLEAN DEFAULT false,
    allow_win_opportunity BOOLEAN DEFAULT false,
    allow_lose_opportunity BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 9: ACCOUNTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    tipo_pessoa tipo_pessoa_type DEFAULT 'PJ',
    cnpj TEXT,
    cpf TEXT,
    rg TEXT,
    inscricao_estadual TEXT,
    inscricao_municipal TEXT,
    emails TEXT[],
    telefones JSONB,
    website TEXT,
    linkedin TEXT,
    instagram TEXT,
    facebook TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    cep TEXT,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    segmento TEXT,
    tamanho TEXT,
    cnae TEXT,
    cnaes_secundarios TEXT[],
    natureza_juridica TEXT,
    porte TEXT,
    tipo_empresa TEXT,
    capital_social DECIMAL(15,2),
    data_fundacao DATE,
    data_nascimento DATE,
    situacao_cadastral TEXT,
    data_situacao_cadastral DATE,
    opcao_simples BOOLEAN DEFAULT false,
    opcao_mei BOOLEAN DEFAULT false,
    matriz_filial TEXT,
    observacoes TEXT,
    origem_principal TEXT,
    lifecycle_stage TEXT DEFAULT 'Lead',
    data_tornou_cliente DATE,
    owner_user_id UUID,
    cs_user_id UUID,
    parent_account_id UUID REFERENCES public.accounts(id),
    codigo_externo TEXT,
    email_nota_fiscal TEXT,
    logo_url TEXT,
    lead_score INTEGER DEFAULT 0,
    lead_grade TEXT DEFAULT 'F',
    fit_score INTEGER DEFAULT 0,
    intent_score INTEGER DEFAULT 0,
    scoring_factors JSONB,
    score_updated_at TIMESTAMPTZ,
    qualified_at TIMESTAMPTZ,
    pontuacao_nps INTEGER,
    created_by UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 10: CONTACTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    cargo TEXT,
    departamento TEXT,
    emails JSONB DEFAULT '[]',
    telefones JSONB DEFAULT '[]',
    linkedin TEXT,
    observacoes TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 11: PRODUCT CATEGORIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 12: MEASUREMENT UNITS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.measurement_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 13: PRODUCTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT,
    reference TEXT,
    description TEXT,
    price DECIMAL(15,2) DEFAULT 0,
    cost DECIMAL(15,2) DEFAULT 0,
    unit TEXT DEFAULT 'un',
    ipi_percent DECIMAL(5,2) DEFAULT 0,
    image_url TEXT,
    type TEXT DEFAULT 'produto',
    billing_type TEXT DEFAULT 'one_time',
    billing_cycle TEXT DEFAULT 'monthly',
    monthly_price DECIMAL(15,2),
    minimum_contract_months INTEGER DEFAULT 12,
    counts_for_commission BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 14: ORIGIN GROUPS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.origin_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 15: ORIGINS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.origins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.origin_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 16: LOSS REASONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loss_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'other',
    pipeline_ids TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 17: OPPORTUNITIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    pipeline_id TEXT NOT NULL REFERENCES public.pipelines(id),
    stage_id TEXT NOT NULL REFERENCES public.stages(id),
    owner_user_id UUID NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    temperatura TEXT DEFAULT 'warm',
    temperature TEXT DEFAULT 'warm',
    lead_type TEXT DEFAULT 'outbound',
    opportunity_type TEXT DEFAULT 'sales_led',
    origem TEXT,
    fonte TEXT,
    produto TEXT,
    valor_previsto DECIMAL(15,2),
    mrr_value DECIMAL(15,2) DEFAULT 0,
    arr_value DECIMAL(15,2) DEFAULT 0,
    prob INTEGER DEFAULT 10,
    close_date_prevista TIMESTAMPTZ,
    qualified_at TIMESTAMPTZ,
    qualified_by_user_id UUID,
    source_opportunity_id UUID REFERENCES public.opportunities(id),
    loss_reason_id UUID REFERENCES public.loss_reasons(id),
    loss_comment TEXT,
    last_contact_date TIMESTAMPTZ,
    next_followup_date TIMESTAMPTZ,
    days_since_contact INTEGER DEFAULT 0,
    automation_enabled BOOLEAN DEFAULT true,
    -- Scoring fields
    opportunity_score INTEGER DEFAULT 50,
    risk_score INTEGER DEFAULT 50,
    velocity_score INTEGER DEFAULT 50,
    engagement_score INTEGER DEFAULT 50,
    energy_score INTEGER DEFAULT 50,
    timing_score INTEGER DEFAULT 50,
    urgency_score INTEGER DEFAULT 50,
    score_confidence TEXT DEFAULT 'low',
    score_updated_at TIMESTAMPTZ,
    scoring_factors JSONB,
    response_velocity TEXT,
    vibe_state TEXT DEFAULT 'neutral',
    win_probability_ai DECIMAL(5,2) DEFAULT 0,
    -- NRHS fields
    nrhs_score INTEGER,
    nrhs_tier TEXT,
    nrhs_breakdown JSONB,
    nrhs_issues_count INTEGER DEFAULT 0,
    nrhs_blockers TEXT[] DEFAULT '{}',
    nrhs_last_calculated_at TIMESTAMPTZ,
    -- PLG fields
    plg_organization_id UUID,
    plg_score INTEGER DEFAULT 0,
    plg_classification TEXT,
    trial_status TEXT DEFAULT 'pending',
    trial_start_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,
    activated_features TEXT[] DEFAULT '{}',
    -- Commission
    commission_value DECIMAL(15,2) DEFAULT 0,
    -- Metadata
    created_by UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 18: PROPOSALS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    parent_proposal_id UUID REFERENCES public.proposals(id),
    proposal_number TEXT NOT NULL,
    proposal_version INTEGER DEFAULT 1,
    client_name TEXT,
    client_email TEXT,
    status TEXT DEFAULT 'draft',
    introduction TEXT,
    terms TEXT,
    notes TEXT,
    content JSONB DEFAULT '{}',
    subtotal DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    expires_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    last_viewed_at TIMESTAMPTZ,
    signature_status TEXT DEFAULT 'pending',
    signed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    declined_reason TEXT,
    -- Acceptance data
    acceptance_hash TEXT,
    acceptance_proof_url TEXT,
    acceptor_name TEXT,
    acceptor_email TEXT,
    acceptor_phone TEXT,
    acceptor_document TEXT,
    acceptor_document_masked TEXT,
    acceptor_position TEXT,
    acceptor_ip TEXT,
    acceptor_user_agent TEXT,
    -- PDF and public access
    pdf_url TEXT,
    public_token TEXT,
    template_name TEXT,
    layout_id UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 19: PROPOSAL ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    measurement_unit_id UUID REFERENCES public.measurement_units(id),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    quantity DECIMAL(15,4) DEFAULT 1,
    unit_price DECIMAL(15,2) DEFAULT 0,
    unit_cost DECIMAL(15,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    markup_percent DECIMAL(10,2) DEFAULT 0,
    ipi_percent DECIMAL(5,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    billing_type TEXT DEFAULT 'one_time',
    counts_for_commission BOOLEAN DEFAULT true,
    characteristics JSONB DEFAULT '[]',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 20: PROPOSAL PAYMENT TERMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    payment_type TEXT DEFAULT 'one_time',
    payment_method TEXT DEFAULT 'pix',
    installments INTEGER DEFAULT 1,
    installment_interval_days INTEGER DEFAULT 30,
    first_installment_date DATE,
    due_day INTEGER DEFAULT 10,
    entry_percent DECIMAL(5,2) DEFAULT 0,
    entry_date DATE,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    monthly_value DECIMAL(15,2) DEFAULT 0,
    contract_duration_months INTEGER DEFAULT 12,
    contract_start_date DATE,
    contract_total DECIMAL(15,2) DEFAULT 0,
    auto_renewal BOOLEAN DEFAULT true,
    billing_day INTEGER DEFAULT 10,
    recurring_due_day INTEGER DEFAULT 10,
    first_payment_date DATE,
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 21: CONTRACTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    owner_user_id UUID NOT NULL,
    title TEXT NOT NULL,
    contract_type TEXT DEFAULT 'annual',
    status TEXT DEFAULT 'draft',
    contract_value DECIMAL(15,2) DEFAULT 0,
    monthly_value DECIMAL(15,2) DEFAULT 0,
    one_time_value DECIMAL(15,2) DEFAULT 0,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    payment_terms TEXT,
    terms_and_conditions TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 22: ACTIVITIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    owner_user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    scheduled_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    sentiment TEXT,
    ai_generated BOOLEAN DEFAULT false,
    is_automated BOOLEAN DEFAULT false,
    external_id TEXT,
    external_link TEXT,
    sync_source TEXT DEFAULT 'manual',
    sync_provider TEXT,
    sync_metadata JSONB,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 23: SELLERS TABLE (Gamification)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'SDR',
    squad TEXT,
    hire_date DATE,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_title TEXT DEFAULT 'Iniciante',
    current_fit_score DECIMAL(5,2),
    last_evaluation_id UUID,
    last_evaluation_date DATE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 24: ACHIEVEMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT 'trophy',
    category TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    xp_reward INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 25: OTE LEVELS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ote_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    level_code TEXT NOT NULL,
    level_name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    base_salary DECIMAL(15,2) DEFAULT 0,
    variable_target DECIMAL(15,2) DEFAULT 0,
    monthly_goal DECIMAL(15,2) DEFAULT 0,
    is_team_target BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 26: SETTINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID,
    section TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 27: SEAT EVENTS TABLE (Revenue tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.seat_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID,
    event_type TEXT NOT NULL,
    reason TEXT,
    previous_seats INTEGER DEFAULT 0,
    new_seats INTEGER DEFAULT 0,
    previous_plan_id TEXT,
    new_plan_id TEXT,
    previous_mrr DECIMAL(12,2) DEFAULT 0,
    new_mrr DECIMAL(12,2) DEFAULT 0,
    delta_mrr DECIMAL(12,2) DEFAULT 0,
    price_per_seat DECIMAL(12,2) DEFAULT 0,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    triggered_by UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 28: AI RUNS TABLE (AI tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    trace_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    run_type TEXT NOT NULL,
    model_used TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    entity_type TEXT,
    entity_id TEXT,
    input_context JSONB DEFAULT '{}',
    output_result JSONB,
    tokens_input INTEGER,
    tokens_output INTEGER,
    volts_consumed INTEGER,
    latency_ms INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DATA SECTION: INSERT ORGANIZATIONS
-- ============================================================

INSERT INTO public.organizations (id, name, slug, cnpj, status, current_plan_id, is_plan_locked, goal_system_mode, acquisition_channel, active_seats, calculated_mrr, calculated_arr, industry, team_size, trial_ends_at, primary_color) VALUES
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'LEGAL', 'operadoralegal', '54753156000172', 'active', 'internal_full', true, 'simple', 'plg', 10, 0, 0, 'Tecnologia', '11-50', NULL, '#020cbc'),
('774d7d78-8257-4891-aac7-718039b80049', 'Humanoid', 'humanoid', NULL, 'active', 'internal_full', true, 'ote', 'internal', 5, 0, 0, 'Tecnologia', '2-5 pessoas', NULL, '#000000'),
('1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'Opus Bobinas', 'opus-bobinas', '59336028000147', 'active', 'neural', true, 'ote', 'slg', 1, 199.90, 2398.80, 'Outro', '2-5 pessoas', '2026-01-09 17:05:38.506+00', '#000000')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT BUSINESS UNITS
-- ============================================================

INSERT INTO public.business_units (id, organization_id, name, code, color, is_active) VALUES
('3ee83286-0f0b-4836-a57c-08cd9a3bf237', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'ALUGUE', 'BUALU', '#3b82f6', true),
('1ecb65ba-01fd-4e86-b2f9-127956b307dd', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'AERO', 'AERO', '#3b82f6', true),
('ab3a8afa-47fb-4d43-ba80-dd55a8a08871', '774d7d78-8257-4891-aac7-718039b80049', 'Humanoid', 'HUMANOID', '#020cbc', true),
('e448d19d-4d29-4608-ac61-57a5128c4ae0', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'bobinas', 'BOBINAS', '#3b82f6', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT PIPELINES
-- ============================================================

INSERT INTO public.pipelines (id, organization_id, name, pipeline_type, type, business_unit_ids) VALUES
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d-sales-1', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'PRÉ VENDAS', 'qualification', 'f6926de2-d781-4de3-a984-300cd157c634', ARRAY['f6926de2-d781-4de3-a984-300cd157c634', '3ee83286-0f0b-4836-a57c-08cd9a3bf237', '1ecb65ba-01fd-4e86-b2f9-127956b307dd']::uuid[]),
('59a4780d-0b92-4a48-be49-ee490be93dbf', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'VENDAS', 'sales', 'fda721e2-4e16-44fa-8557-934484e64f38', ARRAY['fda721e2-4e16-44fa-8557-934484e64f38', '3ee83286-0f0b-4836-a57c-08cd9a3bf237']::uuid[]),
('97a78715-c2e5-426c-b248-979b7718af03', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'OPERACIONAL', 'onboarding', 'CUSTOM', ARRAY['3ee83286-0f0b-4836-a57c-08cd9a3bf237']::uuid[]),
('4f454385-5bb2-436b-af52-1fd69564af95', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'PÓS VENDA', 'renewal', 'CUSTOM', ARRAY['3ee83286-0f0b-4836-a57c-08cd9a3bf237']::uuid[]),
('774d7d78-8257-4891-aac7-718039b80049-sales-1', '774d7d78-8257-4891-aac7-718039b80049', 'PRÉ VENDAS', 'qualification', 'sales', ARRAY['ab3a8afa-47fb-4d43-ba80-dd55a8a08871']::uuid[]),
('95ce0403-acab-497c-a9cd-c8c95a2c36d0', '774d7d78-8257-4891-aac7-718039b80049', 'VENDAS', 'sales', 'CUSTOM', ARRAY['ab3a8afa-47fb-4d43-ba80-dd55a8a08871']::uuid[]),
('8be179ed-fa2d-4a64-9fe0-9283dc288717', '774d7d78-8257-4891-aac7-718039b80049', 'ONBOARDING CS', 'onboarding', 'CUSTOM', ARRAY['ab3a8afa-47fb-4d43-ba80-dd55a8a08871']::uuid[]),
('a62e6a8a-1c60-4b6e-bdb7-00464d69d692', '774d7d78-8257-4891-aac7-718039b80049', 'EXPANSÃO', 'renewal', 'CUSTOM', ARRAY['ab3a8afa-47fb-4d43-ba80-dd55a8a08871']::uuid[]),
('dbff5270-754e-40c0-9b56-ab4c4d601124', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'PRÉ VENDAS', 'qualification', 'CUSTOM', ARRAY['e448d19d-4d29-4608-ac61-57a5128c4ae0']::uuid[])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT PRODUCT CATEGORIES
-- ============================================================

INSERT INTO public.product_categories (id, organization_id, name, color, is_active) VALUES
('8c3960c2-642b-4920-98c9-35a91efd1a8c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'ALUGUE', '#3b82f6', true),
('5ff39c62-c0a5-401a-8397-1eb73b3da073', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'AERO', '#3b82f6', true),
('aedaae1f-192a-4cab-ab4a-ef1d9c832001', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'ASSINATURA', '#3b82f6', true),
('3e125b9b-cef4-494f-a91b-896038d11d49', '774d7d78-8257-4891-aac7-718039b80049', 'SaaS – Planos & Assinaturas', '#3b82f6', true),
('37760765-d98a-4d9a-825d-7c5904fa4dce', '774d7d78-8257-4891-aac7-718039b80049', 'Serviços – Setup & Implantação', '#3b82f6', true),
('e1cf40ab-c03f-4e64-ab22-319460e848cd', '774d7d78-8257-4891-aac7-718039b80049', 'Consultoria & Business Intelligence', '#3b82f6', true),
('15bc920a-739a-4671-9e1a-570ab7e1b45d', '774d7d78-8257-4891-aac7-718039b80049', 'IA – Créditos & Automação (VOLTS)', '#3b82f6', true),
('386b9495-7dce-40e3-a078-757705c3f07b', '774d7d78-8257-4891-aac7-718039b80049', 'Smart Events', '#3b82f6', true),
('a699dd16-9393-4296-82fa-81a05f5c898b', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'Bobina Térmica', '#3b82f6', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT ORIGIN GROUPS
-- ============================================================

INSERT INTO public.origin_groups (id, organization_id, name, description, is_active) VALUES
('a9b154c4-7704-46ff-8aaf-4fbd07141786', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Farmers', 'Clientes que já existem na base e podem gerar novas oportunidades', true),
('6e527f12-f8c1-4e29-afa1-6c910a0bcf54', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Inbound', '', true),
('1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Outbound', '', true),
('cf49a229-b88c-4bc4-aa87-66ed25e97e40', '774d7d78-8257-4891-aac7-718039b80049', 'Farmer', '', true),
('3078a8ea-68e0-4c7c-b3a9-7d0ad51317ef', '774d7d78-8257-4891-aac7-718039b80049', 'Inbound', '', true),
('df5733fd-1c60-483c-b419-3d0ea0963863', '774d7d78-8257-4891-aac7-718039b80049', 'Outbound', '', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT ORIGINS
-- ============================================================

INSERT INTO public.origins (id, organization_id, group_id, name, is_active) VALUES
('baba6702-1312-4f0b-8907-29b9d8571e88', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '6e527f12-f8c1-4e29-afa1-6c910a0bcf54', 'Google Ads', true),
('d17a59eb-8d3a-443e-83cf-6c6c1461a4fe', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'Apollo > WhatsApp', true),
('075df2c0-becc-4e13-b309-577bdfaf2610', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'a9b154c4-7704-46ff-8aaf-4fbd07141786', 'Carteira - Contato Receptivo', true),
('db1c1d85-3ddf-40a9-ae8a-6c97bd5bf843', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'E-mail Marketing', true),
('131eac84-1577-4b95-9dde-415ae2858ab1', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '6e527f12-f8c1-4e29-afa1-6c910a0bcf54', 'Indicação', true),
('379458f7-97a3-47a9-b789-88445b3a74d5', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '6e527f12-f8c1-4e29-afa1-6c910a0bcf54', 'Meta ADS', true),
('06490bb8-4e1e-4b94-adf5-f9349e250724', '774d7d78-8257-4891-aac7-718039b80049', '3078a8ea-68e0-4c7c-b3a9-7d0ad51317ef', 'Instagram CEO', true),
('3c1937bc-7af2-4f88-ae1c-8188ec8225e8', '774d7d78-8257-4891-aac7-718039b80049', '3078a8ea-68e0-4c7c-b3a9-7d0ad51317ef', 'Instagram Company', true),
('27170519-fd68-406e-bb2a-35494f38cc22', '774d7d78-8257-4891-aac7-718039b80049', 'df5733fd-1c60-483c-b419-3d0ea0963863', 'Ligação', true),
('5f966a6c-a769-4d3f-9361-775427b59320', '774d7d78-8257-4891-aac7-718039b80049', '3078a8ea-68e0-4c7c-b3a9-7d0ad51317ef', 'LP Noid', true),
('fa829c35-8dbb-4fcb-888c-dffa68103a58', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', NULL, 'Indicação', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT LOSS REASONS
-- ============================================================

INSERT INTO public.loss_reasons (id, organization_id, name, category, is_active) VALUES
('61b4e2fb-2cb4-4c29-9239-6934fe9f18cf', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cliente não entendeu/valorizou a solução', 'price', true),
('36e62f1d-40ba-4596-9d90-c67b2991879f', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Entrou em contato apenas para pesquisa de preços', 'price', true),
('08e53484-d32a-4beb-9341-7f72da9d469d', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cliente optou por solução concorrente', 'competition', true),
('e20d0c25-3032-41b4-986a-e5381d361af0', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Falta de fit entre necessidade e nossa solução', 'product', true),
('0407ae18-f07b-4932-a106-2d2ca5720db3', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Falha na comunicação interna do cliente', 'relationship', true),
('9b56f0fe-adb0-4407-a567-32a119a7583f', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cliente não possui viabilidade operacional', 'other', true),
('17bee1ce-0391-4b06-bff0-1dd55cb24fbc', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Expectativa de ROI não foi atingida', 'other', true),
('c2be2808-fd85-49e7-b97b-e466cca9672a', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Não houve budget aprovado', 'price', true),
('f3ed85e9-1cf4-4fd7-ad65-6c5e0b66b718', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Preço percebido como alto', 'price', true),
('dc9b6c3f-f784-4652-ad4c-afee831a083a', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Restrições de tempo para implementação', 'timing', true),
('b0247516-32a0-44ea-828c-02dee2d3cb4e', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Timing inadequado para o cliente', 'timing', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT OTE LEVELS
-- ============================================================

INSERT INTO public.ote_levels (id, organization_id, level_code, level_name, description, order_index, base_salary, variable_target, monthly_goal, is_team_target, is_active) VALUES
('5e6b989f-5177-4831-983d-db52a2529106', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Closer1', 'Starter', 'Entrada na carreira', 1, 3500, 3500, 50000, false, true),
('4e1aa8f0-7b97-45f6-9fdb-3d48a90855bc', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Closer2', 'Tracer', 'Desenvolvimento técnico', 2, 4000, 4000, 60000, false, true),
('e53ee589-0c04-4c04-b65b-87a842ad6848', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Closer3', 'Connector', 'Foco em relacionamento', 3, 4500, 4500, 70000, false, true),
('dcedb147-5947-4155-a710-115e2092f418', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Closer4', 'Booster', 'Acelerador de resultados', 4, 5000, 5000, 80000, false, true),
('8c134ef9-9226-4faa-ba69-30e7560afe2d', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Closer5', 'Closer', 'Mestre em fechamento', 5, 5500, 5500, 90000, false, true),
('6bb9f514-efff-4d44-ac7b-1b14e2b0655e', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Closer6', 'Planner', 'Escalando a carreira', 6, 6000, 6000, 100000, false, true),
('5f92fdb6-a5bc-4930-a15a-c7cb6c50e384', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Gestor1', 'Driver', 'Liderança tática', 7, 8000, 6000, 360000, true, true),
('7df7d52a-ee2e-4b29-9e7e-d17690787911', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Gestor2', 'Architect', 'Estrategista sênior', 8, 11000, 7000, 540000, true, true),
('afc73925-0c3c-40a4-b2ab-ae1446b0f4ec', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Gestor3', 'Strategist', 'Visão e expansão', 9, 15000, 7000, 720000, true, true),
('5d9fc9d9-5860-473e-991b-f80664826c25', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'CCO', 'Visionary', 'Alta liderança comercial', 10, 21000, 9000, 1000000, true, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT ACHIEVEMENTS
-- ============================================================

INSERT INTO public.achievements (id, code, name, description, icon, category, target_value, xp_reward, is_active) VALUES
('6764927c-9c4d-4aff-99aa-5a8def1d84ca', 'sessions_25', 'Treinador Dedicado', 'Complete 25 sessões de roleplay', 'dumbbell', 'milestone', 25, 150, true),
('05a0f652-4478-40d8-af7a-87511bb964df', 'sessions_100', 'Mestre do Treino', 'Complete 100 sessões de roleplay', 'trophy', 'milestone', 100, 500, true),
('f0a6a28f-567e-409c-bda3-315118e5f578', 'streak_30', 'Consistência Inabalável', 'Mantenha um streak de 30 dias', 'flame', 'milestone', 30, 400, true),
('885d77f5-da6b-4ad2-8b5a-21c3a2ba074b', 'avg_score_85', 'Vendedor de Elite', 'Alcance média geral de 8.5', 'star', 'milestone', 85, 300, true),
('61369171-9ef8-4a2e-8970-6e882dac74a8', 'weekly_5', 'Semana Produtiva', 'Complete 5 treinos nesta semana', 'calendar', 'weekly', 5, 75, true),
('2bae26a9-3463-49b4-ab9e-a68a495148c1', 'weekly_perfect', 'Semana Perfeita', 'Seja aprovado em todos os treinos da semana', 'check-circle', 'weekly', 7, 150, true),
('988cccf0-cd0a-445e-a8ea-ddc33e6d52dd', 'monthly_20', 'Mês Intenso', 'Complete 20 treinos este mês', 'calendar-days', 'monthly', 20, 200, true),
('b7469c81-7060-4fbf-8fd3-6525a46c0a8a', 'monthly_champion', 'Campeão do Mês', 'Seja o vendedor com mais XP no mês', 'crown', 'monthly', 1, 500, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT SETTINGS
-- ============================================================

INSERT INTO public.settings (id, organization_id, section, key, value) VALUES
('562379be-b72f-4140-a3fc-3f7bb07124ea', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'roleplay', 'training_window', '{"end": "09:00", "start": "08:30", "timezone": "America/Sao_Paulo"}'),
('eed4308a-bbf0-40f5-9c0e-4cd15bf518c9', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'roleplay', 'performance_gate', '{"active": true, "min_score": 8, "window_sessions": 5}'),
('70e8ae80-cf4d-41ec-8032-36a5fec02a5b', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'roleplay', 'ranking_settings', '{"show_public": true, "show_top_only": false, "top_count": 10, "update_period_days": 7}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATA SECTION: INSERT MEASUREMENT UNITS
-- ============================================================

INSERT INTO public.measurement_units (id, organization_id, name, abbreviation, is_default, is_active) VALUES
('d1a4df96-6f32-4104-9b13-3688ed3d71ce', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Dia', 'dia', false, true),
('c963c256-8d72-414c-95bb-2dafcd508a26', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Ponto(s)', 'Pto', false, true),
('88ac153a-9de3-4325-99b1-61c99126480c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Unidade', 'Un', true, true),
('32591d3e-b995-48d8-9593-f6ea87ba11c7', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Hora(s)', 'H', false, true),
('9bb71e93-c434-4fe8-9d83-ef89f08455b7', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Metro', 'M', false, true),
('cd7befcf-ea3e-425d-a8a9-a3f19d23b633', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Metro²', 'M²', false, true),
('b1331291-18a2-4d8c-99ab-f42abf84e40c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Visita', 'VT', false, true),
('ebdf8527-fdc0-4a2b-90c0-9ef99ec6cf16', '774d7d78-8257-4891-aac7-718039b80049', 'Usuário', 'User', false, true),
('7902d81e-e0fd-4749-ac14-e503fc78624e', '774d7d78-8257-4891-aac7-718039b80049', 'Hora', 'Hr', false, true),
('319b01b9-f6f0-4768-9381-b2402ae240ef', '774d7d78-8257-4891-aac7-718039b80049', 'Mensal', 'Mês', false, true),
('2309a01a-1c11-4dc2-91f3-6172e9a20fd5', '774d7d78-8257-4891-aac7-718039b80049', 'Anual', 'Ano', false, true),
('46ba221b-5e1e-4596-8631-943e2e9716df', '774d7d78-8257-4891-aac7-718039b80049', 'Licença', 'Lic', false, true),
('6ebe44ba-e83e-47a2-ab55-e690d9a2e83b', '774d7d78-8257-4891-aac7-718039b80049', 'Volts', 'VLT', false, true),
('11cabd8e-f47b-40a5-9513-dbaca8713ad7', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'Metro', 'M', true, true),
('2a38b95e-e1a1-4f47-a73f-2b21bcc8ea7f', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'Caixa', 'Cx', false, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_accounts_organization ON public.accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_razao_social ON public.accounts(razao_social);
CREATE INDEX IF NOT EXISTS idx_contacts_organization ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON public.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_organization ON public.opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline ON public.opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON public.opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_account ON public.opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_proposals_organization ON public.proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposals_opportunity ON public.proposals(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_activities_organization ON public.activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_opportunity ON public.activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON public.activities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_stages_pipeline ON public.stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_products_organization ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);

-- ============================================================
-- SECTION: ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origin_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ote_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION: CREATE HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id 
  FROM public.profiles 
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN org_id;
END;
$$;

-- ============================================================
-- SECTION: CREATE RLS POLICIES
-- ============================================================

-- Organizations policies
CREATE POLICY "Users can view their organization" ON public.organizations
    FOR SELECT USING (id = get_user_organization_id());

CREATE POLICY "Users can update their organization" ON public.organizations
    FOR UPDATE USING (id = get_user_organization_id());

-- Profiles policies
CREATE POLICY "Users can view profiles in their org" ON public.profiles
    FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert profile" ON public.profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Generic organization-scoped policies for all CRM tables
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'business_units', 'pipelines', 'stages', 'accounts', 'contacts',
        'product_categories', 'measurement_units', 'products', 'origin_groups',
        'origins', 'loss_reasons', 'opportunities', 'proposals', 'proposal_items',
        'proposal_payment_terms', 'contracts', 'activities', 'sellers',
        'ote_levels', 'settings', 'seat_events', 'ai_runs'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('
            CREATE POLICY "Users can view %1$s in their org" ON public.%1$s
                FOR SELECT USING (organization_id = get_user_organization_id());
            CREATE POLICY "Users can insert %1$s in their org" ON public.%1$s
                FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
            CREATE POLICY "Users can update %1$s in their org" ON public.%1$s
                FOR UPDATE USING (organization_id = get_user_organization_id());
            CREATE POLICY "Users can delete %1$s in their org" ON public.%1$s
                FOR DELETE USING (organization_id = get_user_organization_id());
        ', t);
    END LOOP;
END $$;

-- User roles policies
CREATE POLICY "Users can view their roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

-- Plans policies (public read)
CREATE POLICY "Anyone can view public plans" ON public.plans
    FOR SELECT USING (is_public = true);

-- Achievements policies (global achievements)
CREATE POLICY "Users can view global achievements" ON public.achievements
    FOR SELECT USING (organization_id IS NULL OR organization_id = get_user_organization_id());

-- ============================================================
-- SECTION: CREATE TRIGGERS FOR TIMESTAMPS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to main tables
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'organizations', 'profiles', 'business_units', 'accounts', 'contacts',
        'product_categories', 'measurement_units', 'products', 'origin_groups',
        'origins', 'loss_reasons', 'opportunities', 'proposals', 'proposal_items',
        'proposal_payment_terms', 'contracts', 'activities', 'sellers',
        'ote_levels', 'settings'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%1$s_updated_at ON public.%1$s;
            CREATE TRIGGER update_%1$s_updated_at
                BEFORE UPDATE ON public.%1$s
                FOR EACH ROW
                EXECUTE FUNCTION public.update_updated_at_column();
        ', t);
    END LOOP;
END $$;

-- ============================================================
-- FINAL NOTES
-- ============================================================
-- 
-- AFTER RUNNING THIS SCRIPT:
-- 
-- 1. Create users via Supabase Auth Dashboard or API
-- 2. Insert corresponding profiles with the user_id and organization_id
-- 3. Insert user_roles for each user
-- 
-- EXAMPLE:
-- INSERT INTO public.profiles (user_id, organization_id, full_name, email)
-- VALUES ('YOUR-AUTH-USER-UUID', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Admin User', 'admin@example.com');
-- 
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('YOUR-AUTH-USER-UUID', 'admin');
--
-- ============================================================
