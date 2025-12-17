
-- Remove the platform admin bypass policy from activities table
-- Platform admins should only access cross-org data via Admin Panel (service role)
-- not in the regular app interface
DROP POLICY IF EXISTS "Platform admins can view all activities" ON public.activities;

-- Also check and remove from other tables that might have similar issues
DROP POLICY IF EXISTS "Platform admins can view all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Platform admins can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Platform admins can view all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Platform admins can view all proposals" ON public.proposals;

-- Verify the remaining SELECT policies ensure proper org isolation
-- The "Org members view activities" and "activities_select_by_visibility" policies 
-- already enforce organization_id = get_user_organization_id()
