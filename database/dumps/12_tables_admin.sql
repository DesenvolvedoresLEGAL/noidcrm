-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 12_tables_admin.sql
-- Generated: 2026-01-07
-- Description: Admin, Audit, Security, Logs tables
-- Tables: 16 tables
-- ============================================================

-- ============================================================
-- TABLE: audit_log
-- ============================================================
DROP TABLE IF EXISTS public.audit_log CASCADE;
CREATE TABLE public.audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
-- TABLE: auth_audit_log
-- ============================================================
DROP TABLE IF EXISTS public.auth_audit_log CASCADE;
CREATE TABLE public.auth_audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    email TEXT,
    event_type TEXT NOT NULL,
    success BOOLEAN,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    device_type TEXT,
    browser_hash TEXT,
    canvas_hash TEXT,
    screen_resolution TEXT,
    language TEXT,
    timezone TEXT,
    country_code TEXT,
    country_name TEXT,
    region TEXT,
    city TEXT,
    is_vpn BOOLEAN,
    is_proxy BOOLEAN,
    isp TEXT,
    page_url TEXT,
    referrer TEXT,
    resource_type TEXT,
    resource_id TEXT,
    action_details TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: security_audit_log
-- ============================================================
DROP TABLE IF EXISTS public.security_audit_log CASCADE;
CREATE TABLE public.security_audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    user_id UUID,
    event_type TEXT NOT NULL,
    event_category TEXT,
    severity TEXT DEFAULT 'info',
    resource_type TEXT,
    resource_id UUID,
    action TEXT,
    outcome TEXT,
    ip_address INET,
    user_agent TEXT,
    geo_location JSONB,
    risk_score NUMERIC,
    risk_factors JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: admin_access_logs
-- ============================================================
DROP TABLE IF EXISTS public.admin_access_logs CASCADE;
CREATE TABLE public.admin_access_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    action TEXT NOT NULL,
    resource TEXT,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: user_access_logs
-- ============================================================
DROP TABLE IF EXISTS public.user_access_logs CASCADE;
CREATE TABLE public.user_access_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    session_id TEXT,
    page_path TEXT,
    page_title TEXT,
    referrer TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    ip_address INET,
    geo_country TEXT,
    geo_city TEXT,
    duration_seconds INTEGER,
    actions JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: user_first_visits
-- ============================================================
DROP TABLE IF EXISTS public.user_first_visits CASCADE;
CREATE TABLE public.user_first_visits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    organization_id UUID REFERENCES public.organizations(id),
    first_visit_at TIMESTAMPTZ DEFAULT now(),
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    landing_page TEXT,
    device_type TEXT,
    browser TEXT,
    country TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: platform_admins
-- ============================================================
DROP TABLE IF EXISTS public.platform_admins CASCADE;
CREATE TABLE public.platform_admins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    role TEXT DEFAULT 'admin',
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_access_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: permission_sets
-- ============================================================
DROP TABLE IF EXISTS public.permission_sets CASCADE;
CREATE TABLE public.permission_sets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: backup_history
-- ============================================================
DROP TABLE IF EXISTS public.backup_history CASCADE;
CREATE TABLE public.backup_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    backup_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    file_url TEXT,
    size_bytes BIGINT,
    entities_count JSONB,
    error_message TEXT,
    created_by UUID,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: export_logs
-- ============================================================
DROP TABLE IF EXISTS public.export_logs CASCADE;
CREATE TABLE public.export_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    export_type TEXT NOT NULL,
    entity_type TEXT,
    filters JSONB,
    row_count INTEGER,
    file_format TEXT DEFAULT 'csv',
    file_url TEXT,
    file_size_bytes BIGINT,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: export_templates
-- ============================================================
DROP TABLE IF EXISTS public.export_templates CASCADE;
CREATE TABLE public.export_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    columns JSONB DEFAULT '[]',
    filters JSONB DEFAULT '{}',
    sort_config JSONB,
    is_default BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: scheduled_exports
-- ============================================================
DROP TABLE IF EXISTS public.scheduled_exports CASCADE;
CREATE TABLE public.scheduled_exports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    template_id UUID REFERENCES public.export_templates(id),
    name TEXT NOT NULL,
    schedule_cron TEXT NOT NULL,
    recipients JSONB DEFAULT '[]',
    file_format TEXT DEFAULT 'csv',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: import_logs
-- ============================================================
DROP TABLE IF EXISTS public.import_logs CASCADE;
CREATE TABLE public.import_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    import_type TEXT NOT NULL,
    entity_type TEXT,
    file_name TEXT,
    file_size_bytes BIGINT,
    total_rows INTEGER,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    skip_count INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    mapping_config JSONB,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: sync_logs
-- ============================================================
DROP TABLE IF EXISTS public.sync_logs CASCADE;
CREATE TABLE public.sync_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    sync_type TEXT NOT NULL,
    provider TEXT,
    direction TEXT DEFAULT 'pull',
    status TEXT DEFAULT 'pending',
    records_synced INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: deletion_alerts
-- ============================================================
DROP TABLE IF EXISTS public.deletion_alerts CASCADE;
CREATE TABLE public.deletion_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_name TEXT,
    deletion_type TEXT DEFAULT 'soft',
    deleted_by UUID,
    reason TEXT,
    can_restore BOOLEAN DEFAULT true,
    restore_deadline TIMESTAMPTZ,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: diagnostic_results
-- ============================================================
DROP TABLE IF EXISTS public.diagnostic_results CASCADE;
CREATE TABLE public.diagnostic_results (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    diagnostic_type TEXT NOT NULL,
    category TEXT,
    status TEXT DEFAULT 'pending',
    results JSONB,
    issues_found INTEGER DEFAULT 0,
    warnings_found INTEGER DEFAULT 0,
    recommendations JSONB DEFAULT '[]',
    run_by UUID,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: rate_limit_log
-- ============================================================
DROP TABLE IF EXISTS public.rate_limit_log CASCADE;
CREATE TABLE public.rate_limit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    user_id UUID,
    endpoint TEXT NOT NULL,
    method TEXT,
    ip_address INET,
    request_count INTEGER DEFAULT 1,
    limit_exceeded BOOLEAN DEFAULT false,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: system_events
-- ============================================================
DROP TABLE IF EXISTS public.system_events CASCADE;
CREATE TABLE public.system_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    event_type TEXT NOT NULL,
    event_category TEXT,
    severity TEXT DEFAULT 'info',
    source TEXT,
    message TEXT,
    data JSONB,
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
