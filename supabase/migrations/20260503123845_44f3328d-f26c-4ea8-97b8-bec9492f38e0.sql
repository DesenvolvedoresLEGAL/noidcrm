-- Fix get_unified_won_revenue_v2: derive MRR from proposal_payment_terms (source of truth)
-- instead of opportunities.mrr_value, which is often 0 even when the deal has recurring terms.
-- This corrects the "Receita Avulsa" KPI on CEO dashboard and any other consumer.

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
    FROM v_reporting_opportunities_v2 v
    JOIN opportunities o ON o.id = v.opportunity_id
    WHERE v.organization_id = p_organization_id
      AND v.pipeline_type = 'sales'
      AND v.status = 'won'
      AND (p_start IS NULL OR v.closed_at >= p_start)
      AND (p_end   IS NULL OR v.closed_at <= p_end)
  ),
  -- Recurring MRR per opportunity, derived from accepted proposals' payment terms (source of truth).
  -- Falls back to opportunities.mrr_value if no accepted proposal terms exist.
  opp_mrr AS (
    SELECT
      w.opportunity_id,
      COALESCE(
        (
          SELECT SUM(COALESCE(ppt.monthly_value, 0))
          FROM proposals p
          JOIN proposal_payment_terms ppt ON ppt.proposal_id = p.id
          WHERE p.opportunity_id = w.opportunity_id
            AND p.status = 'accepted'
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