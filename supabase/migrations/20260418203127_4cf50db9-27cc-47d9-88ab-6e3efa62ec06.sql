
-- Sprint 2.11 — Função RPC para receita ganha unificada por período.
-- Permite que CEO Dashboard e Reports V2 consumam a MESMA fonte com filtro de período.

CREATE OR REPLACE FUNCTION public.get_unified_won_revenue_v2(
  p_organization_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS TABLE (
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
SECURITY INVOKER
SET search_path = public
AS $$
  WITH won AS (
    SELECT v.*, o.mrr_value AS opp_mrr_value, o.valor_previsto AS opp_valor_previsto
    FROM v_reporting_opportunities_v2 v
    JOIN opportunities o ON o.id = v.opportunity_id
    WHERE v.organization_id = p_organization_id
      AND v.pipeline_type = 'sales'
      AND v.status = 'won'
      AND (p_start IS NULL OR v.closed_at >= p_start)
      AND (p_end   IS NULL OR v.closed_at <= p_end)
  )
  SELECT
    p_organization_id,
    COUNT(*)::bigint,
    COALESCE(SUM(net_revenue_final), 0)::numeric,
    COALESCE(SUM(net_revenue_final) FILTER (WHERE amount_source = 'accepted_proposal_net'), 0)::numeric,
    COALESCE(SUM(net_revenue_final) FILTER (WHERE amount_source = 'latest_commercial_proposal_net'), 0)::numeric,
    COALESCE(SUM(net_revenue_final) FILTER (WHERE amount_source = 'opportunity_valor_previsto'), 0)::numeric,
    COUNT(*) FILTER (WHERE amount_source = 'accepted_proposal_net')::bigint,
    COUNT(*) FILTER (WHERE amount_source = 'latest_commercial_proposal_net')::bigint,
    COUNT(*) FILTER (WHERE amount_source = 'opportunity_valor_previsto')::bigint,
    COUNT(*) FILTER (WHERE amount_source = 'zero_fallback')::bigint,
    COALESCE(SUM(opp_mrr_value), 0)::numeric,
    COALESCE(SUM(net_revenue_final - COALESCE(opp_mrr_value, 0) * 12), 0)::numeric
  FROM won;
$$;

COMMENT ON FUNCTION public.get_unified_won_revenue_v2 IS
'Sprint 2.11 — Fonte única de receita ganha por período. Consumida pelo CEO Dashboard (mês atual) e Reports V2 (qualquer período). Garante reconciliação total entre módulos.';
