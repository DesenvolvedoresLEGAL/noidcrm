-- ============================================================
-- Sprint 2.4 — Loss Intelligence V2
-- ============================================================

-- ----------------------------------------------------------
-- FASE 1.1 — Bucket legado por organização (idempotente)
-- ----------------------------------------------------------
INSERT INTO public.loss_reasons (organization_id, name, category, audience, is_active)
SELECT DISTINCT o.id, 'Não classificado - legado', 'Sem Classificação', 'seller', true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.loss_reasons lr
  WHERE lr.organization_id = o.id
    AND lr.name = 'Não classificado - legado'
    AND lr.category = 'Sem Classificação'
);

INSERT INTO public.loss_reasons (organization_id, name, category, audience, is_active)
SELECT DISTINCT o.id, 'Classificação obrigatória pendente', 'Pendência Operacional', 'seller', false
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.loss_reasons lr
  WHERE lr.organization_id = o.id
    AND lr.name = 'Classificação obrigatória pendente'
    AND lr.category = 'Pendência Operacional'
);

-- ----------------------------------------------------------
-- FASE 1.2 — Trigger de enforcement
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_loss_reason_on_lost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM 'lost')
     AND NEW.status = 'lost'
     AND COALESCE(NEW.requires_seller_classification, false) = true
     AND NEW.loss_reason_id IS NULL
  THEN
    RAISE EXCEPTION 'Classificação de perda obrigatória: informe loss_reason_id antes de marcar como perdida.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loss_reason_on_lost ON public.opportunities;
CREATE TRIGGER trg_enforce_loss_reason_on_lost
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loss_reason_on_lost();

-- ----------------------------------------------------------
-- FASE 1.3 — Backfill conservador
-- ----------------------------------------------------------
UPDATE public.opportunities opp
SET loss_reason_id = lr.id
FROM public.loss_reasons lr
WHERE opp.status = 'lost'
  AND opp.deleted_at IS NULL
  AND opp.loss_reason_id IS NULL
  AND lr.organization_id = opp.organization_id
  AND lr.name = 'Não classificado - legado'
  AND lr.category = 'Sem Classificação';

-- ----------------------------------------------------------
-- FASE 1.4 — 6 Views (security_invoker = true)
-- ----------------------------------------------------------

-- 1) v_win_loss_records_normalized_v2
DROP VIEW IF EXISTS public.v_win_loss_records_normalized_v2 CASCADE;
CREATE VIEW public.v_win_loss_records_normalized_v2
WITH (security_invoker = true) AS
SELECT DISTINCT ON (wlr.opportunity_id)
  wlr.id,
  wlr.organization_id,
  wlr.opportunity_id,
  wlr.reason_id           AS win_loss_reason_id,
  wlr.client_reason_id    AS win_loss_client_reason_id,
  wlr.win_reason_id,
  wlr.reason_free_text,
  lr.category             AS category,
  wlr.competitor,
  wlr.discount_given,
  wlr.sales_cycle_days,
  wlr.decision_makers,
  wlr.lessons_learned,
  wlr.created_at,
  wlr.created_at          AS updated_at
FROM public.win_loss_records wlr
LEFT JOIN public.loss_reasons lr ON lr.id = wlr.reason_id
ORDER BY wlr.opportunity_id, wlr.created_at DESC;

-- 2) v_loss_classification_v2
DROP VIEW IF EXISTS public.v_loss_classification_v2 CASCADE;
CREATE VIEW public.v_loss_classification_v2
WITH (security_invoker = true) AS
SELECT
  hyg.id                                   AS opportunity_id,
  hyg.organization_id,
  hyg.pipeline_id,
  hyg.stage_id,
  hyg.owner_user_id,
  o.qualified_by_user_id,
  hyg.status,
  hyg.created_at,
  hyg.updated_at,
  hyg.closed_at,
  hyg.lost_at,
  hyg.loss_reason_id                       AS seller_loss_reason_id,
  o.client_loss_reason_id                  AS client_loss_reason_id,
  wlr.win_loss_reason_id,
  wlr.win_loss_client_reason_id,
  wlr.reason_free_text,
  wlr.category                             AS win_loss_category,
  wlr.competitor,
  wlr.discount_given,
  wlr.sales_cycle_days,
  wlr.decision_makers,
  wlr.lessons_learned,
  COALESCE(hyg.loss_reason_id, wlr.win_loss_reason_id) AS consolidated_loss_reason_id,
  CASE
    WHEN hyg.loss_reason_id IS NOT NULL      THEN 'seller_loss_reason'
    WHEN wlr.win_loss_reason_id IS NOT NULL  THEN 'win_loss_record'
    ELSE 'unclassified'
  END AS loss_reason_source,
  CASE
    WHEN hyg.loss_reason_id IS NOT NULL
         AND o.client_loss_reason_id IS NOT NULL
         AND wlr.id IS NOT NULL
      THEN 'fully_classified'
    WHEN hyg.loss_reason_id IS NOT NULL
         AND o.client_loss_reason_id IS NOT NULL
      THEN 'partially_classified'
    WHEN hyg.loss_reason_id IS NOT NULL
         AND wlr.id IS NOT NULL
      THEN 'partially_classified'
    WHEN hyg.loss_reason_id IS NOT NULL
      THEN 'seller_only'
    WHEN o.client_loss_reason_id IS NOT NULL
      THEN 'client_only'
    WHEN wlr.id IS NOT NULL
      THEN 'win_loss_only'
    ELSE 'unclassified_legacy'
  END AS loss_classification_status,
  CASE
    WHEN hyg.loss_reason_id IS NOT NULL
         AND o.client_loss_reason_id IS NOT NULL
         AND wlr.id IS NOT NULL
      THEN 'complete'
    WHEN hyg.loss_reason_id IS NOT NULL
         OR o.client_loss_reason_id IS NOT NULL
         OR wlr.id IS NOT NULL
      THEN 'partial'
    ELSE 'missing'
  END AS loss_coverage_bucket
FROM public.v_opportunities_hygiene_base hyg
JOIN public.opportunities o ON o.id = hyg.id
LEFT JOIN public.v_win_loss_records_normalized_v2 wlr
  ON wlr.opportunity_id = hyg.id
WHERE hyg.status = 'lost';

-- 3) v_lost_deals_v2
DROP VIEW IF EXISTS public.v_lost_deals_v2 CASCADE;
CREATE VIEW public.v_lost_deals_v2
WITH (security_invoker = true) AS
SELECT
  lc.*,
  slr.name      AS seller_loss_reason_name,
  slr.category  AS seller_loss_reason_category,
  clr.name      AS client_loss_reason_name,
  clr.category  AS client_loss_reason_category,
  wr.name       AS win_loss_reason_name,
  wr.category   AS win_loss_reason_category
FROM public.v_loss_classification_v2 lc
LEFT JOIN public.loss_reasons slr ON slr.id = lc.seller_loss_reason_id
LEFT JOIN public.loss_reasons clr ON clr.id = lc.client_loss_reason_id
LEFT JOIN public.loss_reasons wr  ON wr.id  = lc.win_loss_reason_id;

-- 4) v_loss_classification_coverage_v2
DROP VIEW IF EXISTS public.v_loss_classification_coverage_v2 CASCADE;
CREATE VIEW public.v_loss_classification_coverage_v2
WITH (security_invoker = true) AS
SELECT
  organization_id,
  COUNT(*)::int                                                                 AS total_lost_opportunities,
  COUNT(*) FILTER (WHERE loss_classification_status = 'fully_classified')::int  AS fully_classified_count,
  COUNT(*) FILTER (WHERE loss_classification_status = 'seller_only')::int       AS seller_only_count,
  COUNT(*) FILTER (WHERE loss_classification_status = 'client_only')::int       AS client_only_count,
  COUNT(*) FILTER (WHERE loss_classification_status = 'win_loss_only')::int     AS win_loss_only_count,
  COUNT(*) FILTER (WHERE loss_classification_status = 'unclassified_legacy')::int AS unclassified_legacy_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE loss_coverage_bucket = 'complete')::numeric
    / NULLIF(COUNT(*), 0),
    2
  ) AS complete_coverage_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE loss_coverage_bucket IN ('complete','partial'))::numeric
    / NULLIF(COUNT(*), 0),
    2
  ) AS any_coverage_pct
FROM public.v_loss_classification_v2
GROUP BY organization_id;

-- 5) v_loss_reason_rollup_v2
DROP VIEW IF EXISTS public.v_loss_reason_rollup_v2 CASCADE;
CREATE VIEW public.v_loss_reason_rollup_v2
WITH (security_invoker = true) AS
SELECT
  lc.organization_id,
  COALESCE(lc.consolidated_loss_reason_id::text, 'unclassified') AS loss_reason_key,
  COALESCE(lr.name, 'Sem motivo registrado')                     AS loss_reason_name,
  COALESCE(lr.category, 'Sem Classificação')                     AS loss_reason_category,
  lc.loss_reason_source,
  lc.loss_classification_status,
  COUNT(*)::int                                                  AS lost_count,
  COUNT(*) FILTER (WHERE lc.client_loss_reason_id IS NOT NULL)::int AS with_client_reason_count
FROM public.v_loss_classification_v2 lc
LEFT JOIN public.loss_reasons lr ON lr.id = lc.consolidated_loss_reason_id
GROUP BY
  lc.organization_id,
  lc.consolidated_loss_reason_id,
  lr.name,
  lr.category,
  lc.loss_reason_source,
  lc.loss_classification_status;

-- 6) v_lost_deals_amounts_v2 — integração Sprint 2.2
DROP VIEW IF EXISTS public.v_lost_deals_amounts_v2 CASCADE;
CREATE VIEW public.v_lost_deals_amounts_v2
WITH (security_invoker = true) AS
SELECT
  ld.*,
  amt.commercial_amount_current,
  amt.amount_source,
  amt.reference_proposal_id,
  amt.reference_proposal_status,
  amt.commercial_amount_updated_at
FROM public.v_lost_deals_v2 ld
LEFT JOIN public.v_opportunity_amounts_v2 amt
  ON amt.opportunity_id = ld.opportunity_id;