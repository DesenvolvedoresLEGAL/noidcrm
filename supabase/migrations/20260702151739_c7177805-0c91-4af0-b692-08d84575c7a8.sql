GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

DROP POLICY IF EXISTS "Users view contacts by role and account" ON public.contacts;

CREATE POLICY "Users view contacts in own org"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND deleted_at IS NULL
);

DROP POLICY IF EXISTS "Users insert contacts in own org" ON public.contacts;

CREATE POLICY "Users insert contacts in own org"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND organization_id = public.get_user_organization_id()
  AND (
    account_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = contacts.account_id
        AND a.organization_id = contacts.organization_id
        AND a.deleted_at IS NULL
    )
  )
);