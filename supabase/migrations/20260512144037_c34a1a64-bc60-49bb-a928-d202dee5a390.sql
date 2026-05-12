
-- PRICE UX 1.0.4: Data de referência comercial na tabela dinâmica

-- 1) proposal_payment_terms: novos campos
ALTER TABLE public.proposal_payment_terms
  ADD COLUMN IF NOT EXISTS dynamic_pricing_reference_type text NOT NULL DEFAULT 'current_date',
  ADD COLUMN IF NOT EXISTS dynamic_pricing_reference_date date,
  ADD COLUMN IF NOT EXISTS freeze_price_on_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_commercial_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_due_days integer;

ALTER TABLE public.proposal_payment_terms
  DROP CONSTRAINT IF EXISTS proposal_payment_terms_dyn_ref_type_check;
ALTER TABLE public.proposal_payment_terms
  ADD CONSTRAINT proposal_payment_terms_dyn_ref_type_check
  CHECK (dynamic_pricing_reference_type IN ('current_date','payment_due_date','custom_date','approval_date'));

-- Estende condições de pagamento aceitas (mantém compat com legado)
ALTER TABLE public.proposal_payment_terms
  DROP CONSTRAINT IF EXISTS proposal_payment_terms_payment_condition_check;
ALTER TABLE public.proposal_payment_terms
  ADD CONSTRAINT proposal_payment_terms_payment_condition_check
  CHECK (payment_condition IN (
    'upfront','split_50_50','split_30_70','installments','custom_schedule',
    'net_7','net_15','net_30','net_35','invoiced'
  ));

-- 2) proposals: snapshot de referência usada
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS dynamic_pricing_reference_type text,
  ADD COLUMN IF NOT EXISTS dynamic_pricing_reference_date timestamptz,
  ADD COLUMN IF NOT EXISTS price_frozen_on_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_frozen_at timestamptz;

-- 3) Helper: resolve_dynamic_pricing_reference_date
CREATE OR REPLACE FUNCTION public.resolve_dynamic_pricing_reference_date(p_proposal_id uuid)
RETURNS TABLE(reference_type text, reference_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_term public.proposal_payment_terms%ROWTYPE;
  v_type text;
  v_at timestamptz;
  v_due date;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    reference_type := 'current_date';
    reference_at := now();
    RETURN NEXT;
    RETURN;
  END IF;

  -- Se já está congelado pela aprovação, devolve o instante do congelamento
  IF COALESCE(v_proposal.price_frozen_on_approval,false) AND v_proposal.price_frozen_at IS NOT NULL THEN
    reference_type := COALESCE(v_proposal.dynamic_pricing_reference_type, 'approval_date');
    reference_at := v_proposal.price_frozen_at;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_term
    FROM public.proposal_payment_terms
   WHERE proposal_id = p_proposal_id AND payment_type = 'one_time'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_term.id IS NULL THEN
    reference_type := 'current_date';
    reference_at := now();
    RETURN NEXT;
    RETURN;
  END IF;

  -- Resolve tipo: explícito > derivado da condição
  v_type := COALESCE(NULLIF(v_term.dynamic_pricing_reference_type,''), 'current_date');
  IF v_type = 'current_date' THEN
    -- Defaults por condição quando não há override explícito vindo da UI
    v_type := CASE
      WHEN v_term.payment_condition = 'upfront' THEN 'current_date'
      WHEN v_term.payment_condition IN ('net_7','net_15','net_30','net_35','invoiced','installments','custom_schedule') THEN 'payment_due_date'
      WHEN v_term.payment_condition IN ('split_50_50','split_30_70')
        AND COALESCE(v_term.freeze_price_on_approval,false) THEN 'approval_date'
      ELSE v_type
    END;
  END IF;

  -- Resolve data
  IF v_type = 'current_date' THEN
    v_at := now();
  ELSIF v_type = 'custom_date' THEN
    v_at := COALESCE(v_term.dynamic_pricing_reference_date::timestamptz, now());
  ELSIF v_type = 'approval_date' THEN
    v_at := COALESCE(v_proposal.accepted_at, v_proposal.price_frozen_at, now());
  ELSIF v_type = 'payment_due_date' THEN
    -- Prioridade:
    -- 1) first_payment_date / first_installment_date
    -- 2) entry_date + payment_due_days
    -- 3) hoje + payment_due_days (deriva de net_X se vazio)
    v_due := COALESCE(
      v_term.first_payment_date,
      v_term.first_installment_date,
      v_term.second_payment_due_date,
      v_term.entry_date
    );
    IF v_due IS NULL THEN
      DECLARE
        v_days int;
      BEGIN
        v_days := COALESCE(v_term.payment_due_days,
          CASE v_term.payment_condition
            WHEN 'net_7' THEN 7
            WHEN 'net_15' THEN 15
            WHEN 'net_30' THEN 30
            WHEN 'net_35' THEN 35
            WHEN 'invoiced' THEN 30
            ELSE 0
          END);
        v_due := (CURRENT_DATE + (v_days * INTERVAL '1 day'))::date;
      END;
    END IF;
    v_at := (v_due::timestamptz + INTERVAL '12 hours');
  ELSE
    v_at := now();
  END IF;

  reference_type := v_type;
  reference_at := COALESCE(v_at, now());
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dynamic_pricing_reference_date(uuid) TO authenticated, anon;

-- 4) apply_dynamic_price_to_proposal: se p_reference_at vier null, resolve via helper
CREATE OR REPLACE FUNCTION public.apply_dynamic_price_to_proposal(
  p_proposal_id uuid,
  p_reference_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot jsonb;
  v_amount numeric;
  v_org uuid;
  v_opp uuid;
  v_rule_id uuid;
  v_ref_type text;
  v_ref_at timestamptz;
  v_term public.proposal_payment_terms%ROWTYPE;
  v_proposal public.proposals%ROWTYPE;
  v_freeze boolean := false;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','PROPOSAL_NOT_FOUND');
  END IF;

  -- Se preço congelado, não recalcular
  IF COALESCE(v_proposal.price_frozen_on_approval,false) THEN
    RETURN jsonb_build_object(
      'status','frozen',
      'message','Preço congelado na aprovação',
      'current_amount', v_proposal.dynamic_pricing_current_amount,
      'reference_type', v_proposal.dynamic_pricing_reference_type,
      'reference_date', v_proposal.dynamic_pricing_reference_date
    );
  END IF;

  IF p_reference_at IS NULL THEN
    SELECT reference_type, reference_at INTO v_ref_type, v_ref_at
      FROM public.resolve_dynamic_pricing_reference_date(p_proposal_id);
  ELSE
    v_ref_at := p_reference_at;
    v_ref_type := 'current_date';
  END IF;

  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, v_ref_at);
  v_snapshot := v_snapshot
    || jsonb_build_object(
      'reference_type', v_ref_type,
      'reference_date', v_ref_at
    );
  v_amount := NULLIF(v_snapshot->>'current_amount','')::numeric;

  IF v_amount IS NULL THEN
    RETURN v_snapshot;
  END IF;

  -- Verifica freeze on approval
  SELECT * INTO v_term FROM public.proposal_payment_terms
    WHERE proposal_id = p_proposal_id AND payment_type='one_time'
    ORDER BY created_at ASC LIMIT 1;
  v_freeze := COALESCE(v_term.freeze_price_on_approval,false)
              AND v_term.payment_condition IN ('split_50_50','split_30_70')
              AND v_proposal.status IN ('accepted','approved')
              AND NOT COALESCE(v_proposal.price_frozen_on_approval,false);

  UPDATE public.proposals
    SET dynamic_pricing_enabled = true,
        dynamic_pricing_current_amount = v_amount,
        dynamic_pricing_status = COALESCE(v_snapshot->>'status','active'),
        dynamic_pricing_snapshot = v_snapshot,
        dynamic_pricing_last_calculated_at = now(),
        dynamic_pricing_reference_type = v_ref_type,
        dynamic_pricing_reference_date = v_ref_at,
        price_frozen_on_approval = CASE WHEN v_freeze THEN true ELSE price_frozen_on_approval END,
        price_frozen_at = CASE WHEN v_freeze THEN now() ELSE price_frozen_at END,
        payment_expected_amount = v_amount
    WHERE id = p_proposal_id
    RETURNING organization_id, opportunity_id INTO v_org, v_opp;

  IF v_opp IS NOT NULL THEN
    UPDATE public.opportunities SET valor_previsto = v_amount WHERE id = v_opp;
  END IF;

  v_rule_id := NULLIF(v_snapshot->>'pricing_rule_id','')::uuid;
  IF v_rule_id IS NOT NULL THEN
    INSERT INTO public.proposal_dynamic_pricing_events
      (organization_id, proposal_id, pricing_rule_id, event_type, new_amount, message, metadata)
    VALUES (v_org, p_proposal_id, v_rule_id, 'proposal_repriced', v_amount,
            'Valor vigente aplicado à proposta',
            jsonb_build_object('reference_type', v_ref_type, 'reference_date', v_ref_at,
                               'price_frozen', v_freeze));
  END IF;

  RETURN v_snapshot;
END;
$function$;

-- 5) calculate_proposal_dynamic_price: resolver default null
CREATE OR REPLACE FUNCTION public.calculate_proposal_dynamic_price(
  p_proposal_id uuid,
  p_reference_at timestamp with time zone DEFAULT NULL
)
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
  v_ref_type text;
  v_ref_at timestamptz;
BEGIN
  IF p_reference_at IS NULL THEN
    SELECT reference_type, reference_at INTO v_ref_type, v_ref_at
      FROM public.resolve_dynamic_pricing_reference_date(p_proposal_id);
  ELSE
    v_ref_at := p_reference_at;
    v_ref_type := 'current_date';
  END IF;

  SELECT * INTO v_rule FROM public.proposal_dynamic_pricing_rules WHERE proposal_id = p_proposal_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'proposal_id', p_proposal_id,
      'status', 'disabled',
      'message', 'Tabela dinâmica não configurada',
      'reference_type', v_ref_type,
      'reference_date', v_ref_at
    );
  END IF;

  SELECT * INTO v_current FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id
      AND COALESCE(starts_at, '-infinity'::timestamptz) <= v_ref_at
      AND COALESCE(ends_at,   'infinity'::timestamptz)  >= v_ref_at
    ORDER BY tier_order ASC LIMIT 1;

  SELECT * INTO v_previous FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id AND ends_at IS NOT NULL AND ends_at < v_ref_at
    ORDER BY ends_at DESC LIMIT 1;

  SELECT * INTO v_next FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id AND starts_at IS NOT NULL AND starts_at > v_ref_at
    ORDER BY starts_at ASC LIMIT 1;

  SELECT MAX(ends_at) INTO v_last_end FROM public.proposal_dynamic_pricing_tiers
    WHERE pricing_rule_id = v_rule.id AND ends_at IS NOT NULL;

  IF v_rule.pricing_mode = 'event_antecedence' AND v_rule.event_start_date IS NOT NULL
     AND v_ref_at::date > v_rule.event_start_date THEN
    v_post_event := true;
  END IF;

  IF v_post_event AND v_rule.post_event_policy = 'requires_requote' THEN
    v_status := 'requires_requote'; v_message := 'Pós evento - nova cotação necessária';
  ELSIF v_post_event AND v_rule.post_event_policy = 'block_payment' THEN
    v_status := 'requires_requote'; v_message := 'Pós evento - pagamento bloqueado';
  ELSIF v_current.id IS NOT NULL THEN
    v_status := 'active'; v_message := 'Condição vigente';
  ELSIF v_last_end IS NOT NULL AND v_ref_at > v_last_end THEN
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
    SET is_expired = (ends_at IS NOT NULL AND ends_at < v_ref_at),
        is_current = (id = v_current.id)
    WHERE pricing_rule_id = v_rule.id;

  RETURN jsonb_build_object(
    'proposal_id', p_proposal_id,
    'pricing_rule_id', v_rule.id,
    'enabled', v_rule.enabled,
    'pricing_mode', v_rule.pricing_mode,
    'event_start_date', v_rule.event_start_date,
    'base_amount', v_rule.base_amount,
    'currency', v_rule.currency,
    'status', CASE WHEN v_rule.enabled THEN v_status ELSE 'disabled' END,
    'message', v_message,
    'reference_at', v_ref_at,
    'reference_type', v_ref_type,
    'reference_date', v_ref_at,
    'current_tier_id', v_current.id,
    'current_label', v_current.label,
    'current_amount', v_current.final_amount,
    'current_starts_at', v_current.starts_at,
    'current_ends_at', v_current.ends_at,
    'current_adjustment_type', v_current.adjustment_type,
    'current_adjustment_value', v_current.adjustment_value,
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

-- 6) create_proposal_payment_intent: usar referência resolvida
CREATE OR REPLACE FUNCTION public.create_proposal_payment_intent(
  p_proposal_id uuid,
  p_source text DEFAULT 'proposal_link'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_ref_type text;
  v_ref_at timestamptz;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF v_proposal.id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;
  v_org := v_proposal.organization_id;

  IF public.can_auto_generate_dynamic_pricing(p_proposal_id)
     AND (v_proposal.dynamic_pricing_current_amount IS NULL
          OR v_proposal.dynamic_pricing_current_amount <= 0) THEN
    PERFORM public.generate_event_antecedence_pricing_for_proposal(p_proposal_id, false);
  END IF;

  -- Resolve a data de referência da condição financeira
  SELECT reference_type, reference_at INTO v_ref_type, v_ref_at
    FROM public.resolve_dynamic_pricing_reference_date(p_proposal_id);

  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, v_ref_at);
  v_status := COALESCE(v_snapshot->>'status', 'disabled');

  IF v_status IN ('requires_requote','expired') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', v_status,
      'reference_type', v_ref_type,
      'reference_date', v_ref_at,
      'message', 'Pagamento bloqueado. Esta condição comercial exige nova cotação.'
    );
  END IF;

  v_amount := COALESCE((v_snapshot->>'current_amount')::numeric, 0);
  v_tier := NULLIF(v_snapshot->>'current_tier_id','')::uuid;
  v_rule := NULLIF(v_snapshot->>'pricing_rule_id','')::uuid;

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
    'pending', 'pix',
    v_snapshot || jsonb_build_object('reference_type', v_ref_type, 'reference_date', v_ref_at),
    v_user, v_user,
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
        'reference_type', v_ref_type,
        'reference_date', v_ref_at,
        'created_at', now()
      )
  WHERE id = p_proposal_id;

  INSERT INTO public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id, event_type,
    expected_amount, message, created_by
  ) VALUES (
    v_org, p_proposal_id, v_intent_id, 'payment_intent_created',
    v_amount, 'Intenção de pagamento criada pelo valor vigente ('||v_ref_type||')', v_user
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payment_intent_id', v_intent_id,
    'proposal_id', p_proposal_id,
    'expected_amount', v_amount,
    'dynamic_pricing_tier_id', v_tier,
    'reference_type', v_ref_type,
    'reference_date', v_ref_at,
    'status', 'pending',
    'message', 'Cobrança gerada pelo valor vigente'
  );
END;
$function$;
