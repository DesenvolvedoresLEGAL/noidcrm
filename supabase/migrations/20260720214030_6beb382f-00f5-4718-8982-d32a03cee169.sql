-- NSEC-1.2-CHG-003: Bloqueia INSERT de viewer em public.accounts
-- Aditiva, RESTRICTIVE, reversível com: DROP POLICY IF EXISTS nsec12_accounts_insert_block_viewer ON public.accounts;
CREATE POLICY "nsec12_accounts_insert_block_viewer"
ON public.accounts
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = accounts.organization_id
      AND om.status = 'active'
      AND (
        om.org_role = 'viewer'
        OR (om.org_role IS NULL AND om.role = 'viewer')
      )
  )
);