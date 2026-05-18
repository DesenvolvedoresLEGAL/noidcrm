
CREATE OR REPLACE FUNCTION public.orchestrate_proposal_financials(
  p_proposal_id uuid,
  p_reason text DEFAULT 'manual'
)
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
  v_term public.proposal_payment_terms%ROWTYPE;
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
  v_max_due_date date := NULL;
  v_event_start date := NULL;
  v_schedule_entry jsonb;
  v_post_event_applied boolean := false;
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
      ORDER BY (payment_condition = 'custom_schedule') DESC,
               updated_at DESC NULLS LAST,
               created_at DESC NULLS LAST
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

      SELECT * INTO v_existing_one_time
        FROM public.proposal_payment_terms
        WHERE proposal_id = p_proposal_id AND payment_type = 'one_time'
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1;
    END IF;

    -- Maior data de vencimento entre TODOS os termos one_time
    FOR v_term IN
      SELECT * FROM public.proposal_payment_terms
      WHERE proposal_id = p_proposal_id AND payment_type = 'one_time'
    LOOP
      IF v_term.payment_condition = 'custom_schedule'
         AND v_term.manual_schedule IS NOT NULL
         AND jsonb_typeof(v_term.manual_schedule) = 'array' THEN
        FOR v_schedule_entry IN SELECT * FROM jsonb_array_elements(v_term.manual_schedule)
        LOOP
          IF v_schedule_entry ? 'due_date' AND (v_schedule_entry->>'due_date') ~ '^\d{4}-\d{2}-\d{2}' THEN
            v_max_due_date := GREATEST(
              COALESCE(v_max_due_date, '1900-01-01'::date),
              (v_schedule_entry->>'due_date')::date
            );
          END IF;
        END LOOP;
      END IF;

      IF v_term.payment_condition IN ('split_50_50','split_30_70')
         AND v_term.second_payment_due_date IS NOT NULL THEN
        v_max_due_date := GREATEST(
          COALESCE(v_max_due_date, '1900-01-01'::date),
          v_term.second_payment_due_date
        );
      END IF;

      IF v_term.payment_condition IN ('installments','net_7','net_15','net_30','net_35','invoiced')
         AND v_term.first_installment_date IS NOT NULL THEN
        v_max_due_date := GREATEST(
          COALESCE(v_max_due_date, '1900-01-01'::date),
          v_term.first_installment_date
            + (GREATEST(COALESCE(v_term.installments,1),1) - 1)
              * COALESCE(v_term.installment_interval_days, 30)
        );
      END IF;
    END LOOP;

    SELECT event_start_date INTO v_event_start
      FROM public.proposal_dynamic_pricing_rules
      WHERE proposal_id = p_proposal_id
      LIMIT 1;

    IF v_event_start IS NOT NULL
       AND v_max_due_date IS NOT NULL
       AND v_max_due_date > v_event_start THEN
      UPDATE public.proposal_payment_terms
        SET dynamic_pricing_reference_type = 'custom_date',
            dynamic_pricing_reference_date = v_max_due_date
        WHERE id = v_existing_one_time.id;
      v_post_event_applied := true;
      SELECT * INTO v_existing_one_time FROM public.proposal_payment_terms WHERE id = v_existing_one_time.id;
    END IF;

    BEGIN
      v_dyn_result := public.generate_event_antecedence_pricing_for_proposal(p_proposal_id);
    EXCEPTION WHEN OTHERS THEN
      v_dyn_result := jsonb_build_object('ok', false, 'error', SQLERRM);
    END;

    -- Recalcular snapshot usando o resolver (que considera dynamic_pricing_reference_type/date)
    BEGIN
      v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, NULL);
      UPDATE public.proposals
        SET dynamic_pricing_snapshot = v_snapshot,
            dynamic_pricing_current_amount = NULLIF(v_snapshot->>'current_amount','')::numeric,
            dynamic_pricing_status = COALESCE(v_snapshot->>'status', dynamic_pricing_status),
            dynamic_pricing_last_calculated_at = now()
        WHERE id = p_proposal_id;
      v_current_amount := NULLIF(v_snapshot->>'current_amount','')::numeric;
    EXCEPTION WHEN OTHERS THEN
      SELECT dynamic_pricing_snapshot, dynamic_pricing_current_amount
        INTO v_snapshot, v_current_amount
        FROM public.proposals
        WHERE id = p_proposal_id;
    END;
  END IF;

  v_one_time_effective := COALESCE(v_current_amount, v_one_time_total);
  v_discount_pct := COALESCE(v_existing_one_time.discount_percent, 0);
  v_one_time_net := v_one_time_effective * (1 - v_discount_pct/100.0);
  v_effective_amount := v_one_time_effective + v_recurring_total;
  v_net_total := v_one_time_net + v_recurring_total;

  UPDATE public.proposals
    SET payment_expected_amount = v_net_total
    WHERE id = p_proposal_id;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', p_reason,
    'total_amount', v_total,
    'one_time_total', v_one_time_total,
    'recurring_total', v_recurring_total,
    'is_event', v_is_event,
    'is_recurring', v_is_recurring,
    'dynamic_result', v_dyn_result,
    'snapshot', v_snapshot,
    'post_event_tier_applied', v_post_event_applied,
    'max_due_date', v_max_due_date,
    'event_start_date', v_event_start
  );
END;
$function$;
