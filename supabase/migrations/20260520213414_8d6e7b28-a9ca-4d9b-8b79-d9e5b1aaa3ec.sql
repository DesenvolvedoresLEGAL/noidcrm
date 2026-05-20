
-- =====================================================
-- PRICE CORE 2.0C — Operational guards
-- =====================================================

-- 1) Central guard: ensure_proposal_pricing_ready
CREATE OR REPLACE FUNCTION public.ensure_proposal_pricing_ready(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_recalc jsonb;
  v_snapshot jsonb;
  v_effective numeric;
  v_erp numeric;
  v_approval numeric;
  v_schedule_total numeric;
  v_diff numeric;
  v_has_div boolean;
  v_frozen boolean := false;
  v_approved_amount numeric;
  v_blocked_msg constant text := 'Não foi possível continuar. Existem valores divergentes nesta proposta. Recalcule a proposta antes de aprovar, cobrar ou enviar ao ERP.';
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF v_proposal.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'blocked', true, 'reason', 'not_found', 'message', 'Proposta não encontrada.');
  END IF;

  -- Always recalc (RPC respects frozen approvals internally)
  v_recalc := public.recalculate_proposal_pricing_ledger(p_proposal_id);

  -- Re-read post-recalc
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;

  v_snapshot      := COALESCE(v_proposal.pricing_breakdown_snapshot, '{}'::jsonb);
  v_effective     := COALESCE(v_proposal.pricing_effective_amount, 0);
  v_erp           := COALESCE(v_proposal.pricing_erp_amount, v_effective);
  v_approval      := COALESCE(v_proposal.pricing_approval_amount, v_effective);
  v_schedule_total:= COALESCE(v_proposal.pricing_payment_schedule_total, v_effective);
  v_has_div       := COALESCE(v_proposal.pricing_has_divergence, false);
  v_frozen        := COALESCE(v_proposal.price_frozen_on_approval, false) AND v_proposal.status = 'accepted';
  v_approved_amount := v_proposal.approved_amount;

  -- Frozen accepted proposals: validate against approved_amount, never overwrite
  IF v_frozen AND v_approved_amount IS NOT NULL THEN
    -- All values from approval snapshot are immutable; return approval payload
    RETURN jsonb_build_object(
      'ok', true,
      'blocked', false,
      'frozen', true,
      'effective_amount', v_approved_amount,
      'erp_amount', v_approved_amount,
      'approval_amount', v_approved_amount,
      'payment_schedule_total', COALESCE((v_proposal.approval_snapshot->>'payment_schedule_total')::numeric, v_approved_amount),
      'payment_schedule', COALESCE(v_proposal.approval_snapshot->'payment_schedule', v_proposal.approved_payment_schedule),
      'has_divergence', false,
      'snapshot', COALESCE(v_proposal.approval_snapshot, v_snapshot),
      'message', 'Valores congelados na aprovação.'
    );
  END IF;

  -- Hard guards (non-frozen)
  IF v_effective <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'blocked', true, 'reason', 'zero_effective_amount',
      'message', 'Valor vigente indisponível. Verifique itens, condições de pagamento e tabela dinâmica antes de continuar.');
  END IF;

  v_diff := abs(COALESCE(v_schedule_total, 0) - v_effective);
  IF v_diff > 0.01 THEN
    RETURN jsonb_build_object('ok', false, 'blocked', true, 'reason', 'schedule_divergence',
      'effective_amount', v_effective, 'payment_schedule_total', v_schedule_total,
      'message', v_blocked_msg);
  END IF;

  IF v_has_div THEN
    RETURN jsonb_build_object('ok', false, 'blocked', true, 'reason', 'ledger_divergence',
      'divergence_details', v_proposal.pricing_divergence_details,
      'message', v_blocked_msg);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'blocked', false,
    'frozen', false,
    'effective_amount', v_effective,
    'erp_amount', v_erp,
    'approval_amount', v_approval,
    'payment_schedule_total', v_schedule_total,
    'payment_schedule', v_snapshot->'payment_schedule',
    'has_divergence', false,
    'snapshot', v_snapshot
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_proposal_pricing_ready(uuid) TO authenticated, anon, service_role;

-- 2) Approval freeze helper — caller passes acceptor data
CREATE OR REPLACE FUNCTION public.freeze_proposal_approval(
  p_proposal_id uuid,
  p_acceptor_name text DEFAULT NULL,
  p_acceptor_document text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check jsonb;
  v_snapshot jsonb;
  v_amount numeric;
  v_schedule jsonb;
  v_tier uuid;
  v_proposal public.proposals%ROWTYPE;
  v_accepted_at timestamptz := now();
BEGIN
  -- Block on divergence
  v_check := public.ensure_proposal_pricing_ready(p_proposal_id);
  IF NOT (v_check->>'ok')::boolean THEN
    RETURN v_check;
  END IF;

  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;

  -- Already frozen? Idempotent
  IF v_proposal.status = 'accepted' AND COALESCE(v_proposal.price_frozen_on_approval, false) THEN
    RETURN jsonb_build_object('ok', true, 'blocked', false, 'frozen', true,
      'approved_amount', v_proposal.approved_amount,
      'message', 'Proposta já aprovada e congelada.');
  END IF;

  v_snapshot := v_proposal.pricing_breakdown_snapshot;
  v_amount   := COALESCE((v_check->>'approval_amount')::numeric, v_proposal.pricing_approval_amount, v_proposal.pricing_effective_amount);
  v_schedule := COALESCE(v_check->'payment_schedule', v_snapshot->'payment_schedule');
  v_tier     := NULLIF(v_snapshot->'dynamic_adjustment'->>'tier_id','')::uuid;

  UPDATE public.proposals SET
    status = 'accepted',
    accepted_at = COALESCE(accepted_at, v_accepted_at),
    signature_status = 'accepted',
    acceptor_name = COALESCE(acceptor_name, p_acceptor_name),
    acceptor_document = COALESCE(acceptor_document, p_acceptor_document),
    approved_amount = v_amount,
    approved_payment_schedule = jsonb_build_object('schedule', v_schedule),
    approved_dynamic_pricing_tier_id = v_tier,
    approval_snapshot = v_snapshot,
    price_frozen_on_approval = true
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object(
    'ok', true, 'blocked', false, 'frozen', true,
    'approved_amount', v_amount,
    'approved_payment_schedule', jsonb_build_object('schedule', v_schedule),
    'approval_snapshot', v_snapshot,
    'message', 'Proposta aprovada e valores congelados.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.freeze_proposal_approval(uuid, text, text) TO authenticated, anon, service_role;

-- 3) Update create_proposal_payment_intent to use ledger + ensure
CREATE OR REPLACE FUNCTION public.create_proposal_payment_intent(p_proposal_id uuid, p_source text DEFAULT 'proposal_link'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_check jsonb;
  v_proposal public.proposals%ROWTYPE;
  v_org uuid;
  v_amount numeric;
  v_snapshot jsonb;
  v_tier uuid;
  v_rule uuid;
  v_intent_id uuid;
  v_user uuid := auth.uid();
  v_expires timestamptz;
BEGIN
  -- PRICE CORE 2.0C: ledger first
  v_check := public.ensure_proposal_pricing_ready(p_proposal_id);
  IF NOT (v_check->>'ok')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false,
      'blocked', true,
      'reason', v_check->>'reason',
      'message', COALESCE(v_check->>'message',
        'Não foi possível gerar cobrança. Existem valores divergentes na proposta.')
    );
  END IF;

  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  v_org := v_proposal.organization_id;
  v_amount := COALESCE((v_check->>'erp_amount')::numeric, v_proposal.pricing_erp_amount, 0);
  v_snapshot := COALESCE(v_check->'snapshot', v_proposal.pricing_breakdown_snapshot);
  v_tier := NULLIF(v_snapshot->'dynamic_adjustment'->>'tier_id','')::uuid;
  v_rule := v_proposal.dynamic_pricing_rule_id;
  v_expires := NULLIF(v_snapshot->'dynamic_adjustment'->>'tier_ends_at','')::timestamptz;

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'blocked', true, 'reason', 'zero_amount',
      'message', 'Valor para cobrança indisponível.');
  END IF;

  INSERT INTO public.proposal_payment_intents(
    organization_id, proposal_id, dynamic_pricing_rule_id, dynamic_pricing_tier_id,
    source, expected_amount, currency, status, payment_method,
    dynamic_pricing_snapshot, created_by, updated_by, expires_at
  ) VALUES (
    v_org, p_proposal_id, v_rule, v_tier,
    COALESCE(p_source,'proposal_link'), v_amount,
    COALESCE(v_proposal.currency,'BRL'),
    'pending', 'pix',
    v_snapshot, v_user, v_user, v_expires
  ) RETURNING id INTO v_intent_id;

  UPDATE public.proposals
  SET latest_payment_intent_id = v_intent_id,
      payment_expected_amount = v_amount,
      payment_validation_status = COALESCE(payment_validation_status,'pending'),
      payment_snapshot = jsonb_build_object(
        'intent_id', v_intent_id,
        'expected_amount', v_amount,
        'pricing_snapshot_version', v_snapshot->>'version',
        'tier_id', v_tier,
        'frozen', COALESCE((v_check->>'frozen')::boolean, false),
        'created_at', now()
      )
  WHERE id = p_proposal_id;

  IF v_proposal.opportunity_id IS NOT NULL THEN
    UPDATE public.opportunities SET valor_previsto = v_amount WHERE id = v_proposal.opportunity_id;
  END IF;

  INSERT INTO public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id, event_type,
    expected_amount, message, created_by, metadata
  ) VALUES (
    v_org, p_proposal_id, v_intent_id, 'payment_intent_created',
    v_amount, 'Cobrança gerada pelo valor canônico do ledger.', v_user,
    jsonb_build_object('pricing_breakdown_snapshot', v_snapshot, 'frozen', COALESCE((v_check->>'frozen')::boolean, false))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payment_intent_id', v_intent_id,
    'proposal_id', p_proposal_id,
    'expected_amount', v_amount,
    'dynamic_pricing_tier_id', v_tier,
    'status', 'pending',
    'message', 'Cobrança gerada pelo valor canônico do ledger.'
  );
END;
$function$;

-- 4) Update create_complementary_payment_intent to block on divergence
CREATE OR REPLACE FUNCTION public.create_complementary_payment_intent(p_original_payment_intent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orig record;
  v_new_id uuid;
  v_user uuid := auth.uid();
  v_check jsonb;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO v_orig FROM public.proposal_payment_intents WHERE id = p_original_payment_intent_id;
  IF v_orig.id IS NULL THEN
    RAISE EXCEPTION 'Original payment intent not found';
  END IF;

  IF v_orig.difference_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sem diferença pendente');
  END IF;

  -- PRICE CORE 2.0C: ensure proposal ledger is consistent before opening any new charge
  v_check := public.ensure_proposal_pricing_ready(v_orig.proposal_id);
  IF NOT (v_check->>'ok')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false, 'blocked', true, 'reason', v_check->>'reason',
      'message', COALESCE(v_check->>'message',
        'Não foi possível gerar cobrança complementar. Existem valores divergentes na proposta.')
    );
  END IF;

  v_snapshot := COALESCE(v_check->'snapshot', v_orig.dynamic_pricing_snapshot);

  INSERT INTO public.proposal_payment_intents(
    organization_id, proposal_id, dynamic_pricing_rule_id, dynamic_pricing_tier_id,
    source, expected_amount, currency, status, payment_method,
    dynamic_pricing_snapshot, parent_payment_intent_id,
    created_by, updated_by, notes
  ) VALUES (
    v_orig.organization_id, v_orig.proposal_id, v_orig.dynamic_pricing_rule_id, v_orig.dynamic_pricing_tier_id,
    'complementary_charge', v_orig.difference_amount, v_orig.currency, 'pending', 'pix',
    v_snapshot, v_orig.id,
    v_user, v_user, 'Cobrança complementar referente à diferença pendente'
  ) RETURNING id INTO v_new_id;

  UPDATE public.proposal_payment_intents
  SET status = 'complementary_pending', updated_by = v_user
  WHERE id = v_orig.id;

  INSERT INTO public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id, event_type,
    expected_amount, message, created_by, metadata
  ) VALUES (
    v_orig.organization_id, v_orig.proposal_id, v_new_id, 'complementary_charge_created',
    v_orig.difference_amount, 'Cobrança complementar criada (ledger validado).', v_user,
    jsonb_build_object('original_intent_id', v_orig.id, 'pricing_breakdown_snapshot', v_snapshot)
  );

  RETURN jsonb_build_object('ok', true, 'complementary_payment_intent_id', v_new_id, 'difference_amount', v_orig.difference_amount);
END;
$function$;
