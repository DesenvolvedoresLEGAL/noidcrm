-- Fix overly permissive opportunity policies
DROP POLICY IF EXISTS "Users can insert opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update opportunities" ON public.opportunities;

-- Add proper UPDATE policy for opportunities
CREATE POLICY "Users can update org opportunities"
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING (
    (organization_id = get_user_organization_id()) AND
    (owner_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Fix missing UPDATE and DELETE policies on contacts
CREATE POLICY "Users can update org contacts"
  ON public.contacts
  FOR UPDATE
  TO authenticated
  USING (
    (organization_id = get_user_organization_id()) OR (organization_id IS NULL)
  );

CREATE POLICY "Admins can delete org contacts"
  ON public.contacts
  FOR DELETE
  TO authenticated
  USING (
    user_is_org_admin(organization_id) OR 
    (organization_id = get_user_organization_id() AND organization_id IS NOT NULL)
  );

-- Fix missing UPDATE and DELETE policies on accounts
CREATE POLICY "Users can update org accounts"
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (
    (organization_id = get_user_organization_id()) OR (organization_id IS NULL)
  );

CREATE POLICY "Admins can delete org accounts"
  ON public.accounts
  FOR DELETE
  TO authenticated
  USING (
    user_is_org_admin(organization_id) OR 
    (organization_id = get_user_organization_id() AND organization_id IS NOT NULL)
  );

-- Fix missing DELETE policy on activities
CREATE POLICY "Admins can delete org activities"
  ON public.activities
  FOR DELETE
  TO authenticated
  USING (
    user_is_org_admin(organization_id) OR 
    (organization_id = get_user_organization_id() AND owner_user_id = auth.uid())
  );