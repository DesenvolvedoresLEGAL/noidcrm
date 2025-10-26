-- Fix critical RLS policy vulnerabilities
-- Remove overly permissive policies that allow public access to sensitive data

-- 1. FIX CONTACTS TABLE - Remove public read access
DROP POLICY IF EXISTS "Users can view all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;

-- Keep only organization-scoped policies for contacts
-- The "Users can view org contacts" and "Users can insert org contacts" policies already exist and are properly scoped

-- 2. FIX USER_ROLES TABLE - Remove public read access
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

-- Create policy for users to view their own roles
CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 3. FIX ACCOUNTS TABLE - Remove public read access
DROP POLICY IF EXISTS "Users can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update accounts" ON public.accounts;

-- Keep only organization-scoped policies for accounts
-- The "Users can view org accounts" and "Users can insert org accounts" policies already exist

-- 4. FIX ACTIVITIES TABLE - Remove overly permissive insert policy
DROP POLICY IF EXISTS "Users can insert activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update activities" ON public.activities;

-- Keep only organization-scoped policy for activities
-- The "Users can view org activities" and "Users can insert in own org activities" policies already exist

-- Add update policy for activities
CREATE POLICY "Users can update org activities" 
ON public.activities 
FOR UPDATE 
USING ((organization_id = get_user_organization_id()) OR (organization_id IS NULL));

-- 5. FIX AUTOMATION_LOGS TABLE - Restrict to authenticated users only
DROP POLICY IF EXISTS "Users can view automation logs" ON public.automation_logs;

-- Create organization-scoped policy for automation logs
CREATE POLICY "Users can view org automation logs" 
ON public.automation_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities 
    WHERE opportunities.id = automation_logs.opportunity_id 
    AND opportunities.organization_id = get_user_organization_id()
  )
);

-- 6. FIX AUTOMATION_CONFIG TABLE - Remove overly permissive policies
DROP POLICY IF EXISTS "Users can manage automation config" ON public.automation_config;
DROP POLICY IF EXISTS "Users can view automation config" ON public.automation_config;

-- Keep only organization-scoped view policy
-- Add admin-only modification policy
CREATE POLICY "Org admins can manage automation config" 
ON public.automation_config 
FOR ALL 
USING (user_is_org_admin(organization_id));

-- 7. FIX PIPELINES TABLE - Ensure organization scoping
DROP POLICY IF EXISTS "Users can view all pipelines" ON public.pipelines;

-- Keep only organization-scoped policy
-- The "Users can view org pipelines" policy already exists

-- 8. FIX STAGES TABLE - Ensure organization scoping
DROP POLICY IF EXISTS "Users can view all stages" ON public.stages;

-- Keep only organization-scoped policy
-- The "Users can view org stages" policy already exists

-- 9. FIX SETTINGS TABLE - Ensure proper scoping
DROP POLICY IF EXISTS "Users can view all settings" ON public.settings;

-- Keep only organization-scoped policy and admin management
-- The "Users can view org settings" and "Admins can manage settings" policies already exist

-- 10. FIX PROPOSALS TABLE - Remove overly permissive policy
DROP POLICY IF EXISTS "Users can manage proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can view proposals" ON public.proposals;

-- Keep only organization-scoped policies
-- The "Users can view org proposals" and "Users can insert org proposals" policies already exist

-- Add proper update/delete policies for proposals
CREATE POLICY "Users can update org proposals" 
ON public.proposals 
FOR UPDATE 
USING ((organization_id = get_user_organization_id()) OR (organization_id IS NULL));

CREATE POLICY "Users can delete org proposals" 
ON public.proposals 
FOR DELETE 
USING ((organization_id = get_user_organization_id()) OR (organization_id IS NULL));