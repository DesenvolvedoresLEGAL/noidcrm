
-- ===========================================================================
-- Inteligência Semântica das Perdas — Win/Loss Hub
-- (is_recoverable já existe em opportunities como text; tratamos via cast)
-- ===========================================================================

-- 1. Tabela loss_semantic_analyses
CREATE TABLE IF NOT EXISTS public.loss_semantic_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL UNIQUE,

  source_texts jsonb NOT NULL DEFAULT '{}'::jsonb,

  ai_detected_loss_category text,
  ai_detected_loss_reason   text,
  ai_detected_competitor    text,
  ai_confidence_score       integer CHECK (ai_confidence_score IS NULL OR (ai_confidence_score BETWEEN 0 AND 100)),
  ai_summary_short          text,
  recommended_action        text,

  seller_customer_gap       boolean NOT NULL DEFAULT false,
  gap_explanation           text,
  is_recoverable_inferred   boolean,

  diagnosis_quality_score   integer CHECK (diagnosis_quality_score IS NULL OR (diagnosis_quality_score BETWEEN 0 AND 100)),

  model_used       text,
  rule_version     text NOT NULL DEFAULT 'v1',
  context_signature text,

  analyzed_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loss_semantic_analyses_opportunity_fk
    FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lsa_org ON public.loss_semantic_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_lsa_opp ON public.loss_semantic_analyses(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_lsa_org_gap ON public.loss_semantic_analyses(organization_id, seller_customer_gap);
CREATE INDEX IF NOT EXISTS idx_lsa_org_quality ON public.loss_semantic_analyses(organization_id, diagnosis_quality_score);
CREATE INDEX IF NOT EXISTS idx_lsa_signature ON public.loss_semantic_analyses(context_signature);

-- 2. GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loss_semantic_analyses TO authenticated;
GRANT ALL ON public.loss_semantic_analyses TO service_role;

-- 3. RLS
ALTER TABLE public.loss_semantic_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lsa_select_same_org" ON public.loss_semantic_analyses;
CREATE POLICY "lsa_select_same_org"
ON public.loss_semantic_analyses
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- writes só via service_role (edge function)

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_loss_semantic_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loss_semantic_updated_at ON public.loss_semantic_analyses;
CREATE TRIGGER trg_loss_semantic_updated_at
BEFORE UPDATE ON public.loss_semantic_analyses
FOR EACH ROW EXECUTE FUNCTION public.set_loss_semantic_updated_at();

-- 5. View v_loss_semantic_v2
DROP VIEW IF EXISTS public.v_loss_semantic_v2 CASCADE;
CREATE VIEW public.v_loss_semantic_v2
WITH (security_invoker = true)
AS
SELECT
  c.opportunity_id,
  c.organization_id,
  c.pipeline_id,
  c.owner_user_id,
  c.status,
  c.closed_at,
  c.lost_at,

  c.seller_loss_reason_id,
  c.client_loss_reason_id,
  c.consolidated_loss_reason_id,
  c.loss_classification_status,
  c.loss_coverage_bucket,
  c.competitor AS competitor_human,

  s.ai_detected_loss_category,
  s.ai_detected_loss_reason,
  s.ai_detected_competitor,
  s.ai_confidence_score,
  s.diagnosis_quality_score,
  s.seller_customer_gap,
  s.gap_explanation,
  s.recommended_action,
  s.is_recoverable_inferred,
  s.analyzed_at,
  s.model_used,
  s.rule_version,

  LEFT(COALESCE(o.loss_comment, ''), 160) AS seller_diagnosis_excerpt,
  LEFT(COALESCE(s.ai_summary_short, ''), 160) AS ai_summary_excerpt,
  LEFT(COALESCE(
    (
      SELECT p.declined_reason FROM public.proposals p
      WHERE p.opportunity_id = c.opportunity_id
        AND p.declined_reason IS NOT NULL
      ORDER BY p.declined_at DESC NULLS LAST
      LIMIT 1
    ),
    ''
  ), 160) AS customer_comment_excerpt,

  -- is_recoverable em opportunities é text legado → normaliza para boolean
  COALESCE(
    CASE
      WHEN o.is_recoverable IS NULL THEN NULL
      WHEN lower(o.is_recoverable) IN ('true','t','1','yes','sim','recuperavel','recuperável') THEN true
      WHEN lower(o.is_recoverable) IN ('false','f','0','no','nao','não') THEN false
      ELSE NULL
    END,
    s.is_recoverable_inferred,
    false
  ) AS is_recoverable_effective,
  o.valor_previsto,
  o.title AS opportunity_title

FROM public.v_loss_classification_v2 c
LEFT JOIN public.loss_semantic_analyses s ON s.opportunity_id = c.opportunity_id
LEFT JOIN public.opportunities o ON o.id = c.opportunity_id
WHERE c.status = 'lost';

GRANT SELECT ON public.v_loss_semantic_v2 TO authenticated;
GRANT SELECT ON public.v_loss_semantic_v2 TO service_role;

COMMENT ON VIEW public.v_loss_semantic_v2 IS
  'Canonical view: classificação humana + análise IA + excerpts ≤160c (LGPD). IA enriquece, nunca substitui motivo humano.';
