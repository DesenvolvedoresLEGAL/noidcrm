
-- Phase 1: Create function to check if user is platform admin (for RLS bypass)
CREATE OR REPLACE FUNCTION public.is_platform_admin_for_rls(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins 
    WHERE platform_admins.user_id = $1 
    AND is_active = true
  );
$$;

-- Update organizations RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON organizations;
CREATE POLICY "Platform admins can view all organizations" 
ON organizations 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update profiles RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON profiles;
CREATE POLICY "Platform admins can view all profiles" 
ON profiles 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update organization_members RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all org members" ON organization_members;
CREATE POLICY "Platform admins can view all org members" 
ON organization_members 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update opportunities RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all opportunities" ON opportunities;
CREATE POLICY "Platform admins can view all opportunities" 
ON opportunities 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update proposals RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all proposals" ON proposals;
CREATE POLICY "Platform admins can view all proposals" 
ON proposals 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update activities RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all activities" ON activities;
CREATE POLICY "Platform admins can view all activities" 
ON activities 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update ai_usage_logs RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all ai_usage_logs" ON ai_usage_logs;
CREATE POLICY "Platform admins can view all ai_usage_logs" 
ON ai_usage_logs 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update accounts RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all accounts" ON accounts;
CREATE POLICY "Platform admins can view all accounts" 
ON accounts 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update proposal_payment_terms RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all proposal_payment_terms" ON proposal_payment_terms;
CREATE POLICY "Platform admins can view all proposal_payment_terms" 
ON proposal_payment_terms 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));

-- Update contracts RLS to allow platform admins full SELECT access
DROP POLICY IF EXISTS "Platform admins can view all contracts" ON contracts;
CREATE POLICY "Platform admins can view all contracts" 
ON contracts 
FOR SELECT 
TO authenticated
USING (is_platform_admin_for_rls(auth.uid()));
