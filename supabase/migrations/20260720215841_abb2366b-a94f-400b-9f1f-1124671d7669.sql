CREATE POLICY nsec12_contacts_insert_block_viewer
ON public.contacts
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = contacts.organization_id
      AND om.status = 'active'
      AND (
        om.org_role = 'viewer'::org_role
        OR (om.org_role IS NULL AND om.role = 'viewer')
      )
  )
);