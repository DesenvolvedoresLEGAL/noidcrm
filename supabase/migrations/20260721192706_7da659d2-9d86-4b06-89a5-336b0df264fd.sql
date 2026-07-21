CREATE POLICY nsec12_opportunities_insert_account_contact_match_guard
ON public.opportunities
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IS NULL
  OR contact_id IS NULL
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = opportunities.contact_id
      AND c.account_id = opportunities.account_id
  )
);