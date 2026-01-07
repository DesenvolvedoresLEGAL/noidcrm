-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 10_tables_analytics.sql
-- Generated: 2026-01-07
-- Description: Analytics, Forecasts, Scores, Graph tables
-- Tables: 19 tables
-- ============================================================

-- ============================================================
-- TABLE: entity_snapshots
-- ============================================================
DROP TABLE IF EXISTS public.entity_snapshots CASCADE;
CREATE TABLE public.entity_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: forecast_predictions
-- ============================================================
DROP TABLE IF EXISTS public.forecast_predictions CASCADE;
CREATE TABLE public.forecast_predictions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    pipeline_id UUID REFERENCES public.pipelines(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    prediction_type TEXT DEFAULT 'revenue',
    pessimistic_value NUMERIC DEFAULT 0,
    realistic_value NUMERIC DEFAULT 0,
    optimistic_value NUMERIC DEFAULT 0,
    actual_value NUMERIC,
    confidence_score NUMERIC,
    factors JSONB,
    model_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    evaluated_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: forecast_snapshots
-- ============================================================
DROP TABLE IF EXISTS public.forecast_snapshots CASCADE;
CREATE TABLE public.forecast_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    pipeline_id UUID REFERENCES public.pipelines(id),
    snapshot_date DATE NOT NULL,
    period_type TEXT DEFAULT 'monthly',
    target_value NUMERIC,
    committed_value NUMERIC,
    best_case_value NUMERIC,
    pipeline_value NUMERIC,
    closed_value NUMERIC,
    gap_value NUMERIC,
    coverage_ratio NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: revenue_events
-- ============================================================
DROP TABLE IF EXISTS public.revenue_events CASCADE;
CREATE TABLE public.revenue_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    event_type TEXT NOT NULL,
    event_date TIMESTAMPTZ DEFAULT now(),
    amount NUMERIC,
    recurring_amount NUMERIC,
    mrr_impact NUMERIC,
    arr_impact NUMERIC,
    currency TEXT DEFAULT 'BRL',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: score_history
-- ============================================================
DROP TABLE IF EXISTS public.score_history CASCADE;
CREATE TABLE public.score_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    score_type TEXT NOT NULL,
    score_value NUMERIC NOT NULL,
    previous_value NUMERIC,
    change_reason TEXT,
    factors JSONB,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: score_alerts
-- ============================================================
DROP TABLE IF EXISTS public.score_alerts CASCADE;
CREATE TABLE public.score_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    score_type TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    threshold_value NUMERIC,
    current_value NUMERIC,
    message TEXT,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: score_calculation_history
-- ============================================================
DROP TABLE IF EXISTS public.score_calculation_history CASCADE;
CREATE TABLE public.score_calculation_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    score_type TEXT NOT NULL,
    input_data JSONB,
    calculation_steps JSONB,
    final_score NUMERIC,
    algorithm_version TEXT,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: performance_metrics_log
-- ============================================================
DROP TABLE IF EXISTS public.performance_metrics_log CASCADE;
CREATE TABLE public.performance_metrics_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    seller_id UUID REFERENCES public.sellers(id),
    metric_date DATE NOT NULL,
    metric_type TEXT NOT NULL,
    metric_value NUMERIC,
    target_value NUMERIC,
    achievement_pct NUMERIC,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: performance_insights
-- ============================================================
DROP TABLE IF EXISTS public.performance_insights CASCADE;
CREATE TABLE public.performance_insights (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    seller_id UUID REFERENCES public.sellers(id),
    insight_type TEXT NOT NULL,
    insight_date DATE,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'info',
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: graph_nodes
-- ============================================================
DROP TABLE IF EXISTS public.graph_nodes CASCADE;
CREATE TABLE public.graph_nodes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    node_type TEXT NOT NULL,
    entity_id UUID,
    label TEXT,
    properties JSONB DEFAULT '{}',
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: graph_edges
-- ============================================================
DROP TABLE IF EXISTS public.graph_edges CASCADE;
CREATE TABLE public.graph_edges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    source_node_id UUID NOT NULL REFERENCES public.graph_nodes(id),
    target_node_id UUID NOT NULL REFERENCES public.graph_nodes(id),
    edge_type TEXT NOT NULL,
    weight NUMERIC DEFAULT 1,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: graph_builds
-- ============================================================
DROP TABLE IF EXISTS public.graph_builds CASCADE;
CREATE TABLE public.graph_builds (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    build_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    nodes_created INTEGER DEFAULT 0,
    edges_created INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: graph_insights
-- ============================================================
DROP TABLE IF EXISTS public.graph_insights CASCADE;
CREATE TABLE public.graph_insights (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    build_id UUID REFERENCES public.graph_builds(id),
    insight_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'info',
    entities_involved JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    is_actioned BOOLEAN DEFAULT false,
    actioned_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: conversion_benchmarks
-- ============================================================
DROP TABLE IF EXISTS public.conversion_benchmarks CASCADE;
CREATE TABLE public.conversion_benchmarks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    pipeline_id UUID REFERENCES public.pipelines(id),
    from_stage_id UUID REFERENCES public.stages(id),
    to_stage_id UUID REFERENCES public.stages(id),
    benchmark_period TEXT DEFAULT 'monthly',
    conversion_rate NUMERIC,
    avg_days_in_stage NUMERIC,
    sample_size INTEGER,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: conversion_alerts
-- ============================================================
DROP TABLE IF EXISTS public.conversion_alerts CASCADE;
CREATE TABLE public.conversion_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    pipeline_id UUID REFERENCES public.pipelines(id),
    stage_id UUID REFERENCES public.stages(id),
    alert_type TEXT NOT NULL,
    current_value NUMERIC,
    benchmark_value NUMERIC,
    deviation_pct NUMERIC,
    message TEXT,
    is_acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: churn_predictions
-- ============================================================
DROP TABLE IF EXISTS public.churn_predictions CASCADE;
CREATE TABLE public.churn_predictions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    account_id UUID REFERENCES public.accounts(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    churn_probability NUMERIC,
    risk_level TEXT,
    risk_factors JSONB,
    recommended_actions JSONB,
    prediction_date DATE,
    model_version TEXT,
    is_churned BOOLEAN,
    churned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: cs_health_metrics
-- ============================================================
DROP TABLE IF EXISTS public.cs_health_metrics CASCADE;
CREATE TABLE public.cs_health_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    account_id UUID REFERENCES public.accounts(id),
    metric_date DATE NOT NULL,
    health_score NUMERIC,
    engagement_score NUMERIC,
    adoption_score NUMERIC,
    satisfaction_score NUMERIC,
    support_score NUMERIC,
    drivers JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: health_score_drivers
-- ============================================================
DROP TABLE IF EXISTS public.health_score_drivers CASCADE;
CREATE TABLE public.health_score_drivers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    driver_name TEXT NOT NULL,
    driver_type TEXT NOT NULL,
    weight NUMERIC DEFAULT 1,
    calculation_method TEXT,
    thresholds JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: nrhs_events
-- ============================================================
DROP TABLE IF EXISTS public.nrhs_events CASCADE;
CREATE TABLE public.nrhs_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    event_type TEXT NOT NULL,
    event_data JSONB,
    health_score_before NUMERIC,
    health_score_after NUMERIC,
    driver_impacts JSONB,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: vibe_state_history
-- ============================================================
DROP TABLE IF EXISTS public.vibe_state_history CASCADE;
CREATE TABLE public.vibe_state_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
    previous_state TEXT,
    new_state TEXT NOT NULL,
    trigger_event TEXT,
    trigger_data JSONB,
    changed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
