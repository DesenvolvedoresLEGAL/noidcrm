CREATE POLICY nsec12_opportunities_insert_account_contact_tenant_guard
ON public.opportunities
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = opportunities.account_id
        AND a.organization_id = opportunities.organization_id
    )
  )
  AND
  (
    contact_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = opportunities.contact_id
        AND c.organization_id = opportunities.organization_id
    )
  )
);