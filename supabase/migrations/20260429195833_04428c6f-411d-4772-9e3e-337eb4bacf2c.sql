
-- =========================================================================
-- SPRINT E — Agent-Driven Experimentation Engine
-- =========================================================================

-- ---------- 1. experiment_hypotheses ----------
CREATE TABLE public.experiment_hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  hypothesis_type TEXT NOT NULL CHECK (hypothesis_type IN ('template','channel','timing','icp')),
  target_entity TEXT NOT NULL,           -- e.g. 'email_template'
  target_id UUID,                        -- e.g. email_templates.id
  description TEXT NOT NULL,
  source_insight_id UUID REFERENCES public.optimization_insights(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL DEFAULT 'system',  -- 'system' or auth.uid()::text
  confidence_score NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','running','completed','rejected','promoted')),
  winner_variant_id UUID,
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_exp_hyp_org_status ON public.experiment_hypotheses(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_exp_hyp_target ON public.experiment_hypotheses(target_entity, target_id);
CREATE INDEX idx_exp_hyp_running_unique ON public.experiment_hypotheses(organization_id, target_entity, target_id)
  WHERE status = 'running' AND deleted_at IS NULL;

ALTER TABLE public.experiment_hypotheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view experiment hypotheses"
  ON public.experiment_hypotheses FOR SELECT
  USING (is_active_org_member(organization_id, auth.uid()));

-- writes via service role / SECURITY DEFINER RPCs only

-- ---------- 2. experiment_variants ----------
CREATE TABLE public.experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  hypothesis_id UUID NOT NULL REFERENCES public.experiment_hypotheses(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,           -- 'A','B','C'
  is_control BOOLEAN NOT NULL DEFAULT false,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  allocation_percentage INT NOT NULL DEFAULT 50 CHECK (allocation_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hypothesis_id, variant_label)
);
CREATE INDEX idx_exp_var_hyp ON public.experiment_variants(hypothesis_id);

ALTER TABLE public.experiment_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view experiment variants"
  ON public.experiment_variants FOR SELECT
  USING (is_active_org_member(organization_id, auth.uid()));

-- ---------- 3. experiment_runs ----------
CREATE TABLE public.experiment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  hypothesis_id UUID NOT NULL REFERENCES public.experiment_hypotheses(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.experiment_variants(id) ON DELETE CASCADE,
  prospect_id UUID,
  opportunity_id UUID,
  contact_id UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending','success','fail','neutral')),
  result_event TEXT
    CHECK (result_event IS NULL OR result_event IN ('reply','meeting','win','loss','no_response')),
  result_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hypothesis_id, opportunity_id)
);
CREATE INDEX idx_exp_runs_hyp_var ON public.experiment_runs(hypothesis_id, variant_id);
CREATE INDEX idx_exp_runs_opportunity ON public.experiment_runs(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_exp_runs_open ON public.experiment_runs(hypothesis_id) WHERE result = 'pending';

ALTER TABLE public.experiment_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view experiment runs"
  ON public.experiment_runs FOR SELECT
  USING (is_active_org_member(organization_id, auth.uid()));

-- ---------- 4. experiment_results ----------
CREATE TABLE public.experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  hypothesis_id UUID NOT NULL REFERENCES public.experiment_hypotheses(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.experiment_variants(id) ON DELETE CASCADE,
  sent INT NOT NULL DEFAULT 0,
  replies INT NOT NULL DEFAULT 0,
  meetings INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  reply_rate NUMERIC NOT NULL DEFAULT 0,
  meeting_rate NUMERIC NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  score NUMERIC NOT NULL DEFAULT 0,
  sample_size INT NOT NULL DEFAULT 0,
  statistical_confidence NUMERIC NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hypothesis_id, variant_id)
);
CREATE INDEX idx_exp_results_hyp ON public.experiment_results(hypothesis_id);

ALTER TABLE public.experiment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view experiment results"
  ON public.experiment_results FOR SELECT
  USING (is_active_org_member(organization_id, auth.uid()));

-- ---------- 5. agent_guardrails ----------
CREATE TABLE public.agent_guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  max_experiments_per_day INT NOT NULL DEFAULT 5,
  max_variants_per_test INT NOT NULL DEFAULT 3,
  min_sample_size INT NOT NULL DEFAULT 20,
  min_lift_to_promote NUMERIC NOT NULL DEFAULT 0.10,
  allow_auto_apply BOOLEAN NOT NULL DEFAULT false,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  experiments_enabled BOOLEAN NOT NULL DEFAULT false,
  allowed_hypothesis_types TEXT[] NOT NULL DEFAULT ARRAY['template','channel','timing','icp'],
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_guardrails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view guardrails"
  ON public.agent_guardrails FOR SELECT
  USING (is_active_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins update guardrails"
  ON public.agent_guardrails FOR UPDATE
  USING (
    is_active_org_member(organization_id, auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    is_active_org_member(organization_id, auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- ---------- 6. updated_at triggers ----------
CREATE TRIGGER trg_exp_hyp_updated_at
  BEFORE UPDATE ON public.experiment_hypotheses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_agent_guardrails_updated_at
  BEFORE UPDATE ON public.agent_guardrails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 7. RPCs ----------
CREATE OR REPLACE FUNCTION public.get_or_create_agent_guardrails(_org_id UUID)
RETURNS public.agent_guardrails
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.agent_guardrails;
BEGIN
  IF NOT is_active_org_member(_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO rec FROM public.agent_guardrails WHERE organization_id = _org_id;
  IF NOT FOUND THEN
    INSERT INTO public.agent_guardrails (organization_id) VALUES (_org_id)
    RETURNING * INTO rec;
  END IF;
  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_hypothesis(_hypothesis_id UUID)
RETURNS public.experiment_hypotheses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.experiment_hypotheses;
BEGIN
  SELECT * INTO rec FROM public.experiment_hypotheses WHERE id = _hypothesis_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'hypothesis_not_found'; END IF;
  IF NOT is_active_org_member(rec.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)) THEN
    RAISE EXCEPTION 'requires_admin_or_manager';
  END IF;
  IF rec.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_state: %', rec.status;
  END IF;

  UPDATE public.experiment_hypotheses
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = _hypothesis_id
  RETURNING * INTO rec;
  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_hypothesis(_hypothesis_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.experiment_hypotheses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.experiment_hypotheses;
BEGIN
  SELECT * INTO rec FROM public.experiment_hypotheses WHERE id = _hypothesis_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'hypothesis_not_found'; END IF;
  IF NOT is_active_org_member(rec.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)) THEN
    RAISE EXCEPTION 'requires_admin_or_manager';
  END IF;
  IF rec.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'invalid_state: %', rec.status;
  END IF;

  UPDATE public.experiment_hypotheses
  SET status = 'rejected',
      rejection_reason = _reason,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      completed_at = now()
  WHERE id = _hypothesis_id
  RETURNING * INTO rec;
  RETURN rec;
END;
$$;

-- ---------- 8. Trigger: opportunity won/lost -> close experiment runs ----------
CREATE OR REPLACE FUNCTION public.trg_experiment_runs_on_opp_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IN ('won','lost'))
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.experiment_runs
    SET result = CASE WHEN NEW.status = 'won' THEN 'success' ELSE 'fail' END,
        result_event = CASE WHEN NEW.status = 'won' THEN 'win' ELSE 'loss' END,
        result_at = now()
    WHERE opportunity_id = NEW.id
      AND result = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='opportunities') THEN
    DROP TRIGGER IF EXISTS trg_experiment_runs_on_opp_close ON public.opportunities;
    CREATE TRIGGER trg_experiment_runs_on_opp_close
      AFTER UPDATE OF status ON public.opportunities
      FOR EACH ROW EXECUTE FUNCTION public.trg_experiment_runs_on_opp_close();
  END IF;
END $$;
