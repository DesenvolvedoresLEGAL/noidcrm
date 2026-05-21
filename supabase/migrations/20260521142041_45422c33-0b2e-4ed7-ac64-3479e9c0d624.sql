
-- =====================================================================
-- P0 — Revenue Single Source of Truth
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) v_opportunity_accepted_proposal_v2: herdar proposta do clone operacional
--    quando a opp comercial (sales-won) não tem accepted_proposal_id.
--    Mantém a mesma assinatura de colunas (CREATE OR REPLACE seguro).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_opportunity_accepted_proposal_v2 AS
WITH direct_accepted AS (
  SELECT DISTINCT ON (p.opportunity_id)
    p.opportunity_id,
    p.id            AS proposal_id,
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
  ORDER BY p.opportunity_id, p.accepted_at DESC NULLS LAST, p.updated_at DESC, p.created_at DESC
),
-- Para opps comerciais (sales) ganhas que NÃO têm proposta própria aceita,
-- herda a proposta aceita do clone operacional (onboarding/renewal) cujo
-- source_opportunity_id aponta para elas.
inherited_accepted AS (
  SELECT DISTINCT ON (commercial_opp_id)
    commercial_opp_id AS opportunity_id,
    proposal_id,
    organization_id,
    status,
    gross_amount,
    discount_amount,
    net_amount,
    accepted_at,
    updated_at,
    created_at
  FROM (
    SELECT
      op.source_opportunity_id AS commercial_opp_id,
      da.*
    FROM public.opportunities op
    JOIN direct_accepted da ON da.opportunity_id = op.id
    JOIN public.pipelines pl_op ON pl_op.id = op.pipeline_id
    WHERE op.deleted_at IS NULL
      AND op.source_opportunity_id IS NOT NULL
      AND pl_op.pipeline_type IN ('onboarding','renewal')
  ) s
  ORDER BY commercial_opp_id,
           CASE WHEN status = 'accepted' THEN 0 ELSE 1 END,
           accepted_at DESC NULLS LAST,
           updated_at DESC
),
union_all AS (
  SELECT * FROM direct_accepted
  UNION ALL
  SELECT ia.*
  FROM inherited_accepted ia
  WHERE NOT EXISTS (SELECT 1 FROM direct_accepted d WHERE d.opportunity_id = ia.opportunity_id)
)
SELECT DISTINCT ON (opportunity_id)
  opportunity_id,
  proposal_id,
  organization_id,
  status,
  gross_amount,
  discount_amount,
  net_amount,
  accepted_at,
  updated_at,
  created_at
FROM union_all
ORDER BY opportunity_id, accepted_at DESC NULLS LAST, updated_at DESC, created_at DESC;

-- ---------------------------------------------------------------------
-- 2) commercial_won_revenue_view — Fonte única de vendas realizadas
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.commercial_won_revenue_view;

CREATE VIEW public.commercial_won_revenue_view AS
WITH base_opps AS (
  SELECT
    o.id,
    o.organization_id,
    o.title,
    o.status,
    o.pipeline_id,
    o.account_id,
    o.owner_user_id,
    o.valor_previsto,
    o.accepted_proposal_id,
    o.source_opportunity_id,
    o.closed_at,
    o.created_at,
    pl.name AS pipeline_name,
    pl.pipeline_type
  FROM public.opportunities o
  JOIN public.pipelines pl ON pl.id = o.pipeline_id
  WHERE o.deleted_at IS NULL
),
-- Para cada opp comercial sales-won, escolher 1 clone operacional canônico
-- (prioridade onboarding > renewal > created_at desc).
op_clone AS (
  SELECT DISTINCT ON (o.source_opportunity_id)
    o.source_opportunity_id AS commercial_opp_id,
    o.id                    AS operational_opp_id,
    o.accepted_proposal_id  AS operational_accepted_proposal_id
  FROM base_opps o
  WHERE o.source_opportunity_id IS NOT NULL
    AND o.pipeline_type IN ('onboarding','renewal')
    AND o.accepted_proposal_id IS NOT NULL
  ORDER BY o.source_opportunity_id,
           CASE o.pipeline_type WHEN 'onboarding' THEN 1 WHEN 'renewal' THEN 2 ELSE 3 END,
           o.created_at DESC
),
-- Linha canônica por venda real
canonical AS (
  -- A) Vendas comerciais ganhas (pipeline sales / status=won) — verdade comercial
  SELECT
    o.id                                                              AS opportunity_id,
    o.id                                                              AS commercial_opportunity_id,
    oc.operational_opp_id                                             AS operational_opportunity_id,
    COALESCE(o.accepted_proposal_id, oc.operational_accepted_proposal_id) AS accepted_proposal_id,
    o.closed_at                                                       AS won_at,
    o.organization_id,
    o.title,
    o.owner_user_id,
    o.account_id,
    o.pipeline_id,
    o.pipeline_name,
    o.pipeline_type,
    o.valor_previsto,
    o.created_at,
    'sales_won'::text                                                 AS canonical_kind
  FROM base_opps o
  LEFT JOIN op_clone oc ON oc.commercial_opp_id = o.id
  WHERE o.pipeline_type = 'sales' AND o.status = 'won'

  UNION ALL

  -- B) Operacional standalone (onboarding/renewal com proposta aceita
  --    e SEM pai sales-won) — venda real que nunca passou por sales
  SELECT
    o.id, o.id, NULL,
    o.accepted_proposal_id,
    COALESCE(o.closed_at, o.created_at),
    o.organization_id,
    o.title, o.owner_user_id, o.account_id, o.pipeline_id,
    o.pipeline_name, o.pipeline_type,
    o.valor_previsto, o.created_at,
    'operational_standalone'
  FROM base_opps o
  WHERE o.pipeline_type IN ('onboarding','renewal')
    AND o.accepted_proposal_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM base_opps s
      WHERE s.id = o.source_opportunity_id
        AND s.pipeline_type = 'sales'
        AND s.status = 'won'
    )
    -- Dentre múltiplos operacionais com a mesma proposta, manter só um
    AND o.id = (
      SELECT o2.id FROM base_opps o2
      WHERE o2.accepted_proposal_id = o.accepted_proposal_id
        AND o2.pipeline_type IN ('onboarding','renewal')
        AND NOT EXISTS (
          SELECT 1 FROM base_opps s2
          WHERE s2.id = o2.source_opportunity_id
            AND s2.pipeline_type='sales' AND s2.status='won'
        )
      ORDER BY CASE o2.pipeline_type WHEN 'onboarding' THEN 1 WHEN 'renewal' THEN 2 ELSE 3 END,
               o2.created_at DESC
      LIMIT 1
    )
),
-- Agregação por proposta: MRR vs avulso a partir de proposal_items.billing_type
item_split AS (
  SELECT
    pi.proposal_id,
    COALESCE(SUM(CASE WHEN pi.billing_type = 'recurring' THEN pi.total ELSE 0 END), 0) AS mrr_raw,
    COALESCE(SUM(CASE WHEN pi.billing_type IN ('one_time','point_day') THEN pi.total ELSE 0 END), 0) AS one_shot_raw,
    BOOL_OR(pi.billing_type = 'recurring') AS has_recurring,
    BOOL_OR(pi.billing_type IN ('one_time','point_day')) AS has_one_shot,
    BOOL_OR(pi.billing_type IS NULL) AS has_unknown_billing
  FROM public.proposal_items pi
  GROUP BY pi.proposal_id
)
SELECT
  c.organization_id,
  c.opportunity_id,
  c.commercial_opportunity_id,
  c.operational_opportunity_id,
  c.accepted_proposal_id,
  p.proposal_number,
  c.account_id,
  acc.razao_social   AS account_name,
  acc.nome_fantasia,
  c.owner_user_id    AS seller_id,
  prof.full_name     AS seller_name,
  c.won_at,
  p.accepted_at,
  p.accepted_at      AS approved_at,
  COALESCE(r.amount, c.valor_previsto, 0)::numeric                  AS commercial_amount,
  COALESCE(r.source, CASE WHEN c.accepted_proposal_id IS NULL THEN 'opportunity_value_legacy' ELSE 'zero' END) AS commercial_amount_source,
  COALESCE(r.is_final, false) AS is_final_approved_value,
  -- MRR / one-shot com regras de confiança
  CASE
    WHEN i.has_unknown_billing THEN 0::numeric           -- sem metadado confiável
    WHEN i.has_recurring THEN COALESCE(i.mrr_raw, 0)
    ELSE 0::numeric
  END AS mrr_amount,
  CASE
    WHEN i.has_unknown_billing THEN COALESCE(r.amount, c.valor_previsto, 0)::numeric
    WHEN i.has_recurring AND i.has_one_shot THEN
      GREATEST(COALESCE(r.amount, c.valor_previsto, 0) - COALESCE(i.mrr_raw, 0), 0)::numeric
    WHEN i.has_recurring AND NOT i.has_one_shot THEN 0::numeric
    ELSE COALESCE(r.amount, c.valor_previsto, 0)::numeric
  END AS one_shot_amount,
  COALESCE(i.has_recurring, false) AS is_recurring,
  CASE
    WHEN i.has_recurring AND i.has_one_shot THEN 'mixed'
    WHEN i.has_recurring THEN 'mrr'
    ELSE 'one_shot'
  END AS revenue_type,
  NULL::text AS business_unit,
  c.valor_previsto AS legacy_opportunity_value,
  (COALESCE(r.amount, 0) - COALESCE(c.valor_previsto, 0))::numeric AS delta_vs_opportunity_value,
  -- Flags de governança
  (
    NOT COALESCE(r.is_final, false)
    OR (i.has_unknown_billing IS TRUE)
    OR (c.canonical_kind = 'sales_won' AND c.accepted_proposal_id IS NULL)
  ) AS review_required,
  (
    ARRAY[]::text[]
    || CASE WHEN NOT COALESCE(r.is_final, false) THEN ARRAY['amount_resolver_unconfident'] ELSE ARRAY[]::text[] END
    || CASE WHEN i.has_unknown_billing THEN ARRAY['mrr_split_unknown_billing'] ELSE ARRAY[]::text[] END
    || CASE WHEN c.canonical_kind = 'sales_won' AND c.accepted_proposal_id IS NULL THEN ARRAY['no_accepted_proposal'] ELSE ARRAY[]::text[] END
  ) AS warnings,
  CASE
    WHEN (NOT COALESCE(r.is_final, false))
      OR (c.canonical_kind = 'sales_won' AND c.accepted_proposal_id IS NULL)
    THEN 'manual_review'
    WHEN i.has_unknown_billing THEN 'warning'
    ELSE 'trusted'
  END AS revenue_confidence,
  c.created_at,
  c.pipeline_id,
  c.pipeline_name,
  c.pipeline_type,
  c.title  AS opportunity_title,
  CASE WHEN c.canonical_kind = 'sales_won' THEN 'won' ELSE 'accepted' END AS status,
  c.canonical_kind
FROM canonical c
LEFT JOIN public.proposals p ON p.id = c.accepted_proposal_id AND p.deleted_at IS NULL
LEFT JOIN LATERAL public.resolve_approved_commercial_amount_by_proposal(c.accepted_proposal_id) r(amount, source, is_final) ON c.accepted_proposal_id IS NOT NULL
LEFT JOIN public.accounts acc ON acc.id = c.account_id
LEFT JOIN public.profiles prof ON prof.user_id = c.owner_user_id
LEFT JOIN item_split i ON i.proposal_id = c.accepted_proposal_id;

COMMENT ON VIEW public.commercial_won_revenue_view IS
  'Single Source of Truth (P0) — uma linha por venda realizada. commercial_amount via resolve_approved_commercial_amount_by_proposal. Dedup comercial<->operacional via source_opportunity_id. MRR/one-shot via proposal_items.billing_type. review_required + revenue_confidence governam comissão e relatórios.';

-- ---------------------------------------------------------------------
-- 3) Reescrever v_unified_won_revenue_v2 lendo da SSoT
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_unified_won_revenue_v2 AS
SELECT
  v.organization_id,
  COUNT(*)::bigint                                                                          AS won_count,
  COALESCE(SUM(v.commercial_amount), 0)::numeric                                            AS won_revenue,
  COALESCE(SUM(v.commercial_amount) FILTER (WHERE v.accepted_proposal_id IS NOT NULL), 0)::numeric AS won_revenue_via_accepted_proposal,
  0::numeric                                                                                AS won_revenue_via_latest_proposal,
  COALESCE(SUM(v.commercial_amount) FILTER (WHERE v.accepted_proposal_id IS NULL AND v.commercial_amount > 0), 0)::numeric AS won_revenue_via_opportunity_fallback,
  COUNT(*) FILTER (WHERE v.accepted_proposal_id IS NOT NULL)::bigint                        AS won_count_via_accepted_proposal,
  0::bigint                                                                                 AS won_count_via_latest_proposal,
  COUNT(*) FILTER (WHERE v.accepted_proposal_id IS NULL AND v.commercial_amount > 0)::bigint AS won_count_via_opportunity_fallback,
  COUNT(*) FILTER (WHERE v.commercial_amount = 0)::bigint                                   AS won_count_via_zero_fallback,
  MAX(v.won_at)                                                                             AS last_won_at
FROM public.commercial_won_revenue_view v
GROUP BY v.organization_id;

-- ---------------------------------------------------------------------
-- 4) Reescrever get_unified_won_revenue_v2(org, start, end) lendo da SSoT
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unified_won_revenue_v2(
  p_organization_id uuid,
  p_start timestamp with time zone DEFAULT NULL,
  p_end   timestamp with time zone DEFAULT NULL
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
    SELECT *
    FROM public.commercial_won_revenue_view v
    WHERE v.organization_id = p_organization_id
      AND (p_start IS NULL OR v.won_at >= p_start)
      AND (p_end   IS NULL OR v.won_at <= p_end)
  )
  SELECT
    p_organization_id,
    COUNT(*)::bigint,
    COALESCE(SUM(commercial_amount), 0)::numeric,
    COALESCE(SUM(commercial_amount) FILTER (WHERE accepted_proposal_id IS NOT NULL), 0)::numeric,
    0::numeric,
    COALESCE(SUM(commercial_amount) FILTER (WHERE accepted_proposal_id IS NULL AND commercial_amount > 0), 0)::numeric,
    COUNT(*) FILTER (WHERE accepted_proposal_id IS NOT NULL)::bigint,
    0::bigint,
    COUNT(*) FILTER (WHERE accepted_proposal_id IS NULL AND commercial_amount > 0)::bigint,
    COUNT(*) FILTER (WHERE commercial_amount = 0)::bigint,
    COALESCE(SUM(mrr_amount), 0)::numeric,
    COALESCE(SUM(one_shot_amount), 0)::numeric
  FROM won;
$function$;
