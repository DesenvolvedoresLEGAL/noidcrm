-- Sprint 2.2 — Canonical Commercial Values Layer

CREATE OR REPLACE VIEW public.v_proposals_normalized_v2
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.organization_id,
  p.opportunity_id,
  p.status,
  p.created_at,
  p.updated_at,
  p.accepted_at,
  COALESCE(p.total_amount, 0)::numeric AS gross_amount,
  COALESCE(p.discount_amount, 0)::numeric AS discount_amount,
  (COALESCE(p.total_amount, 0) - COALESCE(p.discount_amount, 0))::numeric AS net_amount
FROM public.proposals p
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW public.v_proposals_normalized_v2 IS
  'Sprint 2.2: Normalized monetary base per proposal. Excludes soft-deleted.';

CREATE OR REPLACE VIEW public.v_opportunity_accepted_proposal_v2
WITH (security_invoker = true) AS
SELECT DISTINCT ON (p.opportunity_id)
  p.opportunity_id,
  p.id AS proposal_id,
  p.organization_id,
  p.status,
  p.gross_amount,
  p.discount_amount,
  p.net_amount,
  p.accepted_at,
  p.updated_at,
  p.created_at
FROM public.v_proposals_normalized_v2 p
WHERE p.status = 'accepted'
  AND p.opportunity_id IS NOT NULL
ORDER BY p.opportunity_id, p.accepted_at DESC NULLS LAST, p.updated_at DESC, p.created_at DESC;

COMMENT ON VIEW public.v_opportunity_accepted_proposal_v2 IS
  'Sprint 2.2: One accepted proposal per opportunity.';

CREATE OR REPLACE VIEW public.v_opportunity_latest_commercial_proposal_v2
WITH (security_invoker = true) AS
SELECT DISTINCT ON (p.opportunity_id)
  p.opportunity_id,
  p.id AS proposal_id,
  p.organization_id,
  p.status,
  p.gross_amount,
  p.discount_amount,
  p.net_amount,
  p.accepted_at,
  p.updated_at,
  p.created_at
FROM public.v_proposals_normalized_v2 p
WHERE p.opportunity_id IS NOT NULL
  AND p.status IN ('draft','sent','viewed','negotiating','approved_pending','rejected','accepted')
ORDER BY p.opportunity_id, p.updated_at DESC, p.created_at DESC;

COMMENT ON VIEW public.v_opportunity_latest_commercial_proposal_v2 IS
  'Sprint 2.2: Latest commercial proposal per opportunity.';

CREATE OR REPLACE VIEW public.v_opportunity_amounts_v2
WITH (security_invoker = true) AS
SELECT
  o.id AS opportunity_id,
  o.organization_id,
  o.pipeline_id,
  o.stage_id,
  o.owner_user_id,
  opp.qualified_by_user_id,
  o.status,
  COALESCE(o.valor_previsto, 0)::numeric AS opportunity_estimated_amount,

  ap.proposal_id     AS accepted_proposal_id,
  ap.status          AS accepted_proposal_status,
  ap.net_amount      AS accepted_proposal_net_amount,
  ap.gross_amount    AS accepted_proposal_gross_amount,
  ap.discount_amount AS accepted_proposal_discount_amount,
  ap.accepted_at     AS accepted_proposal_accepted_at,

  lp.proposal_id     AS latest_proposal_id,
  lp.status          AS latest_proposal_status,
  lp.net_amount      AS latest_proposal_net_amount,
  lp.gross_amount    AS latest_proposal_gross_amount,
  lp.discount_amount AS latest_proposal_discount_amount,
  lp.updated_at      AS latest_proposal_updated_at,

  CASE o.status
    WHEN 'won'  THEN COALESCE(ap.net_amount, o.valor_previsto, 0)
    WHEN 'lost' THEN COALESCE(lp.net_amount, o.valor_previsto, 0)
    ELSE             COALESCE(lp.net_amount, o.valor_previsto, 0)
  END::numeric AS commercial_amount_current,

  CASE
    WHEN o.status = 'won' THEN COALESCE(ap.net_amount, 0)
    ELSE 0
  END::numeric AS net_revenue_final,

  CASE
    WHEN o.status = 'won' AND ap.net_amount IS NOT NULL THEN 'accepted_proposal_net'
    WHEN lp.net_amount IS NOT NULL                      THEN 'latest_commercial_proposal_net'
    WHEN o.valor_previsto IS NOT NULL AND o.valor_previsto > 0 THEN 'opportunity_estimated_fallback'
    ELSE 'zero_fallback'
  END AS amount_source,

  CASE
    WHEN o.status = 'won' AND ap.net_amount IS NOT NULL THEN ap.proposal_id
    WHEN lp.net_amount IS NOT NULL                      THEN lp.proposal_id
    ELSE NULL
  END AS reference_proposal_id,

  CASE
    WHEN o.status = 'won' AND ap.net_amount IS NOT NULL THEN ap.status
    WHEN lp.net_amount IS NOT NULL                      THEN lp.status
    ELSE NULL
  END AS reference_proposal_status,

  COALESCE(ap.accepted_at, lp.updated_at, o.updated_at) AS commercial_amount_updated_at,

  (ap.proposal_id IS NOT NULL) AS has_accepted_proposal,
  (lp.proposal_id IS NOT NULL) AS has_any_commercial_proposal,

  o.created_at,
  o.updated_at,
  o.closed_at,
  o.won_at,
  o.lost_at,
  o.close_date_prevista
FROM public.v_opportunities_hygiene_base o
JOIN public.opportunities opp ON opp.id = o.id
LEFT JOIN public.v_opportunity_accepted_proposal_v2 ap
  ON ap.opportunity_id = o.id
LEFT JOIN public.v_opportunity_latest_commercial_proposal_v2 lp
  ON lp.opportunity_id = o.id;

COMMENT ON VIEW public.v_opportunity_amounts_v2 IS
  'Sprint 2.2: Canonical monetary view for opportunities. Single source of truth for commercial values across V2 reports.';

CREATE OR REPLACE VIEW public.v_opportunity_amount_coverage_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  COUNT(*)::bigint AS total_opportunities,
  COUNT(*) FILTER (WHERE amount_source = 'accepted_proposal_net')::bigint           AS using_accepted_proposal_net,
  COUNT(*) FILTER (WHERE amount_source = 'latest_commercial_proposal_net')::bigint  AS using_latest_proposal_net,
  COUNT(*) FILTER (WHERE amount_source = 'opportunity_estimated_fallback')::bigint  AS using_opportunity_fallback,
  COUNT(*) FILTER (WHERE amount_source = 'zero_fallback')::bigint                   AS using_zero_fallback,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE amount_source IN ('accepted_proposal_net','latest_commercial_proposal_net'))::numeric
       / COUNT(*)::numeric) * 100,
      2
    )
  END AS proposal_based_coverage_pct
FROM public.v_opportunity_amounts_v2
GROUP BY organization_id;

COMMENT ON VIEW public.v_opportunity_amount_coverage_v2 IS
  'Sprint 2.2: Per-organization coverage of canonical monetary sources.';

CREATE INDEX IF NOT EXISTS idx_proposals_org_opportunity_status
  ON public.proposals (organization_id, opportunity_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_opportunity_updated_at
  ON public.proposals (opportunity_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_opportunity_accepted_at
  ON public.proposals (opportunity_id, accepted_at DESC)
  WHERE status = 'accepted' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_org_status_pipeline
  ON public.opportunities (organization_id, status, pipeline_id)
  WHERE deleted_at IS NULL;
