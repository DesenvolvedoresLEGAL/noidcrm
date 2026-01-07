-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 13_tables_config.sql
-- Generated: 2026-01-07
-- Description: Configuration, Settings, Custom Fields tables
-- Tables: 21 tables
-- ============================================================

-- ============================================================
-- TABLE: settings
-- ============================================================
DROP TABLE IF EXISTS public.settings CASCADE;
CREATE TABLE public.settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    key TEXT NOT NULL,
    value JSONB,
    category TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, key)
);

-- ============================================================
-- TABLE: organization_settings
-- ============================================================
DROP TABLE IF EXISTS public.organization_settings CASCADE;
CREATE TABLE public.organization_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) UNIQUE,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    currency TEXT DEFAULT 'BRL',
    language TEXT DEFAULT 'pt-BR',
    fiscal_year_start INTEGER DEFAULT 1,
    week_start INTEGER DEFAULT 1,
    working_days JSONB DEFAULT '[1,2,3,4,5]',
    working_hours JSONB,
    features_enabled JSONB DEFAULT '{}',
    notifications_config JSONB DEFAULT '{}',
    integrations_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: custom_fields
-- ============================================================
DROP TABLE IF EXISTS public.custom_fields CASCADE;
CREATE TABLE public.custom_fields (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    field_options JSONB,
    default_value JSONB,
    is_required BOOLEAN DEFAULT false,
    is_searchable BOOLEAN DEFAULT false,
    is_filterable BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    group_id UUID REFERENCES public.custom_field_groups(id),
    validation_rules JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, entity_type, field_name)
);

-- ============================================================
-- TABLE: custom_field_values
-- ============================================================
DROP TABLE IF EXISTS public.custom_field_values CASCADE;
CREATE TABLE public.custom_field_values (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(custom_field_id, entity_id)
);

-- ============================================================
-- TABLE: custom_field_groups
-- ============================================================
DROP TABLE IF EXISTS public.custom_field_groups CASCADE;
CREATE TABLE public.custom_field_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_collapsed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: custom_forms
-- ============================================================
DROP TABLE IF EXISTS public.custom_forms CASCADE;
CREATE TABLE public.custom_forms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    entity_type TEXT,
    form_type TEXT DEFAULT 'survey',
    fields JSONB DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    public_url_slug TEXT UNIQUE,
    submission_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: custom_form_values
-- ============================================================
DROP TABLE IF EXISTS public.custom_form_values CASCADE;
CREATE TABLE public.custom_form_values (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    form_id UUID NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
    entity_type TEXT,
    entity_id UUID,
    respondent_id UUID,
    respondent_email TEXT,
    responses JSONB NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: business_units
-- ============================================================
DROP TABLE IF EXISTS public.business_units CASCADE;
CREATE TABLE public.business_units (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    parent_id UUID REFERENCES public.business_units(id),
    manager_id UUID,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: industries
-- ============================================================
DROP TABLE IF EXISTS public.industries CASCADE;
CREATE TABLE public.industries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    parent_id UUID REFERENCES public.industries(id),
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: territories
-- ============================================================
DROP TABLE IF EXISTS public.territories CASCADE;
CREATE TABLE public.territories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    type TEXT DEFAULT 'geographic',
    parent_id UUID REFERENCES public.territories(id),
    boundaries JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: territory_assignments
-- ============================================================
DROP TABLE IF EXISTS public.territory_assignments CASCADE;
CREATE TABLE public.territory_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    territory_id UUID NOT NULL REFERENCES public.territories(id),
    assignee_type TEXT NOT NULL,
    assignee_id UUID NOT NULL,
    role TEXT DEFAULT 'owner',
    is_primary BOOLEAN DEFAULT false,
    effective_from TIMESTAMPTZ DEFAULT now(),
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: products
-- ============================================================
DROP TABLE IF EXISTS public.products CASCADE;
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    category_id UUID REFERENCES public.product_categories(id),
    type TEXT DEFAULT 'product',
    pricing_model TEXT DEFAULT 'one_time',
    base_price NUMERIC,
    currency TEXT DEFAULT 'BRL',
    unit_id UUID REFERENCES public.measurement_units(id),
    cost NUMERIC,
    margin_pct NUMERIC,
    tax_rate NUMERIC,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: product_categories
-- ============================================================
DROP TABLE IF EXISTS public.product_categories CASCADE;
CREATE TABLE public.product_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    parent_id UUID REFERENCES public.product_categories(id),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: product_price_history
-- ============================================================
DROP TABLE IF EXISTS public.product_price_history CASCADE;
CREATE TABLE public.product_price_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    product_id UUID NOT NULL REFERENCES public.products(id),
    old_price NUMERIC,
    new_price NUMERIC,
    change_reason TEXT,
    changed_by UUID,
    effective_from TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: measurement_units
-- ============================================================
DROP TABLE IF EXISTS public.measurement_units CASCADE;
CREATE TABLE public.measurement_units (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    category TEXT,
    base_unit_id UUID REFERENCES public.measurement_units(id),
    conversion_factor NUMERIC DEFAULT 1,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: origins
-- ============================================================
DROP TABLE IF EXISTS public.origins CASCADE;
CREATE TABLE public.origins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    group_id UUID REFERENCES public.origin_groups(id),
    type TEXT DEFAULT 'inbound',
    channel TEXT,
    is_active BOOLEAN DEFAULT true,
    conversion_rate NUMERIC,
    avg_deal_size NUMERIC,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: origin_groups
-- ============================================================
DROP TABLE IF EXISTS public.origin_groups CASCADE;
CREATE TABLE public.origin_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: icp_profiles
-- ============================================================
DROP TABLE IF EXISTS public.icp_profiles CASCADE;
CREATE TABLE public.icp_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB DEFAULT '{}',
    weight NUMERIC DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    match_count INTEGER DEFAULT 0,
    avg_conversion_rate NUMERIC,
    avg_deal_size NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: fit_score_config
-- ============================================================
DROP TABLE IF EXISTS public.fit_score_config CASCADE;
CREATE TABLE public.fit_score_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    config_type TEXT DEFAULT 'default',
    rules JSONB DEFAULT '[]',
    weights JSONB DEFAULT '{}',
    thresholds JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: scoring_rules
-- ============================================================
DROP TABLE IF EXISTS public.scoring_rules CASCADE;
CREATE TABLE public.scoring_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    score_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    conditions JSONB DEFAULT '[]',
    points INTEGER NOT NULL,
    max_applications INTEGER,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: dynamic_variables
-- ============================================================
DROP TABLE IF EXISTS public.dynamic_variables CASCADE;
CREATE TABLE public.dynamic_variables (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    category TEXT,
    data_type TEXT DEFAULT 'string',
    source_type TEXT,
    source_config JSONB,
    default_value TEXT,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: holidays
-- ============================================================
DROP TABLE IF EXISTS public.holidays CASCADE;
CREATE TABLE public.holidays (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT DEFAULT 'national',
    is_recurring BOOLEAN DEFAULT false,
    country_code TEXT,
    state_code TEXT,
    city_code TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: dashboard_preferences
-- ============================================================
DROP TABLE IF EXISTS public.dashboard_preferences CASCADE;
CREATE TABLE public.dashboard_preferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    dashboard_type TEXT NOT NULL,
    layout JSONB DEFAULT '{}',
    widgets JSONB DEFAULT '[]',
    filters JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, dashboard_type)
);
