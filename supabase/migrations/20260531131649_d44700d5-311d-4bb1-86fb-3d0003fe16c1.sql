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
      AND to_owner_user_id IS NOT NULL
    ORDER BY changed_at DESC
    LIMIT 1
  ),
  earliest AS (
    SELECT COALESCE(from_owner_user_id, to_owner_user_id) AS owner_user_id
    FROM hist
    WHERE COALESCE(from_owner_user_id, to_owner_user_id) IS NOT NULL
    ORDER BY changed_at ASC
    LIMIT 1
  )
  SELECT COALESCE(
    (SELECT to_owner_user_id FROM last_before),
    (SELECT owner_user_id FROM earliest)
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
  SELECT (
    SELECT qualified_by_user_id
    FROM public.opportunity_qualification_history
    WHERE opportunity_id = p_opportunity_id
      AND qualified_by_user_id IS NOT NULL
    ORDER BY qualification_at ASC
    LIMIT 1
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_historical_qualifier(uuid)
  TO authenticated, service_role;

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
  hs.seller_id,
  hp.full_name AS seller_name,
  v.seller_id   AS current_seller_id,
  v.seller_name AS current_seller_name,
  CASE
    WHEN hs.seller_id IS NOT NULL THEN 'owner_history'
    ELSE 'attribution_pending'
  END AS attribution_source,
  CASE
    WHEN hs.seller_id IS NOT NULL THEN 'high'
    ELSE 'pending'
  END AS attribution_confidence,
  v.pipeline_id,
  v.pipeline_name,
  v.pipeline_type,
  v.won_at,
  v.accepted_at,
  v.approved_at,
  v.cancelled_at,
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
CROSS JOIN LATERAL (
  SELECT public.resolve_historical_seller_at(v.opportunity_id, v.won_at) AS seller_id
) hs
LEFT JOIN LATERAL (
  SELECT prof.full_name
  FROM public.profiles prof
  WHERE prof.user_id = hs.seller_id
  LIMIT 1
) hp ON true;

GRANT SELECT ON public.commercial_won_revenue_historical_view TO authenticated, service_role;

COMMENT ON VIEW public.commercial_won_revenue_historical_view IS
  'Atribuição histórica imutável: seller_id resolvido por opportunity_owner_history no momento do ganho. Sem fallback para owner atual; ausência vira attribution_pending.';