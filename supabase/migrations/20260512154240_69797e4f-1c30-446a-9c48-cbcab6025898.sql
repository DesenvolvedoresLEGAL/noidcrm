CREATE OR REPLACE FUNCTION public.orchestrate_proposal_financials(p_proposal_id uuid, p_reason text DEFAULT 'manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_one_time_effective numeric := 0;
  v_discount_pct numeric := 0;
  v_one_time_net numeric := 0;
  v_net_total numeric := 0;
  v_is_event boolean := false;
  v_is_recurring boolean := false;
  v_ref_type text;
  v_ref_at timestamptz;
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
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
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

  IF COALESCE(v_proposal.price_frozen_on_approval, false) THEN
    v_snapshot := v_proposal.dynamic_pricing_snapshot;
    v_current_amount := v_proposal.dynamic_pricing_current_amount;
  ELSE
    BEGIN
      SELECT reference_type, reference_at INTO v_ref_type, v_ref_at
        FROM public.resolve_dynamic_pricing_reference_date(p_proposal_id);
    EXCEPTION WHEN OTHERS THEN
      v_ref_type := 'current_date';
      v_ref_at := now();
    END;

    BEGIN
      v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, v_ref_at);
      IF v_snapshot IS NOT NULL THEN
        v_snapshot := v_snapshot
          || jsonb_build_object(
            'reference_type', v_ref_type,
            'reference_date', v_ref_at
          );
      END IF;
      v_current_amount := NULLIF(v_snapshot->>'current_amount','')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_snapshot := NULL;
      v_current_amount := NULL;
    END;

    IF v_is_event AND v_current_amount IS NOT NULL THEN
      UPDATE public.proposals
        SET dynamic_pricing_enabled = true,
            dynamic_pricing_current_amount = v_current_amount,
            dynamic_pricing_status = COALESCE(v_snapshot->>'status','active'),
            dynamic_pricing_snapshot = v_snapshot,
            dynamic_pricing_last_calculated_at = now(),
            dynamic_pricing_reference_type = v_ref_type,
            dynamic_pricing_reference_date = v_ref_at
        WHERE id = p_proposal_id;
    END IF;
  END IF;

  -- PRICE UX 1.0.6: payment_expected_amount is always NET after manual discount.
  -- dynamic_pricing_current_amount remains the gross current table subtotal only.
  v_one_time_effective := COALESCE(v_current_amount, v_one_time_total);

  IF NOT v_is_recurring THEN
    SELECT COALESCE(MAX(COALESCE(discount_percent, 0)), 0)
      INTO v_discount_pct
      FROM public.proposal_payment_terms
      WHERE proposal_id = p_proposal_id AND payment_type = 'one_time';
    v_discount_pct := LEAST(GREATEST(COALESCE(v_discount_pct, 0), 0), 100);
  END IF;

  v_one_time_net := v_one_time_effective * (1 - v_discount_pct / 100.0);
  v_net_total := v_one_time_net + v_recurring_total;
  v_effective_amount := v_net_total;

  IF NOT v_is_recurring THEN
    UPDATE public.proposals
      SET payment_expected_amount = v_net_total
      WHERE id = p_proposal_id;
  END IF;

  IF v_proposal.opportunity_id IS NOT NULL THEN
    UPDATE public.opportunities
      SET valor_previsto = v_net_total
      WHERE id = v_proposal.opportunity_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', p_reason,
    'total_amount', v_total,
    'effective_amount', v_effective_amount,
    'net_total', v_net_total,
    'one_time_total', v_one_time_total,
    'one_time_effective', v_one_time_effective,
    'one_time_net', v_one_time_net,
    'recurring_total', v_recurring_total,
    'discount_percent', v_discount_pct,
    'is_event', v_is_event,
    'is_recurring', v_is_recurring,
    'reference_type', v_ref_type,
    'reference_date', v_ref_at,
    'dynamic_result', v_dyn_result,
    'snapshot', v_snapshot
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_proposal_payment_terms_orchestrate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pid uuid;
BEGIN
  v_pid := COALESCE(NEW.proposal_id, OLD.proposal_id);
  IF v_pid IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    PERFORM public.orchestrate_proposal_financials(v_pid, 'payment_terms_changed');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'orchestrate_proposal_financials failed for payment terms proposal %: %', v_pid, SQLERRM;
  END;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_proposal_payment_terms_orchestrate ON public.proposal_payment_terms;
CREATE TRIGGER trg_proposal_payment_terms_orchestrate
  AFTER INSERT OR UPDATE OR DELETE ON public.proposal_payment_terms
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 2)
  EXECUTE FUNCTION public.trg_proposal_payment_terms_orchestrate();

GRANT EXECUTE ON FUNCTION public.orchestrate_proposal_financials(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.trg_proposal_payment_terms_orchestrate() TO authenticated, anon;