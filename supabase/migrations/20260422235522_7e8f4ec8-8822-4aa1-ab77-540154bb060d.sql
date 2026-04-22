-- ============================================================
-- Fase 2: Lead Score Intelligence Engine v2 (RAG + KAG)
-- ============================================================

-- 1) AI analysis cache per account
CREATE TABLE IF NOT EXISTS public.lead_score_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  account_id UUID NOT NULL,
  ai_score INTEGER NOT NULL CHECK (ai_score BETWEEN 0 AND 100),
  ai_grade TEXT NOT NULL CHECK (ai_grade IN ('A','B','C','D','F')),
  conversion_probability INTEGER CHECK (conversion_probability BETWEEN 0 AND 100),
  fit_justification TEXT,
  intent_justification TEXT,
  positive_signals JSONB DEFAULT '[]'::jsonb,
  risk_signals JSONB DEFAULT '[]'::jsonb,
  next_best_action TEXT,
  recommended_owner_role TEXT,
  context_snapshot JSONB,
  model_used TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  triggered_by TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual','batch','auto','feedback')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (account_id)
);

CREATE INDEX idx_lead_ai_org ON public.lead_score_ai_analysis(organization_id);
CREATE INDEX idx_lead_ai_grade ON public.lead_score_ai_analysis(organization_id, ai_grade);
CREATE INDEX idx_lead_ai_expires ON public.lead_score_ai_analysis(expires_at);

ALTER TABLE public.lead_score_ai_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read own ai analysis"
  ON public.lead_score_ai_analysis FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "service role full access ai analysis"
  ON public.lead_score_ai_analysis FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2) Segment benchmarks (KAG)
CREATE TABLE IF NOT EXISTS public.lead_segment_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  segmento TEXT NOT NULL,
  total_deals INTEGER DEFAULT 0,
  won_deals INTEGER DEFAULT 0,
  lost_deals INTEGER DEFAULT 0,
  win_rate NUMERIC(5,2) DEFAULT 0,
  avg_ticket NUMERIC(14,2) DEFAULT 0,
  median_ticket NUMERIC(14,2) DEFAULT 0,
  avg_cycle_days INTEGER DEFAULT 0,
  avg_touches INTEGER DEFAULT 0,
  top_win_factors JSONB DEFAULT '[]'::jsonb,
  top_loss_factors JSONB DEFAULT '[]'::jsonb,
  best_owner_role TEXT,
  sample_size INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, segmento)
);

CREATE INDEX idx_seg_bench_org ON public.lead_segment_benchmarks(organization_id);

ALTER TABLE public.lead_segment_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read benchmarks"
  ON public.lead_segment_benchmarks FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "service role full access benchmarks"
  ON public.lead_segment_benchmarks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) Per-organization weights
CREATE TABLE IF NOT EXISTS public.lead_score_org_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  fit_weight NUMERIC(3,2) NOT NULL DEFAULT 0.40 CHECK (fit_weight BETWEEN 0 AND 1),
  intent_weight NUMERIC(3,2) NOT NULL DEFAULT 0.60 CHECK (intent_weight BETWEEN 0 AND 1),
  segment_weights JSONB DEFAULT '{}'::jsonb,
  intent_components JSONB DEFAULT '{"deals":40,"activities":40,"proposals":40,"recency_penalty":-15}'::jsonb,
  trained_from_sample INTEGER DEFAULT 0,
  last_trained_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_score_org_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read weights"
  ON public.lead_score_org_weights FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "org admins update weights"
  ON public.lead_score_org_weights FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = lead_score_org_weights.organization_id
        AND om.org_role IN ('owner','admin')
        AND om.status = 'active'
    )
  );

CREATE POLICY "service role full access weights"
  ON public.lead_score_org_weights FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4) Trigger to refresh benchmarks after won/lost
CREATE OR REPLACE FUNCTION public.notify_segment_benchmark_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_segment TEXT;
  v_url TEXT;
BEGIN
  -- Only fire for status transitions to won/lost
  IF NEW.status NOT IN ('won','lost') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT a.segmento INTO v_segment
  FROM accounts a
  WHERE a.id = NEW.account_id;

  IF v_segment IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP notification (silent on error)
  BEGIN
    v_url := current_setting('app.supabase_url', true);
    IF v_url IS NOT NULL AND length(v_url) > 0 THEN
      PERFORM net.http_post(
        url := v_url || '/functions/v1/refresh-segment-benchmarks',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || coalesce(current_setting('app.service_role_key', true),'')
        ),
        body := jsonb_build_object(
          'organization_id', NEW.organization_id,
          'segment', v_segment,
          'reason','status_change',
          'opportunity_id', NEW.id
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_segment_benchmark_refresh ON public.opportunities;
CREATE TRIGGER trg_segment_benchmark_refresh
AFTER INSERT OR UPDATE OF status ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.notify_segment_benchmark_refresh();

-- 5) Auto-create default weights row for any organization without one
INSERT INTO public.lead_score_org_weights (organization_id)
SELECT id FROM public.organizations
WHERE id NOT IN (SELECT organization_id FROM public.lead_score_org_weights)
ON CONFLICT DO NOTHING;