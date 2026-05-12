-- 1) apply_dynamic_price_to_proposal: aplicar desconto manual antes de gravar payment_expected_amount/valor_previsto
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
  v_net numeric;
  v_discount_pct numeric := 0;
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

  SELECT * INTO v_term FROM public.proposal_payment_terms
    WHERE proposal_id = p_proposal_id AND payment_type='one_time'
    ORDER BY created_at ASC LIMIT 1;
  v_freeze := COALESCE(v_term.freeze_price_on_approval,false)
              AND v_term.payment_condition IN ('split_50_50','split_30_70')
              AND v_proposal.status IN ('accepted','approved')
              AND NOT COALESCE(v_proposal.price_frozen_on_approval,false);

  -- Desconto manual MAX entre todos os one_time
  SELECT COALESCE(MAX(COALESCE(discount_percent,0)),0)
    INTO v_discount_pct
    FROM public.proposal_payment_terms
    WHERE proposal_id = p_proposal_id AND payment_type='one_time';
  v_discount_pct := LEAST(GREATEST(COALESCE(v_discount_pct,0),0),100);
  v_net := v_amount * (1 - v_discount_pct / 100.0);

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
        payment_expected_amount = v_net
    WHERE id = p_proposal_id
    RETURNING organization_id, opportunity_id INTO v_org, v_opp;

  IF v_opp IS NOT NULL THEN
    UPDATE public.opportunities SET valor_previsto = v_net WHERE id = v_opp;
  END IF;

  v_rule_id := NULLIF(v_snapshot->>'pricing_rule_id','')::uuid;
  IF v_rule_id IS NOT NULL THEN
    INSERT INTO public.proposal_dynamic_pricing_events
      (organization_id, proposal_id, pricing_rule_id, event_type, new_amount, message, metadata)
    VALUES (v_org, p_proposal_id, v_rule_id, 'proposal_repriced', v_net,
            'Valor vigente líquido aplicado à proposta',
            jsonb_build_object('reference_type', v_ref_type, 'reference_date', v_ref_at,
                               'price_frozen', v_freeze,
                               'gross_amount', v_amount,
                               'discount_percent', v_discount_pct));
  END IF;

  RETURN v_snapshot || jsonb_build_object('net_amount', v_net, 'discount_percent', v_discount_pct);
END;
$function$;

-- 2) create_proposal_payment_intent: cobrar valor líquido (com desconto manual)
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
  v_net numeric;
  v_discount_pct numeric := 0;
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

  -- Aplica desconto manual MAX entre os one_time
  SELECT COALESCE(MAX(COALESCE(discount_percent,0)),0)
    INTO v_discount_pct
    FROM public.proposal_payment_terms
    WHERE proposal_id = p_proposal_id AND payment_type='one_time';
  v_discount_pct := LEAST(GREATEST(COALESCE(v_discount_pct,0),0),100);
  v_net := v_amount * (1 - v_discount_pct / 100.0);

  INSERT INTO public.proposal_payment_intents(
    organization_id, proposal_id, dynamic_pricing_rule_id, dynamic_pricing_tier_id,
    source, expected_amount, currency, status, payment_method,
    dynamic_pricing_snapshot, created_by, updated_by, expires_at
  ) VALUES (
    v_org, p_proposal_id, v_rule, v_tier,
    COALESCE(p_source,'proposal_link'), v_net, COALESCE(v_snapshot->>'currency','BRL'),
    'pending', 'pix',
    v_snapshot || jsonb_build_object(
      'reference_type', v_ref_type,
      'reference_date', v_ref_at,
      'gross_amount', v_amount,
      'discount_percent', v_discount_pct,
      'net_amount', v_net
    ),
    v_user, v_user,
    NULLIF(v_snapshot->>'current_ends_at','')::timestamptz
  ) RETURNING id INTO v_intent_id;

  UPDATE public.proposals
  SET latest_payment_intent_id = v_intent_id,
      payment_expected_amount = v_net,
      payment_validation_status = COALESCE(payment_validation_status,'pending'),
      payment_snapshot = jsonb_build_object(
        'intent_id', v_intent_id,
        'expected_amount', v_net,
        'gross_amount', v_amount,
        'discount_percent', v_discount_pct,
        'tier_id', v_tier,
        'reference_type', v_ref_type,
        'reference_date', v_ref_at,
        'created_at', now()
      )
  WHERE id = p_proposal_id;

  -- Sincroniza valor da oportunidade com o líquido
  IF v_proposal.opportunity_id IS NOT NULL THEN
    UPDATE public.opportunities SET valor_previsto = v_net WHERE id = v_proposal.opportunity_id;
  END IF;

  INSERT INTO public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id, event_type,
    expected_amount, message, created_by
  ) VALUES (
    v_org, p_proposal_id, v_intent_id, 'payment_intent_created',
    v_net, 'Intenção de pagamento criada pelo valor líquido vigente ('||v_ref_type||')', v_user
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payment_intent_id', v_intent_id,
    'proposal_id', p_proposal_id,
    'expected_amount', v_net,
    'gross_amount', v_amount,
    'discount_percent', v_discount_pct,
    'dynamic_pricing_tier_id', v_tier,
    'reference_type', v_ref_type,
    'reference_date', v_ref_at,
    'status', 'pending',
    'message', 'Cobrança gerada pelo valor líquido vigente'
  );
END;
$function$;

-- 3) Reaplica orquestração financeira em todas as propostas não excluídas para reconciliar valores existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.proposals
    WHERE deleted_at IS NULL
      AND COALESCE(revenue_type,'') NOT IN ('recurring','short_subscription','subscription_with_commitment','service')
  LOOP
    BEGIN
      PERFORM public.orchestrate_proposal_financials(r.id, 'manual_discount_propagation_backfill');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'orchestrate failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;