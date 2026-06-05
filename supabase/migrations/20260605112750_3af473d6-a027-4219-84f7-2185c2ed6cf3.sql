-- HARDEN: remove anon SELECT on opportunities (leaked internal AI/scoring fields)
DROP POLICY IF EXISTS "Public access to opportunity via proposal token"
  ON public.opportunities;

-- HARDEN: remove anon SELECT on proposal_items (leaked unit_cost / markup_percent)
DROP POLICY IF EXISTS "Public access to proposal items via token"
  ON public.proposal_items;

-- Note: the public proposal viewer reads items + sanitized opportunity data
-- via the SECURITY DEFINER RPC `get_proposal_by_public_token`, which strips
-- internal margin and AI/intelligence fields. No further grants needed.
