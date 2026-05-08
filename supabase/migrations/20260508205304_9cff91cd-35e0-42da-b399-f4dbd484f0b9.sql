
-- 1) Coluna dynamic_pricing_mode em proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS dynamic_pricing_mode text;

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_dynamic_pricing_mode_chk;
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_dynamic_pricing_mode_chk CHECK (
    dynamic_pricing_mode IS NULL OR
    dynamic_pricing_mode IN ('none','automatic_by_valid_until','manual')
  );

-- Backfill: propostas com applicability=automatic recebem mode=automatic_by_valid_until
UPDATE public.proposals
   SET dynamic_pricing_mode = 'automatic_by_valid_until'
 WHERE dynamic_pricing_applicability = 'automatic'
   AND (dynamic_pricing_mode IS NULL OR dynamic_pricing_mode = 'none');

-- 2) Helper de elegibilidade
CREATE OR REPLACE FUNCTION public.can_auto_generate_dynamic_pricing(p_proposal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.proposals%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v.deleted_at IS NOT NULL THEN RETURN false; END IF;

  IF COALESCE(v.dynamic_pricing_applicability,'none') <> 'automatic' THEN
    RETURN false;
  END IF;

  IF COALESCE(v.dynamic_pricing_mode,'none') NOT IN ('automatic_by_valid_until') THEN
    RETURN false;
  END IF;

  IF v.expires_at IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(v.revenue_type,'') NOT IN ('one_time_event','one_time_non_event') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_auto_generate_dynamic_pricing(uuid)
  TO authenticated, anon;

-- 3) Reescrever generate_event_antecedence_pricing_for_proposal
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
  v_ref_date date;
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

  -- Elegibilidade: se não automático, não erro - apenas not_applicable
  IF COALESCE(v_proposal.dynamic_pricing_applicability,'none') <> 'automatic'
     OR COALESCE(v_proposal.dynamic_pricing_mode,'none') <> 'automatic_by_valid_until'
     OR COALESCE(v_proposal.revenue_type,'') NOT IN ('one_time_event','one_time_non_event') THEN
    RETURN jsonb_build_object(
      'status', 'not_applicable',
      'message', 'Tabela dinâmica não aplicável para este template'
    );
  END IF;

  -- Referência principal = validade da proposta (expires_at)
  -- Fallback: event_start_date da proposta ou da oportunidade
  IF v_proposal.expires_at IS NOT NULL THEN
    v_ref_date := v_proposal.expires_at::date;
  ELSIF v_proposal.event_start_date IS NOT NULL THEN
    v_ref_date := v_proposal.event_start_date;
  ELSIF v_proposal.opportunity_id IS NOT NULL THEN
    SELECT event_start_date INTO v_ref_date
      FROM public.opportunities WHERE id = v_proposal.opportunity_id;
  END IF;

  IF v_ref_date IS NULL THEN
    RETURN jsonb_build_object(
      'error','VALIDITY_MISSING',
      'message','Defina a validade da proposta para gerar a condição comercial automática.'
    );
  END IF;

  -- Base amount = total real da proposta (nunca o current_amount dinâmico)
  v_base := COALESCE(NULLIF(v_proposal.total_amount,0), v_proposal.value, 0);
  IF v_base <= 0 THEN
    -- fallback: somar itens
    SELECT COALESCE(SUM(total),0) INTO v_base
      FROM public.proposal_items WHERE proposal_id = p_proposal_id;
  END IF;

  IF v_base <= 0 THEN
    RETURN jsonb_build_object(
      'error','BASE_AMOUNT_MISSING',
      'message','Adicione itens com valor para gerar a condição comercial.'
    );
  END IF;

  -- Upsert rule (sempre event_antecedence internamente)
  SELECT * INTO v_existing FROM public.proposal_dynamic_pricing_rules WHERE proposal_id = p_proposal_id;
  IF v_existing.id IS NULL THEN
    INSERT INTO public.proposal_dynamic_pricing_rules
      (organization_id, proposal_id, enabled, base_amount, currency, status,
       pricing_mode, event_start_date, auto_generated, post_event_policy, created_by, updated_by)
    VALUES
      (v_org, p_proposal_id, true, v_base, COALESCE(v_proposal.currency,'BRL'), 'active',
       'event_antecedence', v_ref_date, true, 'surcharge', v_user, v_user)
    RETURNING id INTO v_rule_id;
    v_must_regen := true;

    INSERT INTO public.proposal_dynamic_pricing_events
      (organization_id, proposal_id, pricing_rule_id, event_type, message)
    VALUES
      (v_org, p_proposal_id, v_rule_id, 'created', 'Tabela dinâmica gerada automaticamente pela validade da proposta');
  ELSE
    v_rule_id := v_existing.id;
    IF v_existing.event_start_date IS DISTINCT FROM v_ref_date
       OR v_existing.base_amount IS DISTINCT FROM v_base
       OR v_existing.pricing_mode <> 'event_antecedence'
       OR NOT COALESCE(v_existing.auto_generated,false) THEN
      v_must_regen := true;
    END IF;

    UPDATE public.proposal_dynamic_pricing_rules
      SET pricing_mode = 'event_antecedence',
          event_start_date = v_ref_date,
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
        (v_org, p_proposal_id, v_rule_id, 'updated', 'Tabela dinâmica regenerada automaticamente');
    END IF;
  END IF;

  IF v_must_regen THEN
    DELETE FROM public.proposal_dynamic_pricing_tiers
      WHERE pricing_rule_id = v_rule_id AND auto_generated = true;

    FOR v_factor IN
      SELECT * FROM public.proposal_dynamic_pricing_factor_rules
      WHERE organization_id = v_org AND status = 'active'
      ORDER BY sort_order ASC
    LOOP
      IF v_factor.max_days_before_event = -1 THEN
        v_starts := (v_ref_date + INTERVAL '1 day')::timestamptz;
        v_ends := NULL;
      ELSIF v_factor.max_days_before_event IS NULL AND v_factor.min_days_before_event IS NOT NULL THEN
        v_starts := NULL;
        v_ends := (v_ref_date - v_factor.min_days_before_event * INTERVAL '1 day')::date::timestamptz
                  + INTERVAL '23 hours 59 minutes 59 seconds';
      ELSE
        v_starts := (v_ref_date - v_factor.max_days_before_event * INTERVAL '1 day')::date::timestamptz;
        v_ends := (v_ref_date - v_factor.min_days_before_event * INTERVAL '1 day')::date::timestamptz
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

  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, now());

  -- Atualiza proposta com snapshot vigente.
  -- IMPORTANTE: este UPDATE não deve disparar regeneração (trigger filtra os campos).
  UPDATE public.proposals
    SET dynamic_pricing_enabled = true,
        dynamic_pricing_current_amount = NULLIF(v_snapshot->>'current_amount','')::numeric,
        dynamic_pricing_status = COALESCE(v_snapshot->>'status', 'active'),
        dynamic_pricing_snapshot = v_snapshot,
        dynamic_pricing_last_calculated_at = now()
    WHERE id = p_proposal_id;

  v_days := (v_ref_date - CURRENT_DATE);

  RETURN jsonb_build_object(
    'proposal_id', p_proposal_id,
    'pricing_rule_id', v_rule_id,
    'base_amount', v_base,
    'reference_date', v_ref_date,
    'days_until_validity', v_days,
    'current_amount', v_snapshot->'current_amount',
    'current_label', v_snapshot->'current_label',
    'next_amount', v_snapshot->'next_amount',
    'next_label', v_snapshot->'next_label',
    'status', v_snapshot->'status',
    'snapshot', v_snapshot
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_event_antecedence_pricing_for_proposal(uuid, boolean)
  TO authenticated, anon;

-- 4) Trigger pós-update para regenerar automaticamente
CREATE OR REPLACE FUNCTION public.trg_proposal_auto_dynamic_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_relevant_changed boolean := false;
BEGIN
  -- Evitar recursão: não disparar quando apenas snapshot/current_amount mudam
  IF TG_OP = 'UPDATE' THEN
    v_relevant_changed :=
      (NEW.expires_at IS DISTINCT FROM OLD.expires_at) OR
      (NEW.total_amount IS DISTINCT FROM OLD.total_amount) OR
      (NEW.value IS DISTINCT FROM OLD.value) OR
      (NEW.dynamic_pricing_applicability IS DISTINCT FROM OLD.dynamic_pricing_applicability) OR
      (NEW.dynamic_pricing_mode IS DISTINCT FROM OLD.dynamic_pricing_mode) OR
      (NEW.revenue_type IS DISTINCT FROM OLD.revenue_type) OR
      (NEW.template_name IS DISTINCT FROM OLD.template_name) OR
      (NEW.event_start_date IS DISTINCT FROM OLD.event_start_date);
  ELSE
    v_relevant_changed := true;
  END IF;

  IF NOT v_relevant_changed THEN
    RETURN NEW;
  END IF;

  IF NOT public.can_auto_generate_dynamic_pricing(NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Dispara geração; ignora erros para não bloquear o save da proposta
  BEGIN
    PERFORM public.generate_event_antecedence_pricing_for_proposal(NEW.id, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Auto dynamic pricing failed for proposal %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_auto_dynamic_pricing ON public.proposals;
CREATE TRIGGER trg_proposal_auto_dynamic_pricing
  AFTER INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.trg_proposal_auto_dynamic_pricing();

-- 5) create_proposal_payment_intent: garantir geração antes de cobrar
CREATE OR REPLACE FUNCTION public.create_proposal_payment_intent(
  p_proposal_id uuid,
  p_source text default 'proposal_link'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_snapshot jsonb;
  v_status text;
  v_amount numeric;
  v_tier uuid;
  v_rule uuid;
  v_intent_id uuid;
  v_user uuid := auth.uid();
  v_proposal public.proposals%ROWTYPE;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF v_proposal.id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;
  v_org := v_proposal.organization_id;

  -- Se elegível e sem snapshot, gerar antes
  IF public.can_auto_generate_dynamic_pricing(p_proposal_id)
     AND (v_proposal.dynamic_pricing_current_amount IS NULL
          OR v_proposal.dynamic_pricing_current_amount <= 0) THEN
    PERFORM public.generate_event_antecedence_pricing_for_proposal(p_proposal_id, false);
  END IF;

  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, now());
  v_status := COALESCE(v_snapshot->>'status', 'disabled');

  IF v_status IN ('requires_requote','expired') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', v_status,
      'message', 'Pagamento bloqueado. Esta condição comercial exige nova cotação.'
    );
  END IF;

  v_amount := COALESCE((v_snapshot->>'current_amount')::numeric, 0);
  v_tier := NULLIF(v_snapshot->>'current_tier_id','')::uuid;
  v_rule := NULLIF(v_snapshot->>'pricing_rule_id','')::uuid;

  -- Fallback: proposta sem tabela dinâmica usa total_amount
  IF v_amount <= 0 AND v_status = 'disabled' THEN
    v_amount := COALESCE(NULLIF(v_proposal.total_amount,0), v_proposal.value, 0);
  END IF;

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Valor vigente indisponível');
  END IF;

  INSERT INTO public.proposal_payment_intents(
    organization_id, proposal_id, dynamic_pricing_rule_id, dynamic_pricing_tier_id,
    source, expected_amount, currency, status, payment_method,
    dynamic_pricing_snapshot, created_by, updated_by, expires_at
  ) VALUES (
    v_org, p_proposal_id, v_rule, v_tier,
    COALESCE(p_source,'proposal_link'), v_amount, COALESCE(v_snapshot->>'currency','BRL'),
    'pending', 'pix', v_snapshot, v_user, v_user,
    NULLIF(v_snapshot->>'current_ends_at','')::timestamptz
  ) RETURNING id INTO v_intent_id;

  UPDATE public.proposals
  SET latest_payment_intent_id = v_intent_id,
      payment_expected_amount = v_amount,
      payment_validation_status = COALESCE(payment_validation_status,'pending'),
      payment_snapshot = jsonb_build_object(
        'intent_id', v_intent_id,
        'expected_amount', v_amount,
        'tier_id', v_tier,
        'created_at', now()
      )
  WHERE id = p_proposal_id;

  INSERT INTO public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id, event_type,
    expected_amount, message, created_by
  ) VALUES (
    v_org, p_proposal_id, v_intent_id, 'payment_intent_created',
    v_amount, 'Intenção de pagamento criada pelo valor vigente', v_user
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payment_intent_id', v_intent_id,
    'proposal_id', p_proposal_id,
    'expected_amount', v_amount,
    'dynamic_pricing_tier_id', v_tier,
    'status', 'pending',
    'message', 'Cobrança gerada pelo valor vigente'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_proposal_payment_intent(uuid, text)
  TO authenticated, anon;
