
-- =====================================================================
-- Sprint 2.5 — Views canônicas dos relatórios V2
-- =====================================================================

-- 1) BASE UNIFICADA --------------------------------------------------
CREATE OR REPLACE VIEW public.v_reporting_opportunities_v2
WITH (security_invoker = true) AS
SELECT
  hb.id                                AS opportunity_id,
  hb.organization_id,
  hb.pipeline_id,
  hb.stage_id,
  hb.owner_user_id,
  co.current_owner_user_id,
  fo.first_owner_user_id,
  fq.first_qualified_by_user_id        AS qualified_by_user_id,
  fq.first_qualification_at,
  hb.status,
  o.origem,
  hb.created_at,
  hb.updated_at,
  hb.closed_at,
  hb.won_at,
  hb.lost_at,
  hb.close_date_prevista,
  am.opportunity_estimated_amount,
  am.commercial_amount_current,
  am.net_revenue_final,
  am.amount_source,
  am.reference_proposal_id,
  am.reference_proposal_status,
  am.commercial_amount_updated_at,
  am.has_accepted_proposal,
  am.has_any_commercial_proposal,
  sa.entered_current_stage_at,
  sa.hours_in_current_stage,
  sa.days_in_current_stage,
  hb.loss_reason_id                    AS seller_loss_reason_id,
  o.client_loss_reason_id,
  lc.win_loss_reason_id,
  lc.consolidated_loss_reason_id,
  lc.loss_reason_source,
  lc.loss_classification_status,
  lc.loss_coverage_bucket,
  p.pipeline_type,
  p.is_primary                         AS pipeline_is_primary
FROM public.v_opportunities_hygiene_base hb
LEFT JOIN public.opportunities o
  ON o.id = hb.id
LEFT JOIN public.v_opportunity_amounts_v2 am
  ON am.opportunity_id = hb.id
LEFT JOIN public.v_opportunity_stage_age_v2 sa
  ON sa.opportunity_id = hb.id
LEFT JOIN public.v_opportunity_first_owner_v2 fo
  ON fo.opportunity_id = hb.id
LEFT JOIN public.v_opportunity_current_owner_v2 co
  ON co.opportunity_id = hb.id
LEFT JOIN public.v_opportunity_first_qualification_v2 fq
  ON fq.opportunity_id = hb.id
LEFT JOIN public.v_loss_classification_v2 lc
  ON lc.opportunity_id = hb.id
LEFT JOIN public.pipelines p
  ON p.id = hb.pipeline_id;

COMMENT ON VIEW public.v_reporting_opportunities_v2 IS
  'Sprint 2.5 — Base canônica unificada V2. Junta hygiene + amounts + stage_age + ownership + qualification + loss classification + pipeline meta. Não filtra status.';

-- 2) SUMMARY ---------------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_summary_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  COUNT(*) FILTER (WHERE status NOT IN ('won','lost'))                    AS active_pipeline_count,
  COALESCE(SUM(commercial_amount_current) FILTER (WHERE status NOT IN ('won','lost')), 0) AS active_pipeline_value,
  COUNT(*) FILTER (WHERE status = 'won')                                   AS won_count,
  COALESCE(SUM(net_revenue_final) FILTER (WHERE status = 'won'), 0)        AS won_revenue,
  COUNT(*) FILTER (WHERE status = 'lost')                                  AS lost_count,
  COALESCE(SUM(commercial_amount_current) FILTER (WHERE status = 'lost'), 0) AS lost_value,
  COUNT(*) FILTER (WHERE status IN ('won','lost'))                         AS processed_count,
  ROUND(
    COUNT(*) FILTER (WHERE status='won')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('won','lost')),0) * 100, 2
  )                                                                        AS win_rate_pct,
  CASE WHEN COUNT(*) FILTER (WHERE status='won') > 0
       THEN ROUND(SUM(net_revenue_final) FILTER (WHERE status='won')::numeric
            / COUNT(*) FILTER (WHERE status='won'), 2)
       ELSE 0 END                                                          AS avg_won_ticket
FROM public.v_reporting_opportunities_v2
WHERE pipeline_type = 'sales'
GROUP BY organization_id;

-- 3) PROCESSED -------------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_processed_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  COUNT(*) FILTER (WHERE status='won')                                     AS won_count,
  COALESCE(SUM(net_revenue_final) FILTER (WHERE status='won'),0)           AS won_revenue,
  CASE WHEN COUNT(*) FILTER (WHERE status='won')>0
       THEN ROUND(SUM(net_revenue_final) FILTER (WHERE status='won')::numeric
            / COUNT(*) FILTER (WHERE status='won'),2) ELSE 0 END           AS avg_won_ticket,
  COUNT(*) FILTER (WHERE status='lost')                                    AS lost_count,
  COALESCE(SUM(commercial_amount_current) FILTER (WHERE status='lost'),0)  AS lost_value,
  CASE WHEN COUNT(*) FILTER (WHERE status='lost')>0
       THEN ROUND(SUM(commercial_amount_current) FILTER (WHERE status='lost')::numeric
            / COUNT(*) FILTER (WHERE status='lost'),2) ELSE 0 END          AS avg_lost_ticket,
  COUNT(*) FILTER (WHERE status IN ('won','lost'))                         AS processed_count,
  ROUND(
    COUNT(*) FILTER (WHERE status='won')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('won','lost')),0) * 100, 2
  )                                                                        AS win_rate_pct
FROM public.v_reporting_opportunities_v2
WHERE pipeline_type = 'sales'
GROUP BY organization_id;

-- 4) LOSSES (rollup) -------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_losses_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  consolidated_loss_reason_id,
  loss_reason_source,
  loss_classification_status,
  loss_coverage_bucket,
  COUNT(*)                                                                 AS lost_count,
  COALESCE(SUM(commercial_amount_current),0)                               AS lost_value,
  CASE WHEN COUNT(*)>0
       THEN ROUND(SUM(commercial_amount_current)::numeric/COUNT(*),2)
       ELSE 0 END                                                          AS avg_lost_ticket
FROM public.v_reporting_opportunities_v2
WHERE status='lost'
GROUP BY organization_id, consolidated_loss_reason_id, loss_reason_source,
         loss_classification_status, loss_coverage_bucket;

-- 5) LOSSES DETAIL ---------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_losses_detail_v2
WITH (security_invoker = true) AS
SELECT
  ld.opportunity_id,
  ld.organization_id,
  ld.pipeline_id,
  ld.stage_id,
  ld.owner_user_id,
  ld.qualified_by_user_id,
  ld.seller_loss_reason_id,
  ld.client_loss_reason_id,
  ld.win_loss_reason_id,
  ld.consolidated_loss_reason_id,
  ld.loss_reason_source,
  ld.loss_classification_status,
  ld.loss_coverage_bucket,
  ld.seller_loss_reason_name,
  ld.seller_loss_reason_category,
  ld.client_loss_reason_name,
  ld.client_loss_reason_category,
  ld.win_loss_reason_name,
  ld.win_loss_reason_category,
  ld.competitor,
  ld.discount_given,
  ld.sales_cycle_days,
  ld.decision_makers,
  ld.lessons_learned,
  ld.reason_free_text,
  ld.commercial_amount_current,
  ld.amount_source,
  ld.reference_proposal_id,
  ld.reference_proposal_status,
  ld.created_at,
  ld.lost_at
FROM public.v_lost_deals_amounts_v2 ld;

-- 6) ORIGINS ---------------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_origins_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  COALESCE(NULLIF(TRIM(origem),''), 'Sem origem')                          AS origin_name,
  COUNT(*)                                                                 AS total_count,
  COUNT(*) FILTER (WHERE status='won')                                     AS won_count,
  COUNT(*) FILTER (WHERE status='lost')                                    AS lost_count,
  COUNT(*) FILTER (WHERE status NOT IN ('won','lost'))                     AS open_count,
  COALESCE(SUM(net_revenue_final) FILTER (WHERE status='won'),0)           AS won_revenue,
  COALESCE(SUM(commercial_amount_current) FILTER (WHERE status NOT IN ('won','lost')),0) AS open_pipeline_value,
  ROUND(
    COUNT(*) FILTER (WHERE status='won')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('won','lost')),0) * 100, 2
  )                                                                        AS win_rate_pct,
  CASE WHEN COUNT(*) FILTER (WHERE status='won')>0
       THEN ROUND(SUM(net_revenue_final) FILTER (WHERE status='won')::numeric
            / COUNT(*) FILTER (WHERE status='won'),2) ELSE 0 END           AS avg_won_ticket
FROM public.v_reporting_opportunities_v2
WHERE pipeline_type='sales'
GROUP BY organization_id, COALESCE(NULLIF(TRIM(origem),''), 'Sem origem');

-- 7) FORECAST --------------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_forecast_v2
WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    r.organization_id,
    r.pipeline_id                                              AS primary_pipeline_id,
    r.status,
    r.commercial_amount_current,
    r.net_revenue_final,
    r.close_date_prevista,
    COALESCE(s.probability, 0)::numeric / 100.0                AS prob_factor
  FROM public.v_reporting_opportunities_v2 r
  LEFT JOIN public.stages s ON s.id = r.stage_id
  WHERE r.pipeline_is_primary = true
    AND r.pipeline_type = 'sales'
)
SELECT
  b.organization_id,
  MAX(b.primary_pipeline_id)                                                   AS primary_pipeline_id,
  COALESCE(SUM(b.net_revenue_final) FILTER (WHERE b.status='won'),0)           AS closed_revenue,
  COALESCE(SUM(b.commercial_amount_current) FILTER (WHERE b.status NOT IN ('won','lost')),0) AS open_pipeline_value,
  COALESCE(SUM(b.commercial_amount_current * b.prob_factor) FILTER (WHERE b.status NOT IN ('won','lost')),0) AS weighted_pipeline_value,
  COALESCE(MAX(os.monthly_revenue_goal),0)                                     AS monthly_revenue_goal,
  COALESCE(MAX(os.quarterly_revenue_goal),0)                                   AS quarterly_revenue_goal,
  COALESCE(MAX(os.annual_revenue_goal),0)                                      AS annual_revenue_goal,
  ROUND(
    COUNT(*) FILTER (WHERE b.status NOT IN ('won','lost')
                       AND b.commercial_amount_current > 0
                       AND b.close_date_prevista IS NOT NULL)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE b.status NOT IN ('won','lost')),0) * 100, 2
  )                                                                            AS forecast_reliability_pct
FROM base b
LEFT JOIN public.organization_settings os ON os.organization_id = b.organization_id
GROUP BY b.organization_id;

-- 8) TEAM ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_team_v2
WITH (security_invoker = true) AS
SELECT
  r.organization_id,
  r.owner_user_id,
  pr.full_name                                                                  AS owner_name,
  COUNT(*) FILTER (WHERE r.status='won')                                        AS won_count,
  COUNT(*) FILTER (WHERE r.status='lost')                                       AS lost_count,
  COUNT(*) FILTER (WHERE r.status NOT IN ('won','lost'))                        AS active_count,
  COALESCE(SUM(r.net_revenue_final) FILTER (WHERE r.status='won'),0)            AS won_revenue,
  COALESCE(SUM(r.commercial_amount_current) FILTER (WHERE r.status NOT IN ('won','lost')),0) AS active_pipeline_value,
  ROUND(
    COUNT(*) FILTER (WHERE r.status='won')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE r.status IN ('won','lost')),0) * 100, 2
  )                                                                             AS win_rate_pct,
  CASE WHEN COUNT(*) FILTER (WHERE r.status='won')>0
       THEN ROUND(SUM(r.net_revenue_final) FILTER (WHERE r.status='won')::numeric
            / COUNT(*) FILTER (WHERE r.status='won'),2) ELSE 0 END              AS avg_won_ticket
FROM public.v_reporting_opportunities_v2 r
LEFT JOIN public.profiles pr ON pr.user_id = r.owner_user_id
WHERE r.pipeline_type='sales' AND r.owner_user_id IS NOT NULL
GROUP BY r.organization_id, r.owner_user_id, pr.full_name;

-- 9) CLOSER ----------------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_closer_v2
WITH (security_invoker = true) AS
SELECT
  r.organization_id,
  r.owner_user_id                                                               AS closer_user_id,
  pr.full_name                                                                  AS closer_name,
  COUNT(*) FILTER (WHERE r.status='won')                                        AS won_count,
  COUNT(*) FILTER (WHERE r.status='lost')                                       AS lost_count,
  COUNT(*) FILTER (WHERE r.status NOT IN ('won','lost'))                        AS active_count,
  COALESCE(SUM(r.net_revenue_final) FILTER (WHERE r.status='won'),0)            AS won_revenue,
  COALESCE(SUM(r.commercial_amount_current) FILTER (WHERE r.status NOT IN ('won','lost')),0) AS active_pipeline_value,
  ROUND(
    COUNT(*) FILTER (WHERE r.status='won')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE r.status IN ('won','lost')),0) * 100, 2
  )                                                                             AS win_rate_pct,
  CASE WHEN COUNT(*) FILTER (WHERE r.status='won')>0
       THEN ROUND(SUM(r.net_revenue_final) FILTER (WHERE r.status='won')::numeric
            / COUNT(*) FILTER (WHERE r.status='won'),2) ELSE 0 END              AS avg_won_ticket,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (COALESCE(r.won_at, r.lost_at) - r.created_at))/86400)
    FILTER (WHERE r.status IN ('won','lost') AND r.created_at IS NOT NULL)::numeric, 2
  )                                                                             AS avg_sales_cycle_days
FROM public.v_reporting_opportunities_v2 r
LEFT JOIN public.profiles pr ON pr.user_id = r.owner_user_id
WHERE r.pipeline_type='sales' AND r.owner_user_id IS NOT NULL
GROUP BY r.organization_id, r.owner_user_id, pr.full_name;

-- 10) SDR ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_sdr_v2
WITH (security_invoker = true) AS
SELECT
  r.organization_id,
  r.qualified_by_user_id                                                        AS sdr_user_id,
  pr.full_name                                                                  AS sdr_name,
  COUNT(*) FILTER (WHERE r.first_qualification_at IS NOT NULL)                  AS sqls_generated,
  COUNT(*) FILTER (WHERE r.status='won')                                        AS won_count,
  COUNT(*) FILTER (WHERE r.status='lost')                                       AS lost_count,
  COALESCE(SUM(r.net_revenue_final) FILTER (WHERE r.status='won' AND r.first_qualification_at IS NOT NULL),0) AS revenue_attributed,
  ROUND(
    COUNT(*) FILTER (WHERE r.status='won')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE r.status IN ('won','lost')),0) * 100, 2
  )                                                                             AS win_rate_pct,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (r.first_qualification_at - r.created_at))/3600)
    FILTER (WHERE r.first_qualification_at IS NOT NULL AND r.created_at IS NOT NULL)::numeric, 2
  )                                                                             AS avg_qualification_hours
FROM public.v_reporting_opportunities_v2 r
LEFT JOIN public.profiles pr ON pr.user_id = r.qualified_by_user_id
WHERE r.qualified_by_user_id IS NOT NULL
GROUP BY r.organization_id, r.qualified_by_user_id, pr.full_name;

-- 11) HANDOFF --------------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_handoff_v2
WITH (security_invoker = true) AS
SELECT
  r.organization_id,
  r.qualified_by_user_id                                                        AS sdr_user_id,
  r.owner_user_id                                                               AS closer_user_id,
  sdr.full_name                                                                 AS sdr_name,
  closer.full_name                                                              AS closer_name,
  COUNT(*)                                                                      AS total_handoffs,
  COUNT(*) FILTER (WHERE r.status='won')                                        AS won_count,
  COUNT(*) FILTER (WHERE r.status='lost')                                       AS lost_count,
  COALESCE(SUM(r.net_revenue_final) FILTER (WHERE r.status='won'),0)            AS won_revenue,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (r.first_qualification_at - r.created_at))/3600)
    FILTER (WHERE r.first_qualification_at IS NOT NULL)::numeric, 2
  )                                                                             AS avg_qualification_hours,
  ROUND(
    COUNT(*) FILTER (WHERE r.status='won')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE r.status IN ('won','lost')),0) * 100, 2
  )                                                                             AS win_rate_pct
FROM public.v_reporting_opportunities_v2 r
LEFT JOIN public.profiles sdr    ON sdr.user_id    = r.qualified_by_user_id
LEFT JOIN public.profiles closer ON closer.user_id = r.owner_user_id
WHERE r.qualified_by_user_id IS NOT NULL
  AND r.owner_user_id IS NOT NULL
  AND r.qualified_by_user_id <> r.owner_user_id
GROUP BY r.organization_id, r.qualified_by_user_id, r.owner_user_id, sdr.full_name, closer.full_name;

-- 12) STAGE BALANCE --------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_stage_balance_v2
WITH (security_invoker = true) AS
SELECT
  r.organization_id,
  r.pipeline_id,
  r.stage_id,
  s.name                                                                        AS stage_name,
  COUNT(*) FILTER (WHERE r.status NOT IN ('won','lost'))                        AS active_count,
  COALESCE(SUM(r.commercial_amount_current) FILTER (WHERE r.status NOT IN ('won','lost')),0) AS active_value,
  ROUND(AVG(r.days_in_current_stage) FILTER (WHERE r.status NOT IN ('won','lost'))::numeric, 2) AS avg_days_in_stage
FROM public.v_reporting_opportunities_v2 r
LEFT JOIN public.stages s ON s.id = r.stage_id
GROUP BY r.organization_id, r.pipeline_id, r.stage_id, s.name;

-- 13) STAGE CONVERSION ----------------------------------------------
CREATE OR REPLACE VIEW public.v_report_stage_conversion_v2
WITH (security_invoker = true) AS
WITH transitions AS (
  SELECT
    h.organization_id,
    h.pipeline_id,
    h.from_stage_id,
    h.to_stage_id,
    COUNT(*) AS transition_count
  FROM public.opportunity_stage_history h
  WHERE h.from_stage_id IS NOT NULL AND h.to_stage_id IS NOT NULL
  GROUP BY h.organization_id, h.pipeline_id, h.from_stage_id, h.to_stage_id
),
totals AS (
  SELECT organization_id, pipeline_id, from_stage_id, SUM(transition_count) AS total_out
  FROM transitions
  GROUP BY organization_id, pipeline_id, from_stage_id
)
SELECT
  t.organization_id,
  t.pipeline_id,
  t.from_stage_id,
  sf.name                                                                       AS from_stage_name,
  t.to_stage_id,
  st.name                                                                       AS to_stage_name,
  t.transition_count,
  ROUND(t.transition_count::numeric / NULLIF(tt.total_out,0) * 100, 2)          AS transition_rate_pct
FROM transitions t
LEFT JOIN totals tt
  ON tt.organization_id=t.organization_id
 AND tt.pipeline_id=t.pipeline_id
 AND tt.from_stage_id=t.from_stage_id
LEFT JOIN public.stages sf ON sf.id = t.from_stage_id
LEFT JOIN public.stages st ON st.id = t.to_stage_id;

-- 14) ACCUMULATED ----------------------------------------------------
CREATE OR REPLACE VIEW public.v_report_accumulated_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  date_trunc('day', created_at)::date                                           AS day,
  COUNT(*)                                                                      AS created_count,
  COALESCE(SUM(commercial_amount_current),0)                                    AS created_value
FROM public.v_reporting_opportunities_v2
WHERE created_at IS NOT NULL
GROUP BY organization_id, date_trunc('day', created_at)::date;

-- =====================================================================
-- COMENTÁRIOS DE DEPRECAÇÃO em views legadas relevantes
-- =====================================================================
DO $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN
    SELECT viewname FROM pg_views
    WHERE schemaname='public'
      AND viewname IN (
        'v_lost_reasons_aggregated',
        'v_pipeline_summary',
        'v_team_performance',
        'v_closer_performance',
        'v_sdr_performance',
        'v_origins_breakdown',
        'v_forecast_summary',
        'v_stage_conversion',
        'v_stage_balance'
      )
  LOOP
    EXECUTE format(
      'COMMENT ON VIEW public.%I IS %L',
      v.viewname,
      'DEPRECATED Sprint 2.5 — substituída pela camada V2 (v_report_*_v2). Ver src/lib/reports/reportsAuditStatus.ts.'
    );
  END LOOP;
END $$;
