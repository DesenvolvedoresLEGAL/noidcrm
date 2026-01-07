-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 03_tables_core.sql
-- Generated: 2026-01-07
-- Description: Core tables - Organizations, Profiles, Members
-- ============================================================

-- ==========================================
-- ORGANIZATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text,
  logo_url text,
  status text DEFAULT 'active',
  plan_id uuid,
  trial_ends_at timestamp with time zone,
  trial_extended_until timestamp with time zone,
  subscription_status text DEFAULT 'trial',
  stripe_customer_id text,
  billing_email text,
  company_document text,
  company_name text,
  seats_limit integer DEFAULT 5,
  seats_used integer DEFAULT 0,
  feature_flags jsonb DEFAULT '{}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  full_name text,
  email text,
  avatar_url text,
  phone text,
  locale text DEFAULT 'pt-BR',
  timezone text DEFAULT 'America/Sao_Paulo',
  theme text DEFAULT 'system',
  onboarding_completed boolean DEFAULT false,
  last_active_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ORGANIZATION_MEMBERS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  org_role org_role NOT NULL DEFAULT 'viewer',
  role text, -- Legacy field
  status text DEFAULT 'active',
  invited_by uuid,
  invited_at timestamp with time zone,
  joined_at timestamp with time zone DEFAULT now(),
  permissions jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PLANS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  price_monthly numeric(10,2),
  price_yearly numeric(10,2),
  currency text DEFAULT 'BRL',
  seats_included integer DEFAULT 1,
  is_public boolean DEFAULT true,
  is_active boolean DEFAULT true,
  features jsonb DEFAULT '{}'::jsonb,
  limits jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PLAN_ENTITLEMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_code text NOT NULL,
  feature_name text NOT NULL,
  limit_value integer,
  is_enabled boolean DEFAULT true,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ONBOARDING_STATUS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.onboarding_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  organization_id uuid REFERENCES public.organizations(id),
  current_step integer DEFAULT 1,
  completed_steps jsonb DEFAULT '[]'::jsonb,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  skipped_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.onboarding_status ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER_ROLES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  role app_role NOT NULL DEFAULT 'sales',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, organization_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER_INVITATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role org_role DEFAULT 'viewer',
  invited_by uuid NOT NULL,
  token text NOT NULL UNIQUE,
  status text DEFAULT 'pending',
  expires_at timestamp with time zone,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PLATFORM_ADMINS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  role platform_admin_role NOT NULL DEFAULT 'admin',
  is_active boolean DEFAULT true,
  granted_by uuid,
  granted_at timestamp with time zone DEFAULT now(),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PERMISSION_SETS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.permission_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.permission_sets ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ACTIVATION_CHECKLIST
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activation_checklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  items jsonb DEFAULT '[]'::jsonb,
  progress integer DEFAULT 0,
  completed_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.activation_checklist ENABLE ROW LEVEL SECURITY;
