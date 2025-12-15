-- Drop and recreate the delete policy to include managers
DROP POLICY IF EXISTS "Admins can delete org opportunities" ON public.opportunities;

CREATE POLICY "Admins and managers can delete org opportunities"
ON public.opportunities
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = opportunities.organization_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'manager')
  )
);