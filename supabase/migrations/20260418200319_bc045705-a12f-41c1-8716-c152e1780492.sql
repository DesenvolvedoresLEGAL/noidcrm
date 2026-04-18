
-- =========================================================================
-- Sprint 2.9 — QA Forense, Reconciliação Final, Readiness e Preparação para IA
-- =========================================================================

-- 1) Confidence Score View
-- Weighted average of coverage signals (0-100).
-- Weights: monetary 30 + stage_history 20 + owner_history 10 + qual_history 15
--        + loss_complete 15 + loss_any 10 = 100
DROP VIEW IF EXISTS public.v_report_confidence_score_v2 CASCADE;
CREATE VIEW public.v_report_confidence_score_v2
WITH (security_invoker = true)
AS
SELECT
  o.id AS organization_id,
  COALESCE(am.proposal_based_coverage_pct, 0)::numeric        AS proposal_based_coverage_pct,
  COALESCE(hi.stage_history_coverage_pct, 0)::numeric         AS stage_history_coverage_pct,
  COALESCE(hi.owner_history_coverage_pct, 0)::numeric         AS owner_history_coverage_pct,
  COALESCE(hi.qualification_history_coverage_pct, 0)::numeric AS qualification_history_coverage_pct,
  COALESCE(ls.complete_coverage_pct, 0)::numeric              AS loss_complete_coverage_pct,
  COALESCE(ls.any_coverage_pct, 0)::numeric                   AS loss_any_coverage_pct,
  ROUND(
    (
      COALESCE(am.proposal_based_coverage_pct, 0) * 0.30 +
      COALESCE(hi.stage_history_coverage_pct, 0)  * 0.20 +
      COALESCE(hi.owner_history_coverage_pct, 0)  * 0.10 +
      COALESCE(hi.qualification_history_coverage_pct, 0) * 0.15 +
      COALESCE(ls.complete_coverage_pct, 0) * 0.15 +
      COALESCE(ls.any_coverage_pct, 0)      * 0.10
    )::numeric,
    2
  ) AS overall_confidence_score
FROM public.organizations o
LEFT JOIN public.v_opportunity_amount_coverage_v2  am ON am.organization_id = o.id
LEFT JOIN public.v_opportunity_history_coverage_v2 hi ON hi.organization_id = o.id
LEFT JOIN public.v_loss_classification_coverage_v2 ls ON ls.organization_id = o.id;

COMMENT ON VIEW public.v_report_confidence_score_v2 IS
'Sprint 2.9 — Pontuação de confiança consolidada dos Relatórios V2. Pesos: monetary 30, stage_history 20, owner_history 10, qual_history 15, loss_complete 15, loss_any 10.';

-- 2) Legacy Retirement Readiness View
-- One row per (org, report_key) for 13 tabs.
DROP VIEW IF EXISTS public.v_report_legacy_retirement_readiness_v2 CASCADE;
CREATE VIEW public.v_report_legacy_retirement_readiness_v2
WITH (security_invoker = true)
AS
WITH tabs(report_key) AS (
  VALUES
    ('general'),('losses'),('forecast'),('closer'),('team'),
    ('origins'),('processed'),('sdr'),('handoff'),
    ('stage_balance'),('stage_conversion'),('stages'),('accumulated')
),
matrix AS (
  SELECT o.id AS organization_id, t.report_key
  FROM public.organizations o CROSS JOIN tabs t
),
last_reconcile AS (
  SELECT DISTINCT ON (organization_id, report_key)
    organization_id,
    report_key,
    is_consistent,
    severity,
    created_at
  FROM public.report_reconciliation_logs
  ORDER BY organization_id, report_key, created_at DESC
),
agg_reconcile AS (
  -- aggregate latest run per (org, report_key) → worst severity & consistency
  SELECT
    organization_id,
    report_key,
    bool_and(is_consistent) AS all_consistent,
    MAX(CASE severity WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) AS worst_sev_code,
    MAX(created_at) AS last_check_at
  FROM public.report_reconciliation_logs
  WHERE created_at > now() - interval '7 days'
  GROUP BY organization_id, report_key
)
SELECT
  m.organization_id,
  m.report_key,
  COALESCE(c.overall_confidence_score, 0)::numeric AS confidence_score,
  COALESCE(ar.all_consistent, false) AS reconcile_consistent,
  COALESCE(
    CASE ar.worst_sev_code WHEN 3 THEN 'critical' WHEN 2 THEN 'warning' WHEN 1 THEN 'info' END,
    'unknown'
  ) AS reconcile_severity,
  ar.last_check_at,
  -- readiness_score per tab criteria (0-100)
  CASE m.report_key
    WHEN 'general' THEN
      LEAST(100, ROUND(
        (CASE WHEN COALESCE(ar.all_consistent,false) THEN 50 ELSE 0 END)
      + (LEAST(COALESCE(c.overall_confidence_score,0), 100) * 0.5)
      ))
    WHEN 'losses' THEN
      LEAST(100, ROUND(COALESCE(c.loss_any_coverage_pct,0) * 0.5 + COALESCE(c.loss_complete_coverage_pct,0) * 0.5))
    WHEN 'forecast' THEN
      LEAST(100, ROUND(
        (CASE WHEN COALESCE(ar.all_consistent,false) THEN 30 ELSE 0 END)
      + (LEAST(COALESCE(c.overall_confidence_score,0),100) * 0.7)
      ))
    WHEN 'closer' THEN
      LEAST(100, ROUND((CASE WHEN COALESCE(ar.all_consistent,false) THEN 60 ELSE 0 END) + LEAST(COALESCE(c.overall_confidence_score,0),100)*0.4))
    WHEN 'team' THEN
      LEAST(100, ROUND((CASE WHEN COALESCE(ar.all_consistent,false) THEN 60 ELSE 0 END) + LEAST(COALESCE(c.overall_confidence_score,0),100)*0.4))
    WHEN 'origins' THEN
      LEAST(100, ROUND((CASE WHEN COALESCE(ar.all_consistent,false) THEN 60 ELSE 0 END) + LEAST(COALESCE(c.overall_confidence_score,0),100)*0.4))
    WHEN 'processed' THEN
      LEAST(100, ROUND((CASE WHEN COALESCE(ar.all_consistent,false) THEN 60 ELSE 0 END) + LEAST(COALESCE(c.overall_confidence_score,0),100)*0.4))
    WHEN 'sdr' THEN
      LEAST(100, ROUND(COALESCE(c.qualification_history_coverage_pct,0)))
    WHEN 'handoff' THEN
      LEAST(100, ROUND(COALESCE(c.qualification_history_coverage_pct,0)))
    WHEN 'stage_balance' THEN
      LEAST(100, ROUND(COALESCE(c.stage_history_coverage_pct,0)))
    WHEN 'stage_conversion' THEN
      LEAST(100, ROUND(COALESCE(c.stage_history_coverage_pct,0)))
    WHEN 'stages' THEN
      LEAST(100, ROUND(COALESCE(c.stage_history_coverage_pct,0)))
    WHEN 'accumulated' THEN
      LEAST(100, ROUND(LEAST(COALESCE(c.overall_confidence_score,0),100)))
    ELSE 0
  END::numeric AS readiness_score,
  CASE m.report_key
    WHEN 'general' THEN
      CASE
        WHEN COALESCE(ar.all_consistent,false) AND COALESCE(c.overall_confidence_score,0) >= 75 THEN 'ready'
        WHEN COALESCE(c.overall_confidence_score,0) >= 55 THEN 'almost_ready'
        ELSE 'not_ready'
      END
    WHEN 'losses' THEN
      CASE
        WHEN COALESCE(c.loss_any_coverage_pct,0) >= 75 AND COALESCE(c.loss_complete_coverage_pct,0) >= 60 THEN 'ready'
        WHEN COALESCE(c.loss_any_coverage_pct,0) >= 55 THEN 'almost_ready'
        ELSE 'not_ready'
      END
    WHEN 'forecast' THEN
      CASE
        WHEN COALESCE(ar.all_consistent,false) AND COALESCE(c.overall_confidence_score,0) >= 75 THEN 'ready'
        WHEN COALESCE(c.overall_confidence_score,0) >= 55 THEN 'almost_ready'
        ELSE 'not_ready'
      END
    WHEN 'closer' THEN
      CASE WHEN COALESCE(ar.all_consistent,false) THEN 'ready'
           WHEN ar.last_check_at IS NULL THEN 'not_ready' ELSE 'almost_ready' END
    WHEN 'team' THEN
      CASE WHEN COALESCE(ar.all_consistent,false) THEN 'ready'
           WHEN ar.last_check_at IS NULL THEN 'not_ready' ELSE 'almost_ready' END
    WHEN 'origins' THEN
      CASE WHEN COALESCE(ar.all_consistent,false) THEN 'ready'
           WHEN ar.last_check_at IS NULL THEN 'not_ready' ELSE 'almost_ready' END
    WHEN 'processed' THEN
      CASE WHEN COALESCE(ar.all_consistent,false) THEN 'ready'
           WHEN ar.last_check_at IS NULL THEN 'not_ready' ELSE 'almost_ready' END
    WHEN 'sdr' THEN
      CASE WHEN COALESCE(c.qualification_history_coverage_pct,0) >= 75 THEN 'ready'
           WHEN COALESCE(c.qualification_history_coverage_pct,0) >= 50 THEN 'almost_ready'
           ELSE 'not_ready' END
    WHEN 'handoff' THEN
      CASE WHEN COALESCE(c.qualification_history_coverage_pct,0) >= 75 THEN 'ready'
           WHEN COALESCE(c.qualification_history_coverage_pct,0) >= 50 THEN 'almost_ready'
           ELSE 'not_ready' END
    WHEN 'stage_balance' THEN
      CASE WHEN COALESCE(c.stage_history_coverage_pct,0) >= 75 THEN 'ready'
           WHEN COALESCE(c.stage_history_coverage_pct,0) >= 50 THEN 'almost_ready'
           ELSE 'not_ready' END
    WHEN 'stage_conversion' THEN
      CASE WHEN COALESCE(c.stage_history_coverage_pct,0) >= 75 THEN 'ready'
           WHEN COALESCE(c.stage_history_coverage_pct,0) >= 50 THEN 'almost_ready'
           ELSE 'not_ready' END
    WHEN 'stages' THEN
      CASE WHEN COALESCE(c.stage_history_coverage_pct,0) >= 75 THEN 'ready'
           WHEN COALESCE(c.stage_history_coverage_pct,0) >= 50 THEN 'almost_ready'
           ELSE 'not_ready' END
    WHEN 'accumulated' THEN
      CASE WHEN COALESCE(c.overall_confidence_score,0) >= 75 THEN 'ready'
           WHEN COALESCE(c.overall_confidence_score,0) >= 55 THEN 'almost_ready'
           ELSE 'not_ready' END
    ELSE 'not_ready'
  END AS readiness_status,
  jsonb_build_object(
    'report_key', m.report_key,
    'confidence_score', COALESCE(c.overall_confidence_score, 0),
    'reconcile_consistent', COALESCE(ar.all_consistent, false),
    'reconcile_last_check_at', ar.last_check_at,
    'monetary_coverage_pct', COALESCE(c.proposal_based_coverage_pct, 0),
    'stage_history_coverage_pct', COALESCE(c.stage_history_coverage_pct, 0),
    'owner_history_coverage_pct', COALESCE(c.owner_history_coverage_pct, 0),
    'qualification_history_coverage_pct', COALESCE(c.qualification_history_coverage_pct, 0),
    'loss_complete_coverage_pct', COALESCE(c.loss_complete_coverage_pct, 0),
    'loss_any_coverage_pct', COALESCE(c.loss_any_coverage_pct, 0)
  ) AS reasons
FROM matrix m
LEFT JOIN public.v_report_confidence_score_v2 c ON c.organization_id = m.organization_id
LEFT JOIN agg_reconcile ar
       ON ar.organization_id = m.organization_id AND ar.report_key = m.report_key;

COMMENT ON VIEW public.v_report_legacy_retirement_readiness_v2 IS
'Sprint 2.9 — Prontidão de desligamento do legacy por aba e por organização. Status: ready/almost_ready/not_ready.';

-- 3) AI Reports Context View
-- Safe per-opportunity projection for AI/agents consumption.
DROP VIEW IF EXISTS public.v_ai_reports_context_v2 CASCADE;
CREATE VIEW public.v_ai_reports_context_v2
WITH (security_invoker = true)
AS
SELECT
  r.organization_id,
  r.opportunity_id,
  r.pipeline_id,
  r.stage_id,
  r.owner_user_id,
  r.qualified_by_user_id,
  r.status,
  r.origem,
  r.created_at,
  r.closed_at,
  r.won_at,
  r.lost_at,
  r.close_date_prevista,
  r.commercial_amount_current,
  r.net_revenue_final,
  r.amount_source,
  r.reference_proposal_status,
  r.first_qualification_at,
  r.days_in_current_stage,
  r.consolidated_loss_reason_id,
  r.loss_reason_source,
  r.loss_classification_status,
  r.loss_coverage_bucket,
  CASE
    WHEN r.status = 'lost' THEN 'lost'
    WHEN r.status = 'won' THEN 'won'
    WHEN r.status = 'open' AND COALESCE(r.days_in_current_stage,0) >= 14 THEN 'at_risk_stalled'
    WHEN r.status = 'open' AND COALESCE(r.days_in_current_stage,0) >= 7  THEN 'attention'
    ELSE 'healthy'
  END AS opportunity_health,
  (r.status = 'open' AND r.close_date_prevista IS NOT NULL AND r.close_date_prevista < now()) AS overdue_close_date_flag
FROM public.v_reporting_opportunities_v2 r;

COMMENT ON VIEW public.v_ai_reports_context_v2 IS
'Sprint 2.9 — Dataset oficial para consumo por IA/agentes. Projeção segura por oportunidade com saúde calculada.';

-- 4) AI Reports Summary Context View
DROP VIEW IF EXISTS public.v_ai_reports_summary_context_v2 CASCADE;
CREATE VIEW public.v_ai_reports_summary_context_v2
WITH (security_invoker = true)
AS
WITH last_overall AS (
  SELECT DISTINCT ON (organization_id)
    organization_id,
    bool_and(is_consistent) OVER (PARTITION BY organization_id, created_at) AS run_consistent,
    MAX(CASE severity WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END)
      OVER (PARTITION BY organization_id, created_at) AS worst_sev_code,
    created_at
  FROM public.report_reconciliation_logs
  ORDER BY organization_id, created_at DESC
)
SELECT
  s.organization_id,
  COALESCE(s.won_revenue, 0)            AS won_revenue,
  COALESCE(s.active_pipeline_value, 0)  AS active_pipeline_value,
  COALESCE(s.lost_value, 0)             AS lost_value,
  COALESCE(f.weighted_pipeline_value,0) AS forecast_weighted_value,
  COALESCE(f.closed_revenue,0)          AS forecast_closed_revenue,
  COALESCE(c.overall_confidence_score, 0) AS confidence_score,
  COALESCE(
    CASE lo.worst_sev_code WHEN 3 THEN 'critical' WHEN 2 THEN 'warning' WHEN 1 THEN 'consistent' END,
    'unknown'
  ) AS reconcile_status,
  lo.created_at AS reconcile_last_at
FROM public.v_report_summary_v2 s
LEFT JOIN public.v_report_forecast_v2 f          ON f.organization_id = s.organization_id
LEFT JOIN public.v_report_confidence_score_v2 c  ON c.organization_id = s.organization_id
LEFT JOIN last_overall lo                        ON lo.organization_id = s.organization_id;

COMMENT ON VIEW public.v_ai_reports_summary_context_v2 IS
'Sprint 2.9 — Resumo executivo por organização para IA: receita, pipeline, perdas, forecast, confiança e reconcile.';
