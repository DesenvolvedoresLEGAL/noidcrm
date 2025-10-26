-- Drop existing conflicting policies on organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update organization" ON public.organizations;
DROP POLICY IF EXISTS "System can insert organizations" ON public.organizations;

-- CREATE: Allow authenticated users to create organizations
-- This is needed for the onboarding flow where users create their first workspace
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- READ: Allow users to view organizations they are members of
CREATE POLICY "Users can view their organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid() 
        AND status = 'active'
    )
  );

-- UPDATE: Only organization admins can update organization details
CREATE POLICY "Org admins can update organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (user_is_org_admin(id))
  WITH CHECK (user_is_org_admin(id));

-- DELETE: Only organization owners can delete (extra security)
CREATE POLICY "Organization owners can delete"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.organization_members 
      WHERE user_id = auth.uid() 
        AND organization_id = id 
        AND role = 'owner'
        AND status = 'active'
    )
  );