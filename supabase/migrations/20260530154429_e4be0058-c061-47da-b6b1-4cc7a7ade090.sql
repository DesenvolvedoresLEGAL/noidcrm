
-- ============================================================================
-- Sprint OTE: Atribuição Histórica Imutável (v2 — sem stage_id/stage_name)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_historical_seller_at(
  p_opportunity_id uuid,
  p_at timestamptz
) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH hist AS (
    SELECT to_owner_user_id, from_owner_user_id, changed_at
    FROM public.opportunity_owner_history
    WHERE opportunity_id = p_opportunity_id
  ),
  last_before AS (
    SELECT to_owner_user_id
    FROM hist
    WHERE changed_at <= COALESCE(p_at, now())
    ORDER BY changed_at DESC
    LIMIT 1
  ),
  earliest AS (
    SELECT from_owner_user_id
    FROM hist
    ORDER BY changed_at ASC
    LIMIT 1
  )
  SELECT COALESCE(
    (SELECT to_owner_user_id FROM last_before),
    (SELECT from_owner_user_id FROM earliest),
    (SELECT owner_user_id FROM public.opportunities WHERE id = p_opportunity_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_historical_seller_at(uuid, timestamptz)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_historical_qualifier(
  p_opportunity_id uuid
) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT qualified_by_user_id
      FROM public.opportunity_qualification_history
      WHERE opportunity_id = p_opportunity_id
        AND qualified_by_user_id IS NOT NULL
      ORDER BY qualification_at ASC
      LIMIT 1
    ),
    (SELECT owner_user_id FROM public.opportunities WHERE id = p_opportunity_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_historical_qualifier(uuid)
  TO authenticated, service_role;

-- View histórica (sem stage_id/stage_name pois não existem na view base)
DROP VIEW IF EXISTS public.commercial_won_revenue_historical_view;

CREATE VIEW public.commercial_won_revenue_historical_view AS
SELECT
  v.organization_id,
  v.opportunity_id,
  v.accepted_proposal_id,
  v.proposal_number,
  v.account_id,
  v.account_name,
  v.nome_fantasia,
  public.resolve_historical_seller_at(v.opportunity_id, v.won_at) AS seller_id,
  COALESCE(hp.full_name, v.seller_name) AS seller_name,
  v.seller_id   AS current_seller_id,
  v.seller_name AS current_seller_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.opportunity_owner_history h
      WHERE h.opportunity_id = v.opportunity_id
        AND h.changed_at <= v.won_at
    ) THEN 'owner_history'
    ELSE 'fallback_current_owner'
  END AS attribution_source,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.opportunity_owner_history h
      WHERE h.opportunity_id = v.opportunity_id
        AND h.changed_at <= v.won_at
    ) THEN 'high'
    ELSE 'low'
  END AS attribution_confidence,
  v.pipeline_id,
  v.pipeline_name,
  v.pipeline_type,
  v.won_at,
  v.commercial_amount,
  v.one_shot_amount,
  v.mrr_amount,
  v.commercial_amount_source,
  v.revenue_confidence,
  v.review_required,
  v.warnings,
  v.commercial_status,
  v.fulfillment_status,
  v.financial_settlement_status,
  v.is_cancelled_sale,
  v.approved_amount,
  v.cancelled_amount,
  v.valid_revenue_amount,
  v.commission_eligible_amount
FROM public.commercial_won_revenue_view v
LEFT JOIN LATERAL (
  SELECT prof.full_name
  FROM public.profiles prof
  WHERE prof.user_id = public.resolve_historical_seller_at(v.opportunity_id, v.won_at)
  LIMIT 1
) hp ON true;

GRANT SELECT ON public.commercial_won_revenue_historical_view TO authenticated, service_role;

COMMENT ON VIEW public.commercial_won_revenue_historical_view IS
  'Atribuição histórica imutável: seller_id resolvido no momento do ganho via opportunity_owner_history. Wrapper sobre commercial_won_revenue_view (não altera a view base). Use para Resultados/OTE/Comissão; transferência de propriedade NÃO reatribui resultado histórico.';
