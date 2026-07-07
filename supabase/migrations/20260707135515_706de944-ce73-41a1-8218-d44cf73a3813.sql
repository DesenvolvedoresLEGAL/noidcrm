
CREATE TABLE public.proposal_inventory_demand_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  snapshot_version integer NOT NULL DEFAULT 1,
  algorithm_version text NOT NULL DEFAULT 'noid-inv-demand-v1',
  status text NOT NULL DEFAULT 'preview_snapshot',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  commercial_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  hash text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_inventory_demand_snapshots_version_unique UNIQUE (proposal_id, snapshot_version)
);

CREATE INDEX idx_proposal_inv_demand_snapshots_org
  ON public.proposal_inventory_demand_snapshots(organization_id);
CREATE INDEX idx_proposal_inv_demand_snapshots_proposal
  ON public.proposal_inventory_demand_snapshots(organization_id, proposal_id);
CREATE INDEX idx_proposal_inv_demand_snapshots_created_at
  ON public.proposal_inventory_demand_snapshots(organization_id, proposal_id, created_at DESC);

GRANT SELECT, INSERT ON public.proposal_inventory_demand_snapshots TO authenticated;
GRANT ALL ON public.proposal_inventory_demand_snapshots TO service_role;

ALTER TABLE public.proposal_inventory_demand_snapshots ENABLE ROW LEVEL SECURITY;

-- Read: same visibility as parent proposal
CREATE POLICY proposal_inv_demand_snapshots_select
ON public.proposal_inventory_demand_snapshots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_id
      AND public.user_can_access_proposal(p.organization_id, p.opportunity_id)
  )
);

-- Insert: same access as writing to the proposal (own or manager scope)
CREATE POLICY proposal_inv_demand_snapshots_insert
ON public.proposal_inventory_demand_snapshots
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_id
      AND p.organization_id = organization_id
      AND public.user_can_access_proposal(p.organization_id, p.opportunity_id)
  )
);

-- No UPDATE policy (immutable)
-- No DELETE policy (never deleted from UI)
