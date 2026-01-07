-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 08_tables_automation.sql
-- Generated: 2026-01-07
-- Description: Automation, Workflows, Sequences tables
-- Tables: 14 tables
-- ============================================================

-- ============================================================
-- TABLE: workflow_rules
-- ============================================================
DROP TABLE IF EXISTS public.workflow_rules CASCADE;
CREATE TABLE public.workflow_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    action_type TEXT NOT NULL,
    action_config JSONB DEFAULT '{}',
    conditions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    execution_order INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
);

-- ============================================================
-- TABLE: workflow_executions
-- ============================================================
DROP TABLE IF EXISTS public.workflow_executions CASCADE;
CREATE TABLE public.workflow_executions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    workflow_rule_id UUID REFERENCES public.workflow_rules(id),
    entity_type TEXT,
    entity_id UUID,
    trigger_data JSONB,
    action_data JSONB,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: auto_tasks_rules
-- ============================================================
DROP TABLE IF EXISTS public.auto_tasks_rules CASCADE;
CREATE TABLE public.auto_tasks_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL,
    trigger_conditions JSONB DEFAULT '{}',
    task_template JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    execution_frequency TEXT,
    max_tasks_per_day INTEGER,
    last_executed_at TIMESTAMPTZ,
    executions_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: automation_config
-- ============================================================
DROP TABLE IF EXISTS public.automation_config CASCADE;
CREATE TABLE public.automation_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    pipeline_id UUID REFERENCES public.pipelines(id),
    enabled BOOLEAN DEFAULT false,
    followup_frequency_cold INTEGER,
    followup_frequency_warm INTEGER,
    followup_frequency_hot INTEGER,
    followup_frequency_burning INTEGER,
    max_messages_per_week INTEGER,
    work_hours_start TEXT,
    work_hours_end TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: automation_logs
-- ============================================================
DROP TABLE IF EXISTS public.automation_logs CASCADE;
CREATE TABLE public.automation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id UUID REFERENCES public.opportunities(id),
    action_type TEXT NOT NULL,
    channel TEXT,
    message_content TEXT,
    ai_context TEXT,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: sequences
-- ============================================================
DROP TABLE IF EXISTS public.sequences CASCADE;
CREATE TABLE public.sequences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'email',
    steps JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    total_enrolled INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: sequence_enrollments
-- ============================================================
DROP TABLE IF EXISTS public.sequence_enrollments CASCADE;
CREATE TABLE public.sequence_enrollments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    sequence_id UUID REFERENCES public.sequences(id),
    contact_id UUID REFERENCES public.contacts(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    current_step INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    enrolled_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    next_action_at TIMESTAMPTZ,
    metadata JSONB
);

-- ============================================================
-- TABLE: calendar_sync_config
-- ============================================================
DROP TABLE IF EXISTS public.calendar_sync_config CASCADE;
CREATE TABLE public.calendar_sync_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    calendar_id TEXT,
    sync_direction TEXT DEFAULT 'bidirectional',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_errors JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: email_sync_config
-- ============================================================
DROP TABLE IF EXISTS public.email_sync_config CASCADE;
CREATE TABLE public.email_sync_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    provider TEXT NOT NULL,
    email_address TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    sync_from_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_errors JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: email_templates
-- ============================================================
DROP TABLE IF EXISTS public.email_templates CASCADE;
CREATE TABLE public.email_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_text TEXT,
    category TEXT,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: auto_remediation_triggers
-- ============================================================
DROP TABLE IF EXISTS public.auto_remediation_triggers CASCADE;
CREATE TABLE public.auto_remediation_triggers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    trigger_conditions JSONB DEFAULT '{}',
    action_type TEXT NOT NULL,
    action_config JSONB,
    playbook_id UUID REFERENCES public.ai_playbooks(id),
    is_active BOOLEAN DEFAULT true,
    cooldown_hours INTEGER,
    max_triggers_per_deal INTEGER,
    trigger_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: auto_remediation_executions
-- ============================================================
DROP TABLE IF EXISTS public.auto_remediation_executions CASCADE;
CREATE TABLE public.auto_remediation_executions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    trigger_id UUID REFERENCES public.auto_remediation_triggers(id),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
    playbook_id UUID REFERENCES public.ai_playbooks(id),
    playbook_execution_id UUID REFERENCES public.playbook_executions(id),
    health_score_at_trigger NUMERIC,
    drivers_at_trigger JSONB,
    status TEXT DEFAULT 'pending',
    health_score_after NUMERIC,
    outcome_status TEXT,
    outcome_recorded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: stage_progression_suggestions
-- ============================================================
DROP TABLE IF EXISTS public.stage_progression_suggestions CASCADE;
CREATE TABLE public.stage_progression_suggestions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
    current_stage_id UUID REFERENCES public.stages(id),
    suggested_stage_id UUID REFERENCES public.stages(id),
    confidence_score NUMERIC,
    reasoning TEXT,
    factors JSONB,
    status TEXT DEFAULT 'pending',
    actioned_at TIMESTAMPTZ,
    actioned_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: gate_executions
-- ============================================================
DROP TABLE IF EXISTS public.gate_executions CASCADE;
CREATE TABLE public.gate_executions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    gate_id UUID NOT NULL REFERENCES public.performance_gates(id),
    seller_id UUID NOT NULL REFERENCES public.sellers(id),
    opportunity_id UUID REFERENCES public.opportunities(id),
    status TEXT DEFAULT 'pending',
    score NUMERIC,
    result JSONB,
    evaluated_at TIMESTAMPTZ,
    passed BOOLEAN,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
