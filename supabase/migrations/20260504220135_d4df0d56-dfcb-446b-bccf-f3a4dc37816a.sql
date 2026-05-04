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
  COALESCE(NULLIF(p.subtotal, 0), COALESCE(p.total_amount, 0) + COALESCE(p.discount_amount, 0), COALESCE(p.value, 0), 0)::numeric AS gross_amount,
  COALESCE(p.discount_amount, 0)::numeric AS discount_amount,
  COALESCE(p.total_amount, p.value, 0)::numeric AS net_amount
FROM public.proposals p
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW public.v_proposals_normalized_v2 IS
  'Sprint 2.12: Normalized monetary base per proposal. total_amount/value are already net after discounts; subtotal is gross. Excludes soft-deleted.';

CREATE OR REPLACE FUNCTION public.get_unified_won_revenue_v2(
  p_organization_id uuid,
  p_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end   timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  organization_id uuid,
  won_count bigint,
  won_revenue numeric,
  won_revenue_via_accepted_proposal numeric,
  won_revenue_via_latest_proposal numeric,
  won_revenue_via_opportunity_fallback numeric,
  won_count_via_accepted_proposal bigint,
  won_count_via_latest_proposal bigint,
  won_count_via_opportunity_fallback bigint,
  won_count_via_zero_fallback bigint,
  mrr_value numeric,
  one_time_value numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH won AS (
    SELECT v.*, o.mrr_value AS opp_mrr_value, o.valor_previsto AS opp_valor_previsto
    FROM public.v_reporting_opportunities_v2 v
    JOIN public.opportunities o ON o.id = v.opportunity_id
    WHERE v.organization_id = p_organization_id
      AND v.pipeline_type = 'sales'
      AND v.status = 'won'
      AND (p_start IS NULL OR v.closed_at >= p_start)
      AND (p_end   IS NULL OR v.closed_at <= p_end)
  ),
  opp_mrr AS (
    SELECT
      w.opportunity_id,
      COALESCE(
        (
          SELECT SUM(COALESCE(ppt.monthly_value, 0))
          FROM public.proposals p
          JOIN public.proposal_payment_terms ppt ON ppt.proposal_id = p.id
          WHERE p.opportunity_id = w.opportunity_id
            AND p.status = 'accepted'
            AND p.deleted_at IS NULL
            AND ppt.payment_type IN ('recurring','monthly')
        ),
        w.opp_mrr_value,
        0
      )::numeric AS mrr_monthly
    FROM won w
  )
  SELECT
    p_organization_id,
    COUNT(*)::bigint,
    COALESCE(SUM(w.net_revenue_final), 0)::numeric,
    COALESCE(SUM(w.net_revenue_final) FILTER (WHERE w.amount_source = 'accepted_proposal_net'), 0)::numeric,
    COALESCE(SUM(w.net_revenue_final) FILTER (WHERE w.amount_source = 'latest_commercial_proposal_net'), 0)::numeric,
    COALESCE(SUM(w.net_revenue_final) FILTER (WHERE w.amount_source = 'opportunity_valor_previsto'), 0)::numeric,
    COUNT(*) FILTER (WHERE w.amount_source = 'accepted_proposal_net')::bigint,
    COUNT(*) FILTER (WHERE w.amount_source = 'latest_commercial_proposal_net')::bigint,
    COUNT(*) FILTER (WHERE w.amount_source = 'opportunity_valor_previsto')::bigint,
    COUNT(*) FILTER (WHERE w.amount_source = 'zero_fallback')::bigint,
    COALESCE(SUM(om.mrr_monthly), 0)::numeric,
    COALESCE(SUM(GREATEST(w.net_revenue_final - COALESCE(om.mrr_monthly, 0), 0)), 0)::numeric
  FROM won w
  LEFT JOIN opp_mrr om ON om.opportunity_id = w.opportunity_id;
$function$;