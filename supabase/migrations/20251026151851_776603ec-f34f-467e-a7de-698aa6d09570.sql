-- =====================================================
-- FIX CRITICAL SECURITY ISSUE: Enforce organization_id requirement
-- This migration removes NULL organization_id bypass in RLS policies
-- =====================================================

-- STEP 1: Update any NULL organization_id records to first available org
-- (In production, you would map these to specific orgs based on business logic)
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the first organization ID as default
  SELECT id INTO default_org_id FROM public.organizations LIMIT 1;
  
  -- Only update if we have at least one organization
  IF default_org_id IS NOT NULL THEN
    UPDATE public.profiles SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.opportunities SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.activities SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.contacts SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.accounts SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.contracts SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.proposals SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.sequences SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.pipelines SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.stages SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.settings SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.automation_config SET organization_id = default_org_id WHERE organization_id IS NULL;
  END IF;
END $$;

-- STEP 2: Make organization_id NOT NULL on all tables
ALTER TABLE public.accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.activities ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.automation_config ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.opportunities ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.pipelines ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.proposals ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.sequences ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stages ALTER COLUMN organization_id SET NOT NULL;

-- STEP 3: Drop old permissive RLS policies
DROP POLICY IF EXISTS "Users can view org accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert org accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update org accounts" ON public.accounts;

DROP POLICY IF EXISTS "Users can view org activities" ON public.activities;
DROP POLICY IF EXISTS "Users can insert in own org activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update org activities" ON public.activities;

DROP POLICY IF EXISTS "Users can view org automation config" ON public.automation_config;

DROP POLICY IF EXISTS "Users can view org contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert org contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update org contacts" ON public.contacts;

DROP POLICY IF EXISTS "Users can view org contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can insert org contracts" ON public.contracts;

DROP POLICY IF EXISTS "Users can view org opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can insert in own org opps" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update org opportunities" ON public.opportunities;

DROP POLICY IF EXISTS "Users can view org pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users can insert org pipelines" ON public.pipelines;

DROP POLICY IF EXISTS "Users can view org profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view org proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can insert org proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can update org proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can delete org proposals" ON public.proposals;

DROP POLICY IF EXISTS "Users can view org sequences" ON public.sequences;

DROP POLICY IF EXISTS "Users can view org settings" ON public.settings;

DROP POLICY IF EXISTS "Users can view org stages" ON public.stages;
DROP POLICY IF EXISTS "Users can insert org stages" ON public.stages;

-- STEP 4: Create new strict RLS policies WITHOUT NULL bypass
-- Accounts
CREATE POLICY "Users can view org accounts"
  ON public.accounts FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org accounts"
  ON public.accounts FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Activities
CREATE POLICY "Users can view org activities"
  ON public.activities FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert in own org activities"
  ON public.activities FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org activities"
  ON public.activities FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Automation Config
CREATE POLICY "Users can view org automation config"
  ON public.automation_config FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Contacts
CREATE POLICY "Users can view org contacts"
  ON public.contacts FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org contacts"
  ON public.contacts FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Contracts
CREATE POLICY "Users can view org contracts"
  ON public.contracts FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Opportunities
CREATE POLICY "Users can view org opportunities"
  ON public.opportunities FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert in own org opps"
  ON public.opportunities FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org opportunities"
  ON public.opportunities FOR UPDATE
  USING (organization_id = get_user_organization_id() AND (owner_user_id = auth.uid() OR has_role(auth.uid(), 'admin')));

-- Pipelines
CREATE POLICY "Users can view org pipelines"
  ON public.pipelines FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org pipelines"
  ON public.pipelines FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Profiles
CREATE POLICY "Users can view org profiles"
  ON public.profiles FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Proposals
CREATE POLICY "Users can view org proposals"
  ON public.proposals FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org proposals"
  ON public.proposals FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org proposals"
  ON public.proposals FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete org proposals"
  ON public.proposals FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Sequences
CREATE POLICY "Users can view org sequences"
  ON public.sequences FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Settings
CREATE POLICY "Users can view org settings"
  ON public.settings FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Stages
CREATE POLICY "Users can view org stages"
  ON public.stages FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org stages"
  ON public.stages FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());