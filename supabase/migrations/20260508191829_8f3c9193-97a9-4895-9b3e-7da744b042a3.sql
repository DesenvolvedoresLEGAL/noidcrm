
CREATE TABLE IF NOT EXISTS public.proposal_dynamic_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  base_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'active',
  current_tier_id uuid,
  current_amount numeric,
  next_tier_id uuid,
  next_amount numeric,
  last_calculated_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_dynamic_pricing_rules_status_check
    CHECK (status IN ('draft','active','expired','disabled','requires_requote')),
  CONSTRAINT proposal_dynamic_pricing_rules_base_amount_check CHECK (base_amount >= 0),
  CONSTRAINT proposal_dynamic_pricing_rules_org_proposal_unique UNIQUE (organization_id, proposal_id)
);
CREATE INDEX IF NOT EXISTS idx_pdp_rules_org_proposal
  ON public.proposal_dynamic_pricing_rules (organization_id, proposal_id);

CREATE TABLE IF NOT EXISTS public.proposal_dynamic_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  pricing_rule_id uuid NOT NULL REFERENCES public.proposal_dynamic_pricing_rules(id) ON DELETE CASCADE,
  tier_order integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  adjustment_type text NOT NULL DEFAULT 'fixed_price',
  adjustment_value numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL DEFAULT 0,
  is_current boolean NOT NULL DEFAULT false,
  is_expired boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdp_tiers_adjustment_type_check
    CHECK (adjustment_type IN ('base_amount','fixed_price','percent_adjustment','fixed_adjustment')),
  CONSTRAINT pdp_tiers_final_amount_check CHECK (final_amount >= 0),
  CONSTRAINT pdp_tiers_date_check CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS idx_pdp_tiers_rule_order
  ON public.proposal_dynamic_pricing_tiers (pricing_rule_id, tier_order);
CREATE INDEX IF NOT EXISTS idx_pdp_tiers_org_proposal
  ON public.proposal_dynamic_pricing_tiers (organization_id, proposal_id);

CREATE TABLE IF NOT EXISTS public.proposal_dynamic_pricing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  pricing_rule_id uuid REFERENCES public.proposal_dynamic_pricing_rules(id) ON DELETE SET NULL,
  pricing_tier_id uuid REFERENCES public.proposal_dynamic_pricing_tiers(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  previous_amount numeric,
  new_amount numeric,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdp_events_type_check CHECK (event_type IN (
    'created','updated','tier_activated','tier_expired',
    'proposal_repriced','disabled','manual_override'
  ))
);
CREATE INDEX IF NOT EXISTS idx_pdp_events_proposal
  ON public.proposal_dynamic_pricing_events (proposal_id, created_at DESC);

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS dynamic_pricing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dynamic_pricing_current_amount numeric,
  ADD COLUMN IF NOT EXISTS dynamic_pricing_status text,
  ADD COLUMN IF NOT EXISTS dynamic_pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dynamic_pricing_last_calculated_at timestamptz;

CREATE TRIGGER trg_pdp_rules_updated_at
  BEFORE UPDATE ON public.proposal_dynamic_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pdp_tiers_updated_at
  BEFORE UPDATE ON public.proposal_dynamic_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pdp_tier_compute_final_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base numeric;
BEGIN
  SELECT base_amount INTO v_base FROM public.proposal_dynamic_pricing_rules WHERE id = NEW.pricing_rule_id;
  IF v_base IS NULL THEN v_base := 0; END IF;
  NEW.final_amount := CASE NEW.adjustment_type
    WHEN 'base_amount'        THEN v_base
    WHEN 'fixed_price'        THEN COALESCE(NEW.adjustment_value, 0)
    WHEN 'percent_adjustment' THEN GREATEST(0, v_base + (v_base * COALESCE(NEW.adjustment_value, 0) / 100))
    WHEN 'fixed_adjustment'   THEN GREATEST(0, v_base + COALESCE(NEW.adjustment_value, 0))
    ELSE COALESCE(NEW.final_amount, 0)
  END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pdp_tier_compute_final_amount
  BEFORE INSERT OR UPDATE ON public.proposal_dynamic_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.pdp_tier_compute_final_amount();

CREATE OR REPLACE FUNCTION public.pdp_tier_overlap_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conflict integer;
BEGIN
  IF NEW.starts_at IS NULL AND NEW.ends_at IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_conflict FROM public.proposal_dynamic_pricing_tiers t
    WHERE t.pricing_rule_id = NEW.pricing_rule_id
      AND t.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND tstzrange(COALESCE(t.starts_at, '-infinity'), COALESCE(t.ends_at, 'infinity'), '[]')
        && tstzrange(COALESCE(NEW.starts_at, '-infinity'), COALESCE(NEW.ends_at, 'infinity'), '[]');
  IF v_conflict > 0 THEN RAISE EXCEPTION 'Sobreposição de períodos com outra condição da mesma proposta'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pdp_tier_overlap_guard
  BEFORE INSERT OR UPDATE ON public.proposal_dynamic_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.pdp_tier_overlap_guard();

ALTER TABLE public.proposal_dynamic_pricing_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_dynamic_pricing_tiers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_dynamic_pricing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdp_rules_select_org" ON public.proposal_dynamic_pricing_rules
  FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "pdp_tiers_select_org" ON public.proposal_dynamic_pricing_tiers
  FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "pdp_events_select_org" ON public.proposal_dynamic_pricing_events
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "pdp_rules_insert" ON public.proposal_dynamic_pricing_rules
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id() AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'sales'::app_role)
    )
  );
CREATE POLICY "pdp_rules_update" ON public.proposal_dynamic_pricing_rules
  FOR UPDATE USING (
    organization_id = get_user_organization_id() AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'sales'::app_role)
    )
  );
CREATE POLICY "pdp_rules_delete" ON public.proposal_dynamic_pricing_rules
  FOR DELETE USING (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  );

CREATE POLICY "pdp_tiers_insert" ON public.proposal_dynamic_pricing_tiers
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id() AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'sales'::app_role)
    )
  );
CREATE POLICY "pdp_tiers_update" ON public.proposal_dynamic_pricing_tiers
  FOR UPDATE USING (
    organization_id = get_user_organization_id() AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'sales'::app_role)
    )
  );
CREATE POLICY "pdp_tiers_delete" ON public.proposal_dynamic_pricing_tiers
  FOR DELETE USING (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  );

CREATE POLICY "pdp_events_insert" ON public.proposal_dynamic_pricing_events
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE OR REPLACE FUNCTION public.calculate_proposal_dynamic_price(
  p_proposal_id uuid, p_reference_at timestamptz DEFAULT now()
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rule public.proposal_dynamic_pricing_rules%ROWTYPE;
  v_current public.proposal_dynamic_pricing_tiers%ROWTYPE;
  v_previous public.proposal_dynamic_pricing_tiers%ROWTYPE;
  v_next public.proposal_dynamic_pricing_tiers%ROWTYPE;
  v_last_end timestamptz;
  v_status text;
  v_message text;
BEGIN
  SELECT * INTO v_rule FROM public.proposal_dynamic_pricing_rules WHERE proposal_id = p_proposal_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('proposal_id', p_proposal_id, 'status', 'disabled', 'message', 'Tabela dinâmica não configurada');
  END IF;

  SELECT * INTO v_current FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id
      AND COALESCE(starts_at, '-infinity') <= p_reference_at
      AND COALESCE(ends_at,   'infinity')  >= p_reference_at
    ORDER BY tier_order ASC LIMIT 1;

  SELECT * INTO v_previous FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id AND ends_at IS NOT NULL AND ends_at < p_reference_at
    ORDER BY ends_at DESC LIMIT 1;

  SELECT * INTO v_next FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id AND starts_at IS NOT NULL AND starts_at > p_reference_at
    ORDER BY starts_at ASC LIMIT 1;

  SELECT MAX(ends_at) INTO v_last_end FROM public.proposal_dynamic_pricing_tiers WHERE pricing_rule_id = v_rule.id;

  IF v_current.id IS NOT NULL THEN
    v_status := 'active'; v_message := 'Condição vigente';
  ELSIF v_last_end IS NOT NULL AND p_reference_at > v_last_end THEN
    v_status := 'requires_requote'; v_message := 'Após prazo final - nova cotação necessária';
  ELSE
    v_status := COALESCE(v_rule.status, 'active'); v_message := 'Sem condição vigente no momento';
  END IF;

  UPDATE public.proposal_dynamic_pricing_rules
    SET current_tier_id = v_current.id,
        current_amount  = v_current.final_amount,
        next_tier_id    = v_next.id,
        next_amount     = v_next.final_amount,
        status          = CASE WHEN v_rule.enabled THEN v_status ELSE 'disabled' END,
        last_calculated_at = now()
    WHERE id = v_rule.id;

  UPDATE public.proposal_dynamic_pricing_tiers
    SET is_expired = (ends_at IS NOT NULL AND ends_at < p_reference_at),
        is_current = (id = v_current.id)
    WHERE pricing_rule_id = v_rule.id;

  IF v_current.id IS NOT NULL AND v_current.id IS DISTINCT FROM v_rule.current_tier_id THEN
    INSERT INTO public.proposal_dynamic_pricing_events
      (organization_id, proposal_id, pricing_rule_id, pricing_tier_id, event_type, previous_amount, new_amount, message)
    VALUES
      (v_rule.organization_id, p_proposal_id, v_rule.id, v_current.id, 'tier_activated',
       v_rule.current_amount, v_current.final_amount, 'Virada para condição: ' || v_current.label);
  END IF;

  RETURN jsonb_build_object(
    'proposal_id', p_proposal_id,
    'pricing_rule_id', v_rule.id,
    'base_amount', v_rule.base_amount,
    'currency', v_rule.currency,
    'enabled', v_rule.enabled,
    'status', CASE WHEN v_rule.enabled THEN v_status ELSE 'disabled' END,
    'message', v_message,
    'reference_at', p_reference_at,
    'current_tier_id', v_current.id,
    'current_label', v_current.label,
    'current_amount', v_current.final_amount,
    'current_starts_at', v_current.starts_at,
    'current_ends_at', v_current.ends_at,
    'previous_tier_id', v_previous.id,
    'previous_label', v_previous.label,
    'previous_amount', v_previous.final_amount,
    'next_tier_id', v_next.id,
    'next_label', v_next.label,
    'next_amount', v_next.final_amount,
    'next_starts_at', v_next.starts_at,
    'next_ends_at', v_next.ends_at,
    'last_end', v_last_end,
    'computed_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_dynamic_price_to_proposal(
  p_proposal_id uuid, p_reference_at timestamptz DEFAULT now()
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_snapshot jsonb;
  v_status text;
  v_amount numeric;
  v_org uuid;
  v_prev numeric;
BEGIN
  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, p_reference_at);
  v_status   := v_snapshot->>'status';
  v_amount   := NULLIF(v_snapshot->>'current_amount','')::numeric;

  SELECT organization_id, dynamic_pricing_current_amount
    INTO v_org, v_prev FROM public.proposals WHERE id = p_proposal_id;

  UPDATE public.proposals
    SET dynamic_pricing_enabled = true,
        dynamic_pricing_current_amount = v_amount,
        dynamic_pricing_status = v_status,
        dynamic_pricing_snapshot = v_snapshot,
        dynamic_pricing_last_calculated_at = now()
    WHERE id = p_proposal_id;

  INSERT INTO public.proposal_dynamic_pricing_events
    (organization_id, proposal_id, pricing_rule_id, pricing_tier_id, event_type,
     previous_amount, new_amount, message, metadata)
  VALUES
    (v_org, p_proposal_id,
     NULLIF(v_snapshot->>'pricing_rule_id','')::uuid,
     NULLIF(v_snapshot->>'current_tier_id','')::uuid,
     'proposal_repriced', v_prev, v_amount,
     'Snapshot dinâmico aplicado à proposta',
     jsonb_build_object('snapshot', v_snapshot));

  RETURN v_snapshot;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_proposal_dynamic_price(uuid, timestamptz) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.apply_dynamic_price_to_proposal(uuid, timestamptz) TO authenticated;
