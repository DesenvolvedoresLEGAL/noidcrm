-- 1. Drop and recreate all public proposal policies with correct status list and end-of-day expiry

-- Fix proposals public policies
DROP POLICY IF EXISTS "Public token proposal access with expiration" ON public.proposals;
DROP POLICY IF EXISTS "Public proposals are viewable via token with expiration" ON public.proposals;

CREATE POLICY "public_token_proposal_access"
ON public.proposals
FOR SELECT
TO anon
USING (
  public_token IS NOT NULL
  AND deleted_at IS NULL
  AND status IN ('sent', 'viewed', 'accepted', 'rejected')
  AND (
    expires_at IS NULL
    OR (expires_at::date + interval '1 day') > now()
  )
);

-- Fix organizations anon policy
DROP POLICY IF EXISTS "anon_read_org_via_public_proposal" ON public.organizations;

CREATE POLICY "anon_read_org_via_public_proposal"
ON public.organizations
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.organization_id = organizations.id
      AND p.public_token IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.status IN ('sent', 'viewed', 'accepted', 'rejected')
  )
);

-- Fix proposal_layouts anon policy
DROP POLICY IF EXISTS "anon_read_layout_via_public_proposal" ON public.proposal_layouts;

CREATE POLICY "anon_read_layout_via_public_proposal"
ON public.proposal_layouts
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.layout_id = proposal_layouts.id
      AND p.public_token IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.status IN ('sent', 'viewed', 'accepted', 'rejected')
  )
);

-- Fix proposal_layout_pages anon policy
DROP POLICY IF EXISTS "anon_read_layout_pages_via_public_proposal" ON public.proposal_layout_pages;

CREATE POLICY "anon_read_layout_pages_via_public_proposal"
ON public.proposal_layout_pages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM proposal_layouts pl
    JOIN proposals p ON p.layout_id = pl.id
    WHERE pl.id = proposal_layout_pages.layout_id
      AND p.public_token IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.status IN ('sent', 'viewed', 'accepted', 'rejected')
  )
);