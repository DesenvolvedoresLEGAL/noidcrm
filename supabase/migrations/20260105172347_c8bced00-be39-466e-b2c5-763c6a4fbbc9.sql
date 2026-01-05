-- Fix contracts DELETE policy to allow privileged org members (owner/admin/finance/operations/cs)

-- Ensure RLS is enabled (no-op if already)
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Drop legacy delete policy if present
DROP POLICY IF EXISTS "Admins delete contracts" ON public.contracts;

-- Create delete policy based on organization membership role
CREATE POLICY "Privileged members can delete contracts"
ON public.contracts
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = public.contracts.organization_id
      AND om.status = 'active'
      AND om.org_role IN ('owner','admin','finance','operations','cs')
  )
);
