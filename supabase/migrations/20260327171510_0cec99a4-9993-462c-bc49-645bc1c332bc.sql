
-- Allow anonymous read on organizations linked to proposals with valid public_token
CREATE POLICY "anon_read_org_via_public_proposal"
ON public.organizations
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.organization_id = organizations.id
      AND p.public_token IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.status IN ('sent', 'viewed', 'accepted', 'declined')
  )
);

-- Allow anonymous read on proposal_layouts linked to proposals with valid public_token
CREATE POLICY "anon_read_layout_via_public_proposal"
ON public.proposal_layouts
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.layout_id = proposal_layouts.id
      AND p.public_token IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.status IN ('sent', 'viewed', 'accepted', 'declined')
  )
);

-- Allow anonymous read on proposal_layout_pages linked to layouts of public proposals
CREATE POLICY "anon_read_layout_pages_via_public_proposal"
ON public.proposal_layout_pages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.proposal_layouts pl
    JOIN public.proposals p ON p.layout_id = pl.id
    WHERE pl.id = proposal_layout_pages.layout_id
      AND p.public_token IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.status IN ('sent', 'viewed', 'accepted', 'declined')
  )
);
