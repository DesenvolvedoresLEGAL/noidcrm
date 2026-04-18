
-- Sprint 2.10 — mantém ordem original dos campos para evitar erro 42P16

-- ==========================================
-- 1) CASCATA MONETÁRIA (mesma ordem original + novos campos no final)
-- ==========================================
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
  COALESCE(opp.valor_previsto, 0)::numeric AS opportunity_estimated_amount,

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

  -- commercial_amount_current: cascata Sprint 2.10
  CASE o.status
    WHEN 'won'  THEN COALESCE(ap.net_amount, lp.net_amount,
                              NULLIF((COALESCE(opp.valor_previsto,0) + COALESCE(opp.mrr_value,0)*12), 0),
                              0)
    WHEN 'lost' THEN COALESCE(lp.net_amount,
                              NULLIF((COALESCE(opp.valor_previsto,0) + COALESCE(opp.mrr_value,0)*12), 0),
                              0)
    ELSE             COALESCE(lp.net_amount,
                              NULLIF((COALESCE(opp.valor_previsto,0) + COALESCE(opp.mrr_value,0)*12), 0),
                              0)
  END::numeric AS commercial_amount_current,

  -- net_revenue_final (won-only): CASCATA Sprint 2.10
  CASE
    WHEN o.status = 'won' THEN
      COALESCE(
        ap.net_amount,
        lp.net_amount,
        NULLIF((COALESCE(opp.valor_previsto,0) + COALESCE(opp.mrr_value,0)*12), 0),
        0
      )
    ELSE 0
  END::numeric AS net_revenue_final,

  -- amount_source: cascata clara
  CASE
    WHEN o.status = 'won' AND ap.net_amount IS NOT NULL THEN 'accepted_proposal_net'
    WHEN o.status = 'won' AND lp.net_amount IS NOT NULL THEN 'latest_commercial_proposal_net'
    WHEN o.status = 'won' AND (COALESCE(opp.valor_previsto,0) + COALESCE(opp.mrr_value,0)*12) > 0
         THEN 'opportunity_valor_previsto'
    WHEN lp.net_amount IS NOT NULL                      THEN 'latest_commercial_proposal_net'
    WHEN (COALESCE(opp.valor_previsto,0) + COALESCE(opp.mrr_value,0)*12) > 0
         THEN 'opportunity_valor_previsto'
    ELSE 'zero_fallback'
  END AS amount_source,

  CASE
    WHEN o.status = 'won' AND ap.net_amount IS NOT NULL THEN ap.proposal_id
    WHEN o.status = 'won' AND lp.net_amount IS NOT NULL THEN lp.proposal_id
    WHEN lp.net_amount IS NOT NULL                      THEN lp.proposal_id
    ELSE NULL
  END AS reference_proposal_id,

  CASE
    WHEN o.status = 'won' AND ap.net_amount IS NOT NULL THEN ap.status
    WHEN o.status = 'won' AND lp.net_amount IS NOT NULL THEN lp.status
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
  o.close_date_prevista,

  -- NOVO Sprint 2.10 (no final para preservar ordem)
  COALESCE(opp.mrr_value, 0)::numeric AS opportunity_mrr_value,
  (COALESCE(opp.valor_previsto, 0) + COALESCE(opp.mrr_value, 0) * 12)::numeric AS opportunity_total_estimated_amount
FROM public.v_opportunities_hygiene_base o
JOIN public.opportunities opp ON opp.id = o.id
LEFT JOIN public.v_opportunity_accepted_proposal_v2 ap
  ON ap.opportunity_id = o.id
LEFT JOIN public.v_opportunity_latest_commercial_proposal_v2 lp
  ON lp.opportunity_id = o.id;

COMMENT ON VIEW public.v_opportunity_amounts_v2 IS
  'Sprint 2.10: Cascata monetária canônica. net_revenue_final segue: accepted_proposal_net → latest_commercial_proposal_net → opportunity_valor_previsto (valor_previsto + mrr_value*12) → zero_fallback.';

-- ==========================================
-- 2) COBERTURA EXPANDIDA (mantém ordem original + novo campo no final)
-- ==========================================
CREATE OR REPLACE VIEW public.v_opportunity_amount_coverage_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  COUNT(*)::bigint AS total_opportunities,
  COUNT(*) FILTER (WHERE amount_source = 'accepted_proposal_net')::bigint           AS using_accepted_proposal_net,
  COUNT(*) FILTER (WHERE amount_source = 'latest_commercial_proposal_net')::bigint  AS using_latest_proposal_net,
  COUNT(*) FILTER (WHERE amount_source = 'opportunity_valor_previsto')::bigint      AS using_opportunity_fallback,
  COUNT(*) FILTER (WHERE amount_source = 'zero_fallback')::bigint                   AS using_zero_fallback,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE amount_source IN ('accepted_proposal_net','latest_commercial_proposal_net'))::numeric
       / COUNT(*)::numeric) * 100, 2)
  END AS proposal_based_coverage_pct,
  -- NOVO Sprint 2.10
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE amount_source <> 'zero_fallback')::numeric
       / COUNT(*)::numeric) * 100, 2)
  END AS opportunity_based_coverage_pct
FROM public.v_opportunity_amounts_v2
GROUP BY organization_id;

COMMENT ON VIEW public.v_opportunity_amount_coverage_v2 IS
  'Sprint 2.10: Coverage expandida. proposal_based_coverage_pct = ideal (proposta). opportunity_based_coverage_pct = aceitável (proposta OU valor_previsto).';

-- ==========================================
-- 3) CONFIANÇA RECALIBRADA (mesma ordem + novo campo no final)
-- ==========================================
CREATE OR REPLACE VIEW public.v_report_confidence_score_v2
WITH (security_invoker = true) AS
SELECT
  COALESCE(amt.organization_id, hist.organization_id, loss.organization_id) AS organization_id,
  COALESCE(amt.proposal_based_coverage_pct, 0)::numeric                AS proposal_based_coverage_pct,
  COALESCE(hist.stage_history_coverage_pct, 0)::numeric                AS stage_history_coverage_pct,
  COALESCE(hist.owner_history_coverage_pct, 0)::numeric                AS owner_history_coverage_pct,
  COALESCE(hist.qualification_history_coverage_pct, 0)::numeric        AS qualification_history_coverage_pct,
  COALESCE(loss.complete_coverage_pct, 0)::numeric                     AS loss_complete_coverage_pct,
  COALESCE(loss.any_coverage_pct, 0)::numeric                          AS loss_any_coverage_pct,
  -- Sprint 2.10: usa opportunity_based_coverage como base monetária (não pune org sem propostas)
  ROUND((
    (COALESCE(amt.opportunity_based_coverage_pct, 0) * 0.30) +
    (COALESCE(hist.stage_history_coverage_pct, 0) * 0.20) +
    (COALESCE(hist.owner_history_coverage_pct, 0) * 0.10) +
    (COALESCE(hist.qualification_history_coverage_pct, 0) * 0.15) +
    (COALESCE(loss.complete_coverage_pct, 0) * 0.15) +
    (COALESCE(loss.any_coverage_pct, 0) * 0.10)
  )::numeric, 2) AS overall_confidence_score,
  -- NOVO Sprint 2.10 (no final)
  COALESCE(amt.opportunity_based_coverage_pct, 0)::numeric             AS opportunity_based_coverage_pct
FROM public.v_opportunity_amount_coverage_v2 amt
FULL OUTER JOIN public.v_opportunity_history_coverage_v2 hist
  ON hist.organization_id = amt.organization_id
FULL OUTER JOIN public.v_loss_classification_coverage_v2 loss
  ON loss.organization_id = COALESCE(amt.organization_id, hist.organization_id);

COMMENT ON VIEW public.v_report_confidence_score_v2 IS
  'Sprint 2.10: Score recalibrado. Base monetária = opportunity_based_coverage_pct (proposta OU valor_previsto). Warning visual via UI quando proposal_based < 80%.';

-- ==========================================
-- 4) FONTE ÚNICA DE RECEITA GANHA (CEO ↔ Reports)
-- ==========================================
CREATE OR REPLACE VIEW public.v_unified_won_revenue_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  COUNT(*) FILTER (WHERE status = 'won')                                      AS won_count,
  COALESCE(SUM(net_revenue_final) FILTER (WHERE status = 'won'), 0)::numeric  AS won_revenue,
  COALESCE(SUM(net_revenue_final) FILTER (WHERE status = 'won' AND amount_source = 'accepted_proposal_net'), 0)::numeric    AS won_revenue_via_accepted_proposal,
  COALESCE(SUM(net_revenue_final) FILTER (WHERE status = 'won' AND amount_source = 'latest_commercial_proposal_net'), 0)::numeric AS won_revenue_via_latest_proposal,
  COALESCE(SUM(net_revenue_final) FILTER (WHERE status = 'won' AND amount_source = 'opportunity_valor_previsto'), 0)::numeric    AS won_revenue_via_opportunity_fallback,
  COUNT(*) FILTER (WHERE status = 'won' AND amount_source = 'accepted_proposal_net')          AS won_count_via_accepted_proposal,
  COUNT(*) FILTER (WHERE status = 'won' AND amount_source = 'latest_commercial_proposal_net') AS won_count_via_latest_proposal,
  COUNT(*) FILTER (WHERE status = 'won' AND amount_source = 'opportunity_valor_previsto')     AS won_count_via_opportunity_fallback,
  COUNT(*) FILTER (WHERE status = 'won' AND amount_source = 'zero_fallback')                  AS won_count_via_zero_fallback,
  MAX(closed_at) AS last_won_at
FROM public.v_reporting_opportunities_v2
WHERE pipeline_type = 'sales'
GROUP BY organization_id;

COMMENT ON VIEW public.v_unified_won_revenue_v2 IS
  'Sprint 2.10: Fonte única de receita ganha. CEO Dashboard E Reports V2 leem aqui. Inclui breakdown por amount_source.';
