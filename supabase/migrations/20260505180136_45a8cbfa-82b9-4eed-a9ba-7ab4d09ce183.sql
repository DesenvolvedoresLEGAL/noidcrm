
-- =====================================================================
-- Performance hardening: restrict "Public access via proposal token"
-- policies to anonymous role only, so the planner short-circuits the
-- expensive EXISTS(proposals) check for authenticated users.
-- =====================================================================

-- Opportunities
DROP POLICY IF EXISTS "Public access to opportunity via proposal token" ON public.opportunities;
CREATE POLICY "Public access to opportunity via proposal token"
ON public.opportunities
FOR SELECT
TO anon
USING (
  auth.uid() IS NULL
  AND EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.opportunity_id = opportunities.id
      AND p.public_token IS NOT NULL
      AND p.status = ANY (ARRAY['sent','viewed','accepted','rejected'])
  )
);

-- Accounts
DROP POLICY IF EXISTS "Public access to account via proposal token" ON public.accounts;
CREATE POLICY "Public access to account via proposal token"
ON public.accounts
FOR SELECT
TO anon
USING (
  auth.uid() IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.opportunities o
    JOIN public.proposals p ON p.opportunity_id = o.id
    WHERE o.account_id = accounts.id
      AND p.public_token IS NOT NULL
      AND p.status = ANY (ARRAY['sent','viewed','accepted','rejected'])
  )
);

-- Contacts
DROP POLICY IF EXISTS "Public access to contact via proposal token" ON public.contacts;
CREATE POLICY "Public access to contact via proposal token"
ON public.contacts
FOR SELECT
TO anon
USING (
  auth.uid() IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.opportunities o
    JOIN public.proposals p ON p.opportunity_id = o.id
    WHERE o.contact_id = contacts.id
      AND p.public_token IS NOT NULL
      AND p.status = ANY (ARRAY['sent','viewed','accepted','rejected'])
  )
);

-- Helpful supporting indexes for the EXISTS join (idempotent)
CREATE INDEX IF NOT EXISTS idx_opportunities_account_id
  ON public.opportunities (account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id
  ON public.opportunities (contact_id) WHERE deleted_at IS NULL;
