-- Allow anonymous access to opportunities linked to proposals with public tokens
CREATE POLICY "Public access to opportunity via proposal token"
ON public.opportunities
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.opportunity_id = opportunities.id
    AND p.public_token IS NOT NULL
    AND p.status IN ('sent', 'viewed', 'accepted', 'rejected')
  )
);

-- Allow anonymous access to accounts linked via opportunities that have proposals with public tokens
CREATE POLICY "Public access to account via proposal token"
ON public.accounts
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o
    JOIN public.proposals p ON p.opportunity_id = o.id
    WHERE o.account_id = accounts.id
    AND p.public_token IS NOT NULL
    AND p.status IN ('sent', 'viewed', 'accepted', 'rejected')
  )
);

-- Allow anonymous access to contacts linked via opportunities that have proposals with public tokens
CREATE POLICY "Public access to contact via proposal token"
ON public.contacts
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o
    JOIN public.proposals p ON p.opportunity_id = o.id
    WHERE o.contact_id = contacts.id
    AND p.public_token IS NOT NULL
    AND p.status IN ('sent', 'viewed', 'accepted', 'rejected')
  )
);