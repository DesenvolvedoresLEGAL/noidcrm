-- Sprint C: Learning Loop infrastructure (fixed)

-- 1.1 learning_signals
CREATE TABLE IF NOT EXISTS public.learning_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_value TEXT NOT NULL,
  occurrences INT NOT NULL DEFAULT 0,
  positive_outcomes INT NOT NULL DEFAULT 0,
  negative_outcomes INT NOT NULL DEFAULT 0,
  impact_score NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0,
  last_recalculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT learning_signals_unique UNIQUE (organization_id, signal_type, signal_value),
  CONSTRAINT learning_signals_impact_cap CHECK (impact_score >= -20 AND impact_score <= 20),
  CONSTRAINT learning_signals_confidence_range CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_learning_signals_org_impact 
  ON public.learning_signals(organization_id, impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_signals_lookup 
  ON public.learning_signals(organization_id, signal_type, signal_value);

ALTER TABLE public.learning_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view learning signals"
ON public.learning_signals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = learning_signals.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.deleted_at IS NULL
  )
);

-- 1.2 outreach_performance
CREATE TABLE IF NOT EXISTS public.outreach_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'default',
  variant TEXT NOT NULL DEFAULT 'default',
  sent INT NOT NULL DEFAULT 0,
  delivered INT NOT NULL DEFAULT 0,
  opened INT NOT NULL DEFAULT 0,
  replied INT NOT NULL DEFAULT 0,
  meetings INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT outreach_performance_unique UNIQUE (organization_id, channel, template_type, variant),
  CONSTRAINT outreach_performance_channel_check CHECK (channel IN ('email','whatsapp','call','sms','linkedin'))
);

CREATE INDEX IF NOT EXISTS idx_outreach_performance_org_channel 
  ON public.outreach_performance(organization_id, channel);

ALTER TABLE public.outreach_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view outreach performance"
ON public.outreach_performance FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = outreach_performance.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.deleted_at IS NULL
  )
);

CREATE TRIGGER trg_outreach_performance_updated_at
  BEFORE UPDATE ON public.outreach_performance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.3 revenue_events: add prospect_id + indexes
ALTER TABLE public.revenue_events 
  ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_revenue_events_prospect 
  ON public.revenue_events(prospect_id) WHERE prospect_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revenue_events_org_type_created 
  ON public.revenue_events(organization_id, event_type, created_at DESC);

-- 1.4 enrichment_runs: persist learning_adjustment for auditing
ALTER TABLE public.enrichment_runs 
  ADD COLUMN IF NOT EXISTS learning_adjustment NUMERIC DEFAULT 0;

-- 1.5 helper RPC: idempotent increment for outreach_performance
CREATE OR REPLACE FUNCTION public.increment_outreach_metric(
  p_organization_id UUID,
  p_channel TEXT,
  p_template_type TEXT,
  p_variant TEXT,
  p_metric TEXT,
  p_amount INT DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_metric NOT IN ('sent','delivered','opened','replied','meetings','wins','losses') THEN
    RAISE EXCEPTION 'invalid metric: %', p_metric;
  END IF;

  INSERT INTO public.outreach_performance (
    organization_id, channel, template_type, variant, last_event_at
  ) VALUES (
    p_organization_id, p_channel, COALESCE(p_template_type,'default'), COALESCE(p_variant,'default'), now()
  )
  ON CONFLICT (organization_id, channel, template_type, variant) DO NOTHING;

  EXECUTE format(
    'UPDATE public.outreach_performance SET %I = %I + $1, last_event_at = now(), updated_at = now() 
     WHERE organization_id = $2 AND channel = $3 AND template_type = $4 AND variant = $5',
    p_metric, p_metric
  ) USING p_amount, p_organization_id, p_channel, COALESCE(p_template_type,'default'), COALESCE(p_variant,'default');
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_outreach_metric TO service_role, authenticated;