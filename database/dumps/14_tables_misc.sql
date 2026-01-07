-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 14_tables_misc.sql
-- Generated: 2026-01-07
-- Description: Miscellaneous tables (Notifications, Demos, PLG, Support)
-- Tables: 24 tables
-- ============================================================

-- ============================================================
-- TABLE: notifications
-- ============================================================
DROP TABLE IF EXISTS public.notifications CASCADE;
CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    priority TEXT DEFAULT 'normal',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: daily_briefings
-- ============================================================
DROP TABLE IF EXISTS public.daily_briefings CASCADE;
CREATE TABLE public.daily_briefings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    briefing_date DATE NOT NULL,
    content JSONB NOT NULL,
    summary TEXT,
    priorities JSONB DEFAULT '[]',
    metrics JSONB DEFAULT '{}',
    ai_insights JSONB DEFAULT '[]',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, briefing_date)
);

-- ============================================================
-- TABLE: dismissed_tips
-- ============================================================
DROP TABLE IF EXISTS public.dismissed_tips CASCADE;
CREATE TABLE public.dismissed_tips (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    tip_id TEXT NOT NULL,
    dismissed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tip_id)
);

-- ============================================================
-- TABLE: demo_slots
-- ============================================================
DROP TABLE IF EXISTS public.demo_slots CASCADE;
CREATE TABLE public.demo_slots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    host_user_id UUID NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    is_available BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    meeting_link TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: scheduled_demos
-- ============================================================
DROP TABLE IF EXISTS public.scheduled_demos CASCADE;
CREATE TABLE public.scheduled_demos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    slot_id UUID REFERENCES public.demo_slots(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    contact_id UUID REFERENCES public.contacts(id),
    host_user_id UUID NOT NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_phone TEXT,
    guest_company TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    meeting_link TEXT,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    attended BOOLEAN,
    feedback JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: vibe_alerts
-- ============================================================
DROP TABLE IF EXISTS public.vibe_alerts CASCADE;
CREATE TABLE public.vibe_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'warning',
    title TEXT NOT NULL,
    message TEXT,
    current_state TEXT,
    trigger_event TEXT,
    trigger_data JSONB,
    recommended_actions JSONB DEFAULT '[]',
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: vibe_narratives
-- ============================================================
DROP TABLE IF EXISTS public.vibe_narratives CASCADE;
CREATE TABLE public.vibe_narratives (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
    narrative_type TEXT DEFAULT 'status_update',
    content TEXT NOT NULL,
    tone TEXT,
    key_points JSONB DEFAULT '[]',
    sentiment_score NUMERIC,
    generated_at TIMESTAMPTZ DEFAULT now(),
    is_current BOOLEAN DEFAULT true,
    superseded_by UUID REFERENCES public.vibe_narratives(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: disposable_email_domains
-- ============================================================
DROP TABLE IF EXISTS public.disposable_email_domains CASCADE;
CREATE TABLE public.disposable_email_domains (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    source TEXT,
    is_active BOOLEAN DEFAULT true,
    added_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: oauth_nonces
-- ============================================================
DROP TABLE IF EXISTS public.oauth_nonces CASCADE;
CREATE TABLE public.oauth_nonces (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nonce TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    user_id UUID,
    state_data JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: opportunities_weekly_review
-- ============================================================
DROP TABLE IF EXISTS public.opportunities_weekly_review CASCADE;
CREATE TABLE public.opportunities_weekly_review (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    summary JSONB NOT NULL,
    highlights JSONB DEFAULT '[]',
    concerns JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    metrics JSONB DEFAULT '{}',
    ai_analysis TEXT,
    is_reviewed BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, week_start)
);

-- ============================================================
-- TABLE: proposal_alerts
-- ============================================================
DROP TABLE IF EXISTS public.proposal_alerts CASCADE;
CREATE TABLE public.proposal_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id),
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: proposal_views
-- ============================================================
DROP TABLE IF EXISTS public.proposal_views CASCADE;
CREATE TABLE public.proposal_views (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id),
    viewer_email TEXT,
    viewer_name TEXT,
    viewer_ip INET,
    viewer_user_agent TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    geo_country TEXT,
    geo_city TEXT,
    session_id TEXT,
    view_duration_seconds INTEGER,
    pages_viewed INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: proposal_view_events
-- ============================================================
DROP TABLE IF EXISTS public.proposal_view_events CASCADE;
CREATE TABLE public.proposal_view_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    view_id UUID NOT NULL REFERENCES public.proposal_views(id),
    event_type TEXT NOT NULL,
    page_number INTEGER,
    element_id TEXT,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: proposal_view_logs
-- ============================================================
DROP TABLE IF EXISTS public.proposal_view_logs CASCADE;
CREATE TABLE public.proposal_view_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id),
    view_id UUID REFERENCES public.proposal_views(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: slg_conversions
-- ============================================================
DROP TABLE IF EXISTS public.slg_conversions CASCADE;
CREATE TABLE public.slg_conversions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    account_id UUID REFERENCES public.accounts(id),
    contact_id UUID REFERENCES public.contacts(id),
    source_type TEXT NOT NULL,
    source_campaign TEXT,
    source_channel TEXT,
    conversion_type TEXT NOT NULL,
    conversion_value NUMERIC,
    attribution_model TEXT DEFAULT 'last_touch',
    attribution_data JSONB,
    converted_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: plg_events
-- ============================================================
DROP TABLE IF EXISTS public.plg_events CASCADE;
CREATE TABLE public.plg_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    user_id UUID,
    anonymous_id TEXT,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_properties JSONB DEFAULT '{}',
    page_url TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    ip_address INET,
    geo_country TEXT,
    geo_city TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: plg_score_config
-- ============================================================
DROP TABLE IF EXISTS public.plg_score_config CASCADE;
CREATE TABLE public.plg_score_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    points INTEGER NOT NULL,
    max_per_day INTEGER,
    max_per_session INTEGER,
    decay_days INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: plg_score_history
-- ============================================================
DROP TABLE IF EXISTS public.plg_score_history CASCADE;
CREATE TABLE public.plg_score_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID,
    anonymous_id TEXT,
    score_date DATE NOT NULL,
    total_score INTEGER DEFAULT 0,
    breakdown JSONB DEFAULT '{}',
    pql_qualified BOOLEAN DEFAULT false,
    pql_qualified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: xp_conversion_history
-- ============================================================
DROP TABLE IF EXISTS public.xp_conversion_history CASCADE;
CREATE TABLE public.xp_conversion_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    seller_id UUID NOT NULL REFERENCES public.sellers(id),
    conversion_type TEXT NOT NULL,
    xp_amount INTEGER NOT NULL,
    converted_value NUMERIC,
    conversion_rate NUMERIC,
    metadata JSONB,
    converted_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: conversation_logs
-- ============================================================
DROP TABLE IF EXISTS public.conversation_logs CASCADE;
CREATE TABLE public.conversation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    session_id TEXT,
    conversation_type TEXT DEFAULT 'ai_assistant',
    messages JSONB DEFAULT '[]',
    context JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    feedback_rating INTEGER,
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: support_tickets
-- ============================================================
DROP TABLE IF EXISTS public.support_tickets CASCADE;
CREATE TABLE public.support_tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    ticket_number TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    description TEXT,
    category TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    assigned_to UUID,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    satisfaction_rating INTEGER,
    satisfaction_comment TEXT,
    tags JSONB DEFAULT '[]',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: support_ticket_responses
-- ============================================================
DROP TABLE IF EXISTS public.support_ticket_responses CASCADE;
CREATE TABLE public.support_ticket_responses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    response_type TEXT DEFAULT 'reply',
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: success_plans
-- ============================================================
DROP TABLE IF EXISTS public.success_plans CASCADE;
CREATE TABLE public.success_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    start_date DATE,
    target_date DATE,
    objectives JSONB DEFAULT '[]',
    milestones JSONB DEFAULT '[]',
    success_criteria JSONB DEFAULT '[]',
    stakeholders JSONB DEFAULT '[]',
    risks JSONB DEFAULT '[]',
    notes TEXT,
    owner_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: proposal_participants
-- ============================================================
DROP TABLE IF EXISTS public.proposal_participants CASCADE;
CREATE TABLE public.proposal_participants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id),
    role TEXT DEFAULT 'reviewer',
    email TEXT,
    name TEXT,
    can_approve BOOLEAN DEFAULT false,
    approved_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
