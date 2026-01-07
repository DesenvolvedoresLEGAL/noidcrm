-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 09_tables_billing.sql
-- Generated: 2026-01-07
-- Description: Billing, Subscriptions, Payments, Trials tables
-- Tables: 14 tables
-- ============================================================

-- ============================================================
-- TABLE: billing_subscriptions
-- ============================================================
DROP TABLE IF EXISTS public.billing_subscriptions CASCADE;
CREATE TABLE public.billing_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    plan_id UUID REFERENCES public.plans(id),
    status TEXT DEFAULT 'active',
    billing_cycle TEXT DEFAULT 'monthly',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    abacatepay_subscription_id TEXT,
    abacatepay_customer_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: billing_invoices
-- ============================================================
DROP TABLE IF EXISTS public.billing_invoices CASCADE;
CREATE TABLE public.billing_invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    subscription_id UUID REFERENCES public.billing_subscriptions(id),
    invoice_number TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'BRL',
    status TEXT DEFAULT 'pending',
    description TEXT,
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    invoice_pdf_url TEXT,
    abacatepay_invoice_id TEXT,
    abacatepay_payment_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: billing_payment_methods
-- ============================================================
DROP TABLE IF EXISTS public.billing_payment_methods CASCADE;
CREATE TABLE public.billing_payment_methods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    type TEXT DEFAULT 'card',
    card_brand TEXT,
    card_last4 TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    billing_name TEXT,
    billing_email TEXT,
    is_default BOOLEAN DEFAULT false,
    abacatepay_payment_method_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: billing_payments
-- ============================================================
DROP TABLE IF EXISTS public.billing_payments CASCADE;
CREATE TABLE public.billing_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    amount NUMERIC NOT NULL,
    payment_method TEXT,
    payment_date TIMESTAMPTZ NOT NULL,
    reference TEXT,
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: seat_events
-- ============================================================
DROP TABLE IF EXISTS public.seat_events CASCADE;
CREATE TABLE public.seat_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    event_type TEXT NOT NULL,
    user_id UUID,
    seat_count_before INTEGER,
    seat_count_after INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: org_billing_snapshots
-- ============================================================
DROP TABLE IF EXISTS public.org_billing_snapshots CASCADE;
CREATE TABLE public.org_billing_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    snapshot_date DATE NOT NULL,
    plan_id UUID,
    plan_name TEXT,
    seat_count INTEGER,
    mrr NUMERIC,
    status TEXT,
    features_used JSONB,
    usage_metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: org_volts_balance
-- ============================================================
DROP TABLE IF EXISTS public.org_volts_balance CASCADE;
CREATE TABLE public.org_volts_balance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) UNIQUE,
    current_balance NUMERIC DEFAULT 0,
    total_purchased NUMERIC DEFAULT 0,
    total_consumed NUMERIC DEFAULT 0,
    last_purchase_at TIMESTAMPTZ,
    last_consumption_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: subscriptions (Legacy)
-- ============================================================
DROP TABLE IF EXISTS public.subscriptions CASCADE;
CREATE TABLE public.subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: trial_blocks
-- ============================================================
DROP TABLE IF EXISTS public.trial_blocks CASCADE;
CREATE TABLE public.trial_blocks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL,
    identifier_type TEXT NOT NULL,
    reason TEXT,
    blocked_by UUID,
    blocked_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    is_permanent BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: trial_fingerprints
-- ============================================================
DROP TABLE IF EXISTS public.trial_fingerprints CASCADE;
CREATE TABLE public.trial_fingerprints (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL,
    user_id UUID,
    organization_id UUID,
    browser_hash TEXT,
    canvas_hash TEXT,
    device_info JSONB,
    ip_addresses JSONB DEFAULT '[]',
    trial_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    is_blocked BOOLEAN DEFAULT false,
    blocked_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: trial_notifications
-- ============================================================
DROP TABLE IF EXISTS public.trial_notifications CASCADE;
CREATE TABLE public.trial_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    notification_type TEXT NOT NULL,
    days_remaining INTEGER,
    sent_at TIMESTAMPTZ DEFAULT now(),
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: ip_trial_attempts
-- ============================================================
DROP TABLE IF EXISTS public.ip_trial_attempts CASCADE;
CREATE TABLE public.ip_trial_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address INET NOT NULL,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT now(),
    last_attempt_at TIMESTAMPTZ DEFAULT now(),
    is_blocked BOOLEAN DEFAULT false,
    blocked_at TIMESTAMPTZ,
    user_agents JSONB DEFAULT '[]',
    emails_used JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: organization_billing_status
-- ============================================================
DROP TABLE IF EXISTS public.organization_billing_status CASCADE;
CREATE TABLE public.organization_billing_status (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) UNIQUE,
    status TEXT DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    grace_period_ends_at TIMESTAMPTZ,
    is_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    last_payment_at TIMESTAMPTZ,
    next_billing_date TIMESTAMPTZ,
    outstanding_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: usage_counters
-- ============================================================
DROP TABLE IF EXISTS public.usage_counters CASCADE;
CREATE TABLE public.usage_counters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    counter_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    current_value INTEGER DEFAULT 0,
    limit_value INTEGER,
    overage_allowed BOOLEAN DEFAULT false,
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, counter_type, period_start)
);
