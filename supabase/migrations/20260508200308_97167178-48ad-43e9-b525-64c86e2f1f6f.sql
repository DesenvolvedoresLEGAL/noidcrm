
-- 1. Permitir percent_adjustment negativo (-10% caso 30+ dias)
ALTER TABLE public.proposal_dynamic_pricing_tiers
  DROP CONSTRAINT IF EXISTS pdp_tiers_adjustment_type_check;
ALTER TABLE public.proposal_dynamic_pricing_tiers
  ADD CONSTRAINT pdp_tiers_adjustment_type_check
  CHECK (adjustment_type = ANY (ARRAY['base_amount','fixed_price','percent_adjustment','fixed_adjustment']));

-- Allow auto_generated tracking on tiers
ALTER TABLE public.proposal_dynamic_pricing_tiers
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;

-- 2. Estender rules com modo automático
ALTER TABLE public.proposal_dynamic_pricing_rules
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS event_start_date date,
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_expired_tiers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS post_event_policy text NOT NULL DEFAULT 'surcharge';

ALTER TABLE public.proposal_dynamic_pricing_rules
  DROP CONSTRAINT IF EXISTS pdp_rules_pricing_mode_check;
ALTER TABLE public.proposal_dynamic_pricing_rules
  ADD CONSTRAINT pdp_rules_pricing_mode_check
  CHECK (pricing_mode IN ('manual','event_antecedence'));

ALTER TABLE public.proposal_dynamic_pricing_rules
  DROP CONSTRAINT IF EXISTS pdp_rules_post_event_policy_check;
ALTER TABLE public.proposal_dynamic_pricing_rules
  ADD CONSTRAINT pdp_rules_post_event_policy_check
  CHECK (post_event_policy IN ('surcharge','requires_requote','block_payment'));

-- 3. Adicionar event_start_date em propostas e oportunidades
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS event_start_date date;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS event_start_date date;

-- 4. Tabela de faixas configuráveis por organização
CREATE TABLE IF NOT EXISTS public.proposal_dynamic_pricing_factor_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  min_days_before_event integer,
  max_days_before_event integer,
  adjustment_type text NOT NULL DEFAULT 'percent',
  adjustment_value numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdp_factor_adjustment_type_check CHECK (adjustment_type IN ('percent','fixed')),
  CONSTRAINT pdp_factor_status_check CHECK (status IN ('active','inactive'))
);

CREATE INDEX IF NOT EXISTS idx_pdp_factor_rules_org ON public.proposal_dynamic_pricing_factor_rules(organization_id, sort_order);

ALTER TABLE public.proposal_dynamic_pricing_factor_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdp_factor_rules_select ON public.proposal_dynamic_pricing_factor_rules;
CREATE POLICY pdp_factor_rules_select ON public.proposal_dynamic_pricing_factor_rules
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS pdp_factor_rules_insert ON public.proposal_dynamic_pricing_factor_rules;
CREATE POLICY pdp_factor_rules_insert ON public.proposal_dynamic_pricing_factor_rules
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  );

DROP POLICY IF EXISTS pdp_factor_rules_update ON public.proposal_dynamic_pricing_factor_rules;
CREATE POLICY pdp_factor_rules_update ON public.proposal_dynamic_pricing_factor_rules
  FOR UPDATE USING (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  );

DROP TRIGGER IF EXISTS trg_pdp_factor_rules_updated_at ON public.proposal_dynamic_pricing_factor_rules;
CREATE TRIGGER trg_pdp_factor_rules_updated_at
  BEFORE UPDATE ON public.proposal_dynamic_pricing_factor_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Seed function
CREATE OR REPLACE FUNCTION public.seed_default_pricing_factor_rules(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.proposal_dynamic_pricing_factor_rules WHERE organization_id = p_org_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.proposal_dynamic_pricing_factor_rules
    (organization_id, name, label, min_days_before_event, max_days_before_event, adjustment_type, adjustment_value, sort_order)
  VALUES
    (p_org_id, '30+ dias',     '30 dias ou mais antes do evento', 30,   NULL, 'percent', -10, 1),
    (p_org_id, '21-29 dias',   '21 a 29 dias antes do evento',    21,   29,   'percent',   0, 2),
    (p_org_id, '10-20 dias',   '10 a 20 dias antes do evento',    10,   20,   'percent',  10, 3),
    (p_org_id, '4-9 dias',     '4 a 9 dias antes do evento',       4,    9,   'percent',  20, 4),
    (p_org_id, '0-3 dias',     '0 a 3 dias antes do evento',       0,    3,   'percent',  30, 5),
    (p_org_id, 'Pós evento',   'Após o início do evento',        NULL,  -1,   'percent',  50, 6);
END;
$$;

-- 6. Backfill existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_pricing_factor_rules(r.id);
  END LOOP;
END$$;

-- 7. Trigger para novas organizações
CREATE OR REPLACE FUNCTION public.trg_seed_pricing_factor_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_pricing_factor_rules(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_pdp_factor_rules ON public.organizations;
CREATE TRIGGER trg_seed_pdp_factor_rules
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_pricing_factor_rules();

-- 8. RPC principal
CREATE OR REPLACE FUNCTION public.generate_event_antecedence_pricing_for_proposal(
  p_proposal_id uuid,
  p_force_regenerate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_event_date date;
  v_org uuid;
  v_base numeric;
  v_rule_id uuid;
  v_existing public.proposal_dynamic_pricing_rules%ROWTYPE;
  v_user uuid := auth.uid();
  v_factor record;
  v_starts timestamptz;
  v_ends timestamptz;
  v_final numeric;
  v_must_regen boolean := p_force_regenerate;
  v_snapshot jsonb;
  v_days int;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PROPOSAL_NOT_FOUND');
  END IF;

  v_org := v_proposal.organization_id;

  -- Resolve event_start_date proposta -> oportunidade
  v_event_date := v_proposal.event_start_date;
  IF v_event_date IS NULL AND v_proposal.opportunity_id IS NOT NULL THEN
    SELECT event_start_date INTO v_event_date FROM public.opportunities WHERE id = v_proposal.opportunity_id;
  END IF;

  IF v_event_date IS NULL THEN
    RETURN jsonb_build_object('error', 'EVENT_DATE_MISSING', 'message', 'Proposta/oportunidade sem data de início do evento');
  END IF;

  -- valid_until = event_start_date (mapeado em expires_at)
  UPDATE public.proposals
    SET expires_at = (v_event_date::timestamptz),
        event_start_date = v_event_date
    WHERE id = p_proposal_id;

  v_base := COALESCE(v_proposal.total_amount, 0);

  -- Upsert rule
  SELECT * INTO v_existing FROM public.proposal_dynamic_pricing_rules WHERE proposal_id = p_proposal_id;
  IF v_existing.id IS NULL THEN
    INSERT INTO public.proposal_dynamic_pricing_rules
      (organization_id, proposal_id, enabled, base_amount, currency, status,
       pricing_mode, event_start_date, auto_generated, post_event_policy, created_by, updated_by)
    VALUES
      (v_org, p_proposal_id, true, v_base, COALESCE(v_proposal.currency,'BRL'), 'active',
       'event_antecedence', v_event_date, true, 'surcharge', v_user, v_user)
    RETURNING id INTO v_rule_id;
    v_must_regen := true;

    INSERT INTO public.proposal_dynamic_pricing_events
      (organization_id, proposal_id, pricing_rule_id, event_type, message)
    VALUES
      (v_org, p_proposal_id, v_rule_id, 'created', 'Tabela dinâmica automática criada por antecedência do evento');
  ELSE
    v_rule_id := v_existing.id;
    IF v_existing.event_start_date IS DISTINCT FROM v_event_date
       OR v_existing.base_amount IS DISTINCT FROM v_base
       OR v_existing.pricing_mode <> 'event_antecedence' THEN
      v_must_regen := true;
    END IF;
    UPDATE public.proposal_dynamic_pricing_rules
      SET pricing_mode = 'event_antecedence',
          event_start_date = v_event_date,
          auto_generated = true,
          enabled = true,
          status = 'active',
          base_amount = v_base,
          currency = COALESCE(v_proposal.currency, currency),
          updated_by = v_user
      WHERE id = v_rule_id;

    IF v_must_regen THEN
      INSERT INTO public.proposal_dynamic_pricing_events
        (organization_id, proposal_id, pricing_rule_id, event_type, message)
      VALUES
        (v_org, p_proposal_id, v_rule_id, 'updated', 'Regeneração automática da tabela dinâmica');
    END IF;
  END IF;

  -- Limpar tiers gerados automaticamente
  IF v_must_regen THEN
    DELETE FROM public.proposal_dynamic_pricing_tiers
      WHERE pricing_rule_id = v_rule_id AND auto_generated = true;

    -- Gerar tiers a partir das factor rules ativas
    FOR v_factor IN
      SELECT * FROM public.proposal_dynamic_pricing_factor_rules
      WHERE organization_id = v_org AND status = 'active'
      ORDER BY sort_order ASC
    LOOP
      -- Janelas baseadas em event_start_date (date) -> timestamptz
      IF v_factor.max_days_before_event = -1 THEN
        -- pós evento
        v_starts := (v_event_date + INTERVAL '1 day')::timestamptz;
        v_ends := NULL;
      ELSIF v_factor.max_days_before_event IS NULL AND v_factor.min_days_before_event IS NOT NULL THEN
        -- 30+ dias: até event - 30d 23:59:59
        v_starts := NULL;
        v_ends := (v_event_date - v_factor.min_days_before_event * INTERVAL '1 day')::date::timestamptz
                  + INTERVAL '23 hours 59 minutes 59 seconds';
      ELSE
        v_starts := (v_event_date - v_factor.max_days_before_event * INTERVAL '1 day')::date::timestamptz;
        v_ends := (v_event_date - v_factor.min_days_before_event * INTERVAL '1 day')::date::timestamptz
                  + INTERVAL '23 hours 59 minutes 59 seconds';
      END IF;

      IF v_factor.adjustment_type = 'percent' THEN
        v_final := GREATEST(0, v_base + (v_base * v_factor.adjustment_value / 100));
      ELSE
        v_final := GREATEST(0, v_base + v_factor.adjustment_value);
      END IF;

      INSERT INTO public.proposal_dynamic_pricing_tiers
        (organization_id, proposal_id, pricing_rule_id, tier_order, label,
         starts_at, ends_at, adjustment_type, adjustment_value, final_amount, auto_generated)
      VALUES
        (v_org, p_proposal_id, v_rule_id, v_factor.sort_order, v_factor.label,
         v_starts, v_ends,
         CASE WHEN v_factor.adjustment_type='percent' THEN 'percent_adjustment' ELSE 'fixed_adjustment' END,
         v_factor.adjustment_value, v_final, true);
    END LOOP;
  END IF;

  -- Calcular snapshot
  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, now());

  -- Atualizar proposta
  UPDATE public.proposals
    SET dynamic_pricing_enabled = true,
        dynamic_pricing_current_amount = (v_snapshot->>'current_amount')::numeric,
        dynamic_pricing_status = COALESCE(v_snapshot->>'status', 'active'),
        dynamic_pricing_snapshot = v_snapshot,
        dynamic_pricing_last_calculated_at = now()
    WHERE id = p_proposal_id;

  v_days := (v_event_date - CURRENT_DATE);

  RETURN jsonb_build_object(
    'proposal_id', p_proposal_id,
    'pricing_rule_id', v_rule_id,
    'base_amount', v_base,
    'event_start_date', v_event_date,
    'current_days_before_event', v_days,
    'current_amount', v_snapshot->'current_amount',
    'current_factor', v_snapshot->'current_label',
    'current_label', v_snapshot->'current_label',
    'next_amount', v_snapshot->'next_amount',
    'next_label', v_snapshot->'next_label',
    'status', v_snapshot->'status',
    'message', v_snapshot->'message',
    'snapshot', v_snapshot
  );
END;
$$;

-- 9. Atualizar calculate para honrar post_event_policy
CREATE OR REPLACE FUNCTION public.calculate_proposal_dynamic_price(p_proposal_id uuid, p_reference_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule public.proposal_dynamic_pricing_rules%ROWTYPE;
  v_current public.proposal_dynamic_pricing_tiers%ROWTYPE;
  v_previous public.proposal_dynamic_pricing_tiers%ROWTYPE;
  v_next public.proposal_dynamic_pricing_tiers%ROWTYPE;
  v_last_end timestamptz;
  v_status text;
  v_message text;
  v_post_event boolean := false;
BEGIN
  SELECT * INTO v_rule FROM public.proposal_dynamic_pricing_rules WHERE proposal_id = p_proposal_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('proposal_id', p_proposal_id, 'status', 'disabled', 'message', 'Tabela dinâmica não configurada');
  END IF;

  SELECT * INTO v_current FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id
      AND COALESCE(starts_at, '-infinity'::timestamptz) <= p_reference_at
      AND COALESCE(ends_at,   'infinity'::timestamptz)  >= p_reference_at
    ORDER BY tier_order ASC LIMIT 1;

  SELECT * INTO v_previous FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id AND ends_at IS NOT NULL AND ends_at < p_reference_at
    ORDER BY ends_at DESC LIMIT 1;

  SELECT * INTO v_next FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id AND starts_at IS NOT NULL AND starts_at > p_reference_at
    ORDER BY starts_at ASC LIMIT 1;

  SELECT MAX(ends_at) INTO v_last_end FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id AND ends_at IS NOT NULL;

  -- Detectar pós evento (modo automático)
  IF v_rule.pricing_mode = 'event_antecedence' AND v_rule.event_start_date IS NOT NULL
     AND p_reference_at::date > v_rule.event_start_date THEN
    v_post_event := true;
  END IF;

  IF v_post_event AND v_rule.post_event_policy = 'requires_requote' THEN
    v_status := 'requires_requote'; v_message := 'Pós evento - nova cotação necessária';
  ELSIF v_post_event AND v_rule.post_event_policy = 'block_payment' THEN
    v_status := 'requires_requote'; v_message := 'Pós evento - pagamento bloqueado';
  ELSIF v_current.id IS NOT NULL THEN
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
    'pricing_mode', v_rule.pricing_mode,
    'event_start_date', v_rule.event_start_date,
    'post_event_policy', v_rule.post_event_policy,
    'base_amount', v_rule.base_amount,
    'currency', v_rule.currency,
    'enabled', v_rule.enabled,
    'auto_generated', v_rule.auto_generated,
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
$function$;

-- 10. apply_dynamic_price_to_proposal: usar dynamic_pricing_current_amount
CREATE OR REPLACE FUNCTION public.apply_dynamic_price_to_proposal(p_proposal_id uuid, p_reference_at timestamp with time zone DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_amount numeric;
  v_org uuid;
  v_rule_id uuid;
BEGIN
  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, p_reference_at);
  v_amount := NULLIF(v_snapshot->>'current_amount','')::numeric;

  IF v_amount IS NULL THEN
    RETURN v_snapshot;
  END IF;

  UPDATE public.proposals
    SET total_amount = v_amount,
        dynamic_pricing_enabled = true,
        dynamic_pricing_current_amount = v_amount,
        dynamic_pricing_status = COALESCE(v_snapshot->>'status','active'),
        dynamic_pricing_snapshot = v_snapshot,
        dynamic_pricing_last_calculated_at = now()
    WHERE id = p_proposal_id
    RETURNING organization_id INTO v_org;

  v_rule_id := NULLIF(v_snapshot->>'pricing_rule_id','')::uuid;

  IF v_rule_id IS NOT NULL THEN
    INSERT INTO public.proposal_dynamic_pricing_events
      (organization_id, proposal_id, pricing_rule_id, event_type, new_amount, message)
    VALUES (v_org, p_proposal_id, v_rule_id, 'proposal_repriced', v_amount,
            'Valor vigente aplicado à proposta');
  END IF;

  RETURN v_snapshot;
END;
$$;
