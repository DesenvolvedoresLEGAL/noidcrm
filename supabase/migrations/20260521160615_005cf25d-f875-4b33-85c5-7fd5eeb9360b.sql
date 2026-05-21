
CREATE OR REPLACE VIEW public.commercial_won_revenue_view AS
WITH base_opps AS (
  SELECT
    o.id, o.organization_id, o.title, o.status, o.pipeline_id, o.account_id,
    o.owner_user_id, o.valor_previsto, o.accepted_proposal_id,
    o.source_opportunity_id, o.closed_at, o.created_at,
    pl.name AS pipeline_name, pl.pipeline_type
  FROM public.opportunities o
  JOIN public.pipelines pl ON pl.id = o.pipeline_id
  WHERE o.deleted_at IS NULL
),
op_all AS (
  SELECT
    o.id, o.status, o.accepted_proposal_id, o.source_opportunity_id,
    o.deleted_at, o.created_at, pl.pipeline_type
  FROM public.opportunities o
  JOIN public.pipelines pl ON pl.id = o.pipeline_id
  WHERE pl.pipeline_type IN ('onboarding','renewal')
    AND o.source_opportunity_id IS NOT NULL
),
op_clone AS (
  SELECT DISTINCT ON (source_opportunity_id)
    source_opportunity_id AS commercial_opp_id,
    id                    AS op_id,
    accepted_proposal_id  AS op_accepted_proposal_id,
    status                AS op_status,
    deleted_at            AS op_deleted_at
  FROM op_all
  ORDER BY source_opportunity_id,
           CASE
             WHEN deleted_at IS NULL AND accepted_proposal_id IS NOT NULL THEN 0
             WHEN deleted_at IS NULL THEN 1
             ELSE 2
           END,
           CASE pipeline_type WHEN 'onboarding' THEN 1 WHEN 'renewal' THEN 2 ELSE 3 END,
           created_at DESC
),
canonical AS (
  SELECT
    o.id                                                              AS opportunity_id,
    o.id                                                              AS commercial_opportunity_id,
    oc.op_id                                                          AS operational_opportunity_id,
    oc.op_status                                                      AS op_status,
    oc.op_deleted_at                                                  AS op_deleted_at,
    COALESCE(o.accepted_proposal_id, oc.op_accepted_proposal_id)      AS accepted_proposal_id,
    o.closed_at                                                       AS won_at,
    o.organization_id, o.title, o.owner_user_id, o.account_id,
    o.pipeline_id, o.pipeline_name, o.pipeline_type,
    o.valor_previsto, o.created_at,
    'sales_won'::text                                                 AS canonical_kind
  FROM base_opps o
  LEFT JOIN op_clone oc ON oc.commercial_opp_id = o.id
  WHERE o.pipeline_type = 'sales' AND o.status = 'won'

  UNION ALL

  SELECT
    o.id, o.id, NULL::uuid, NULL::text, NULL::timestamptz,
    o.accepted_proposal_id,
    COALESCE(o.closed_at, o.created_at),
    o.organization_id, o.title, o.owner_user_id, o.account_id,
    o.pipeline_id, o.pipeline_name, o.pipeline_type,
    o.valor_previsto, o.created_at,
    'operational_standalone'
  FROM base_opps o
  WHERE o.pipeline_type IN ('onboarding','renewal')
    AND o.accepted_proposal_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM base_opps s
      WHERE s.id = o.source_opportunity_id
        AND s.pipeline_type = 'sales' AND s.status = 'won'
    )
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
  CASE
    WHEN i.has_unknown_billing THEN 0::numeric
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
  (
    NOT COALESCE(r.is_final, false)
    OR (i.has_unknown_billing IS TRUE)
    OR (c.canonical_kind = 'sales_won' AND c.accepted_proposal_id IS NULL)
  ) AS review_required,
  (
    ARRAY[]::text[]
    || CASE WHEN NOT COALESCE(r.is_final, false) THEN ARRAY['amount_resolver_unconfident'] ELSE ARRAY[]::text[] END
    || CASE WHEN i.has_unknown_billing THEN ARRAY['mrr_split_unknown_billing'] ELSE ARRAY[]::text[] END
    || CASE WHEN c.canonical_kind = 'sales_won' AND c.accepted_proposal_id IS NULL THEN ARRAY['missing_accepted_proposal'] ELSE ARRAY[]::text[] END
    || CASE WHEN c.canonical_kind = 'sales_won' AND c.op_deleted_at IS NOT NULL THEN ARRAY['operational_removed'] ELSE ARRAY[]::text[] END
    || CASE WHEN c.canonical_kind = 'sales_won' AND c.op_status = 'lost' THEN ARRAY['operational_cancelled'] ELSE ARRAY[]::text[] END
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
  c.canonical_kind,
  -- ===== NOVAS COLUNAS (apenas appended) =====
  CASE WHEN c.canonical_kind = 'sales_won' THEN 'won' ELSE 'accepted' END::text AS commercial_status,
  CASE
    WHEN c.canonical_kind = 'operational_standalone' THEN 'not_applicable'
    WHEN c.operational_opportunity_id IS NULL THEN 'not_started'
    WHEN c.op_deleted_at IS NOT NULL THEN 'removed'
    WHEN c.op_status = 'lost' THEN 'cancelled'
    WHEN c.op_status = 'won' THEN 'completed'
    WHEN c.op_status = 'open' THEN 'active'
    ELSE 'active'
  END::text AS fulfillment_status,
  CASE
    WHEN c.canonical_kind = 'sales_won'
         AND c.operational_opportunity_id IS NOT NULL
         AND (c.op_deleted_at IS NOT NULL OR c.op_status = 'lost')
      THEN 'pending_settlement_decision'
    WHEN c.canonical_kind = 'sales_won' AND c.accepted_proposal_id IS NULL
      THEN 'pending_settlement_decision'
    WHEN c.accepted_proposal_id IS NOT NULL THEN 'settled'
    ELSE 'manual_review'
  END::text AS financial_settlement_status
FROM canonical c
LEFT JOIN public.proposals p ON p.id = c.accepted_proposal_id AND p.deleted_at IS NULL
LEFT JOIN LATERAL public.resolve_approved_commercial_amount_by_proposal(c.accepted_proposal_id) r(amount, source, is_final) ON c.accepted_proposal_id IS NOT NULL
LEFT JOIN public.accounts acc ON acc.id = c.account_id
LEFT JOIN public.profiles prof ON prof.user_id = c.owner_user_id
LEFT JOIN item_split i ON i.proposal_id = c.accepted_proposal_id;

COMMENT ON VIEW public.commercial_won_revenue_view IS
  'SSoT P0 — venda comercial (sales-won) persiste mesmo com operacional removido/cancelado. Inclui commercial_status, fulfillment_status, financial_settlement_status.';

-- =====================================================================
CREATE OR REPLACE VIEW public.commission_eligibility_view AS
SELECT
  v.organization_id, v.opportunity_id, v.commercial_opportunity_id,
  v.operational_opportunity_id, v.accepted_proposal_id, v.proposal_number,
  v.account_id, v.account_name, v.nome_fantasia, v.seller_id, v.seller_name,
  v.won_at, v.approved_at, v.commercial_amount, v.mrr_amount, v.one_shot_amount,
  v.commercial_amount AS commission_amount,
  v.review_required, v.revenue_confidence, v.warnings,
  CASE
    WHEN v.financial_settlement_status IN ('pending_settlement_decision','pending_cancellation_fee','pending_credit_decision','pending_payment')
      THEN 'blocked_settlement_pending'
    WHEN v.review_required THEN 'blocked_review_required'
    ELSE 'eligible'
  END AS commission_status,
  v.pipeline_id, v.pipeline_name, v.pipeline_type, v.opportunity_title,
  v.status, v.canonical_kind, v.created_at,
  -- ===== NOVAS COLUNAS (appended) =====
  v.commercial_status,
  v.fulfillment_status,
  v.financial_settlement_status
FROM public.commercial_won_revenue_view v;

COMMENT ON VIEW public.commission_eligibility_view IS
  'commission_status estendido: blocked_settlement_pending (multa/crédito/cancel pendente), blocked_review_required, eligible. Nenhum bloqueado paga automaticamente.';

GRANT SELECT ON public.commercial_won_revenue_view TO authenticated;
GRANT SELECT ON public.commission_eligibility_view TO authenticated;
