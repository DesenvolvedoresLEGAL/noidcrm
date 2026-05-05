CREATE INDEX IF NOT EXISTS idx_opportunities_owner_active
  ON public.opportunities (owner_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_opportunity_status
  ON public.proposals (opportunity_id, status);

CREATE INDEX IF NOT EXISTS idx_activities_opportunity_created
  ON public.activities (opportunity_id, created_at DESC);

ANALYZE public.opportunities;
ANALYZE public.proposals;
ANALYZE public.activities;