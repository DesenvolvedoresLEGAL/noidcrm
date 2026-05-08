CREATE OR REPLACE FUNCTION public.apply_dynamic_price_to_proposal(
  p_proposal_id uuid,
  p_reference_at timestamp with time zone DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_amount numeric;
  v_org uuid;
  v_opp uuid;
  v_rule_id uuid;
BEGIN
  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, p_reference_at);
  v_amount := NULLIF(v_snapshot->>'current_amount','')::numeric;

  IF v_amount IS NULL THEN
    RETURN v_snapshot;
  END IF;

  UPDATE public.proposals
    SET dynamic_pricing_enabled = true,
        dynamic_pricing_current_amount = v_amount,
        dynamic_pricing_status = COALESCE(v_snapshot->>'status','active'),
        dynamic_pricing_snapshot = v_snapshot,
        dynamic_pricing_last_calculated_at = now(),
        payment_expected_amount = v_amount
    WHERE id = p_proposal_id
    RETURNING organization_id, opportunity_id INTO v_org, v_opp;

  IF v_opp IS NOT NULL THEN
    UPDATE public.opportunities
      SET valor_previsto = v_amount
      WHERE id = v_opp;
  END IF;

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

CREATE OR REPLACE FUNCTION public.orchestrate_proposal_financials(
  p_proposal_id uuid,
  p_reason text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_org uuid;
  v_total numeric := 0;
  v_one_time_total numeric := 0;
  v_recurring_total numeric := 0;
  v_today date := CURRENT_DATE;
  v_existing_one_time public.proposal_payment_terms%ROWTYPE;
  v_dyn_result jsonb := NULL;
  v_snapshot jsonb := NULL;
  v_current_amount numeric := NULL;
  v_effective_amount numeric := 0;
  v_is_event boolean := false;
  v_is_recurring boolean := false;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROPOSAL_NOT_FOUND');
  END IF;
  IF v_proposal.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROPOSAL_DELETED');
  END IF;

  v_org := v_proposal.organization_id;

  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(billing_type,'one_time') <> 'recurring' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN billing_type = 'recurring' THEN total ELSE 0 END), 0)
  INTO v_one_time_total, v_recurring_total
  FROM public.proposal_items
  WHERE proposal_id = p_proposal_id;

  v_total := v_one_time_total + v_recurring_total;

  v_is_event := COALESCE(v_proposal.revenue_type,'') IN ('one_time_event','one_time_non_event')
                AND COALESCE(v_proposal.dynamic_pricing_applicability,'none') = 'automatic';
  v_is_recurring := COALESCE(v_proposal.revenue_type,'') IN ('recurring','short_subscription','subscription_with_commitment','service');

  UPDATE public.proposals
    SET total_amount = v_total,
        value = COALESCE(v_total, value)
    WHERE id = p_proposal_id;

  IF v_is_event THEN
    SELECT * INTO v_existing_one_time
      FROM public.proposal_payment_terms
      WHERE proposal_id = p_proposal_id AND payment_type = 'one_time'
      LIMIT 1;

    IF v_existing_one_time.id IS NULL THEN
      INSERT INTO public.proposal_payment_terms(
        organization_id, proposal_id, payment_type, payment_method,
        installments, entry_percent, discount_percent, installment_interval_days,
        due_day, first_installment_date
      ) VALUES (
        v_org, p_proposal_id, 'one_time', 'pix',
        1, 0, 0, 30,
        EXTRACT(DAY FROM v_today)::int, v_today
      );
    ELSE
      IF v_existing_one_time.payment_method IS NULL OR v_existing_one_time.payment_method = '' THEN
        UPDATE public.proposal_payment_terms
          SET payment_method = 'pix'
          WHERE id = v_existing_one_time.id;
      END IF;
      IF v_existing_one_time.first_installment_date IS NULL THEN
        UPDATE public.proposal_payment_terms
          SET first_installment_date = v_today
          WHERE id = v_existing_one_time.id;
      END IF;
    END IF;
  END IF;

  IF v_is_recurring THEN
    UPDATE public.proposal_dynamic_pricing_rules
      SET enabled = false, status = 'disabled'
      WHERE proposal_id = p_proposal_id;

    UPDATE public.proposals
      SET dynamic_pricing_enabled = false,
          dynamic_pricing_status = 'disabled',
          dynamic_pricing_current_amount = NULL,
          dynamic_pricing_snapshot = NULL,
          payment_expected_amount = NULL
      WHERE id = p_proposal_id;
  END IF;

  IF v_is_event AND public.can_auto_generate_dynamic_pricing(p_proposal_id) AND v_total > 0 THEN
    BEGIN
      v_dyn_result := public.generate_event_antecedence_pricing_for_proposal(p_proposal_id, true);
    EXCEPTION WHEN OTHERS THEN
      v_dyn_result := jsonb_build_object('error', SQLERRM);
    END;
  END IF;

  BEGIN
    v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, now());
    v_current_amount := NULLIF(v_snapshot->>'current_amount','')::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_snapshot := NULL;
    v_current_amount := NULL;
  END;

  v_effective_amount := COALESCE(v_current_amount, v_total);

  IF v_is_event AND v_current_amount IS NOT NULL THEN
    UPDATE public.proposals
      SET dynamic_pricing_enabled = true,
          dynamic_pricing_current_amount = v_current_amount,
          dynamic_pricing_status = COALESCE(v_snapshot->>'status','active'),
          dynamic_pricing_snapshot = v_snapshot,
          dynamic_pricing_last_calculated_at = now(),
          payment_expected_amount = v_current_amount
      WHERE id = p_proposal_id;
  END IF;

  IF v_proposal.opportunity_id IS NOT NULL THEN
    UPDATE public.opportunities
      SET valor_previsto = v_effective_amount
      WHERE id = v_proposal.opportunity_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', p_reason,
    'total_amount', v_total,
    'effective_amount', v_effective_amount,
    'one_time_total', v_one_time_total,
    'recurring_total', v_recurring_total,
    'is_event', v_is_event,
    'is_recurring', v_is_recurring,
    'dynamic_result', v_dyn_result,
    'snapshot', v_snapshot
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_dynamic_price_to_proposal(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orchestrate_proposal_financials(uuid, text) TO authenticated, anon;