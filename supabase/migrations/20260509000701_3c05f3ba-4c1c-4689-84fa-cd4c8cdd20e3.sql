-- Remove broad anon RLS policies that exposed full PII rows of accounts, contacts, and organizations.
-- The public proposal page already uses the SECURITY DEFINER RPC `get_proposal_by_public_token`,
-- which returns a curated bundle with PII/financial fields stripped.
-- Keeping these anon SELECT policies would allow anyone holding a proposal token to read CPF, RG,
-- emails/phones, CNPJ, legal addresses, and financial risk data via the PostgREST API.

DROP POLICY IF EXISTS "Public access to account via proposal token" ON public.accounts;
DROP POLICY IF EXISTS "Public access to contact via proposal token" ON public.contacts;
DROP POLICY IF EXISTS "anon_read_org_via_public_proposal" ON public.organizations;