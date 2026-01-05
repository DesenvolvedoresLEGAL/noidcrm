-- Fix definitive contract deletion: remove dependency on "current org" RPC
-- Policy previously required contracts.organization_id = get_user_organization_id(),
-- which blocks deletion when user belongs to multiple orgs.

DROP POLICY IF EXISTS "Privileged members can delete contracts" ON public.contracts;

CREATE POLICY "Privileged members can delete contracts"
ON public.contracts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = contracts.organization_id
      AND om.status = 'active'
      AND om.org_role = ANY (ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'finance'::public.org_role, 'operations'::public.org_role, 'cs'::public.org_role])
  )
);
