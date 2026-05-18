-- ============================================================================
-- FORENSIC FIX: Single source of truth for proposal commercial amount
-- ============================================================================
-- Problems addressed:
--  1. orchestrate_proposal_financials was reading discount from a SINGLE
--     payment_term row, so when a default 0% term was auto-inserted it could
--     silently override the user's real discount.
--  2. Auto-default one_time term insertion happened even when a user-defined
--     one_time term already existed (creating duplicates).
--  3. discount_amount on proposals was not being persisted after orchestration.
--  4. Slack/ERP read approved_amount as already-NET, but it could be set to
--     the GROSS dynamic amount, leaking 15% discount to integrations.
-- ============================================================================

-- 1) Canonical resolver: returns gross/discount/net for any proposal.
CREATE OR REPLACE FUNCTION public.resolve_proposal_commercial_amount(
  p_proposal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_one_time_total numeric := 0;
  v_recurring_total numeric := 0;
  v_dyn_current numeric := NULL;
  v_dyn_enabled boolean := false;
  v_dyn_status text;
  v_gross numeric := 0;
  v_discount_pct numeric := 0;
  v_discount_amount numeric := 0;
  v_net numeric := 0;
  v_source text := 'items';
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROPOSAL_NOT_FOUND');
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(billing_type,'one_time') <> 'recurring' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN billing_type = 'recurring' THEN total ELSE 0 END), 0)
  INTO v_one_time_total, v_recurring_total
  FROM public.proposal_items
  WHERE proposal_id = p_proposal_id;

  v_dyn_enabled := COALESCE(v_proposal.dynamic_pricing_enabled, false);
  v_dyn_status  := COALESCE(v_proposal.dynamic_pricing_status, '');
  v_dyn_current := v_proposal.dynamic_pricing_current_amount;

  -- Gross of the one-time portion = dynamic current (when active) else items total
  IF v_dyn_enabled
     AND v_dyn_status IN ('active','current','vigente','approved','aprovado')
     AND v_dyn_current IS NOT NULL AND v_dyn_current > 0 THEN
    v_gross := v_dyn_current;
    v_source := 'dynamic_pricing';
  ELSE
    v_gross := v_one_time_total;
    v_source := 'items';
  END IF;

  -- Commercial discount = MAX across all one_time payment terms (never trust a single row)
  SELECT COALESCE(MAX(COALESCE(discount_percent,0)), 0)
    INTO v_discount_pct
    FROM public.proposal_payment_terms
    WHERE proposal_id = p_proposal_id AND payment_type = 'one_time';
  v_discount_pct := LEAST(GREATEST(v_discount_pct, 0), 100);

  v_discount_amount := ROUND((v_gross * v_discount_pct / 100.0)::numeric, 2);
  v_net := ROUND((v_gross - v_discount_amount + v_recurring_total)::numeric, 2);

  RETURN jsonb_build_object(
    'ok', true,
    'proposal_id', p_proposal_id,
    'one_time_gross', v_gross,
    'one_time_items_total', v_one_time_total,
    'recurring_total', v_recurring_total,
    'discount_percent', v_discount_pct,
    'discount_amount', v_discount_amount,
    'net_amount', v_net,
    'amount_source', v_source,
    'dynamic_enabled', v_dyn_enabled,
    'dynamic_status', v_dyn_status,
    'dynamic_current_amount', v_dyn_current,
    'computed_at', now()
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_proposal_commercial_amount(uuid) TO authenticated, anon, service_role;


-- 2) Hardened orchestrator: never overrides user discount, never duplicates
-- the auto-default term when a user-defined one already exists, always
-- persists discount_amount and a real net to payment_expected_amount.
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
  v_resolved jsonb := NULL;
  v_is_event boolean := false;
  v_is_recurring boolean := false;
  v_max_due_date date := NULL;
  v_event_start date := NULL;
  v_schedule_entry jsonb;
  v_post_event_applied boolean := false;
  v_gross numeric := 0;
  v_discount_pct numeric := 0;
  v_discount_amount numeric := 0;
  v_net numeric := 0;
  v_has_user_term boolean := false;
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

  -- Don't overwrite frozen approved_amount via total_amount churn
  UPDATE public.proposals
    SET total_amount = v_total,
        value = COALESCE(v_total, value)
    WHERE id = p_proposal_id;

  IF v_is_event THEN
    -- Check if a user-defined one_time term already exists (anything beyond defaults)
    SELECT EXISTS (
      SELECT 1 FROM public.proposal_payment_terms
      WHERE proposal_id = p_proposal_id AND payment_type = 'one_time'
    ) INTO v_has_user_term;

    -- Pick canonical one_time term (prefer custom_schedule, then most recent meaningful)
    SELECT * INTO v_existing_one_time
      FROM public.proposal_payment_terms
      WHERE proposal_id = p_proposal_id AND payment_type = 'one_time'
      ORDER BY
        (payment_condition = 'custom_schedule') DESC,
        (COALESCE(discount_percent,0) > 0) DESC,
        (dynamic_pricing_reference_type = 'custom_date') DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
      LIMIT 1;

    -- Only insert default if NO term exists at all (prevents 0%-discount masking)
    IF v_existing_one_time.id IS NULL AND NOT v_has_user_term THEN
      INSERT INTO public.proposal_payment_terms(
        organization_id, proposal_id, payment_type, payment_method,
        installments, entry_percent, discount_percent, installment_interval_days,
        due_day, first_installment_date, payment_condition
      ) VALUES (
        v_org, p_proposal_id, 'one_time', 'pix',
        1, 0, 0, 30,
        EXTRACT(DAY FROM v_today)::int, v_today, 'upfront'
      );

      SELECT * INTO v_existing_one_time
        FROM public.proposal_payment_terms
        WHERE proposal_id = p_proposal_id AND payment_type = 'one_time'
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1;
    END IF;

    -- Max due date across all one_time terms (for post-event detection)
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

      IF v_term.payment_condition IN ('installments','net_7','net_15','net_30','invoiced')
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
       AND v_max_due_date > v_event_start
       AND v_existing_one_time.id IS NOT NULL THEN
      UPDATE public.proposal_payment_terms
        SET dynamic_pricing_reference_type = 'custom_date',
            dynamic_pricing_reference_date = v_max_due_date
        WHERE id = v_existing_one_time.id;
      v_post_event_applied := true;
    END IF;

    BEGIN
      v_dyn_result := public.generate_event_antecedence_pricing_for_proposal(p_proposal_id);
    EXCEPTION WHEN OTHERS THEN
      v_dyn_result := jsonb_build_object('ok', false, 'error', SQLERRM);
    END;

    BEGIN
      v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, NULL);
      UPDATE public.proposals
        SET dynamic_pricing_snapshot = v_snapshot,
            dynamic_pricing_current_amount = NULLIF(v_snapshot->>'current_amount','')::numeric,
            dynamic_pricing_status = COALESCE(v_snapshot->>'status', dynamic_pricing_status),
            dynamic_pricing_last_calculated_at = now()
        WHERE id = p_proposal_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Use the canonical resolver (reads MAX discount across all one_time terms)
  v_resolved := public.resolve_proposal_commercial_amount(p_proposal_id);
  v_gross := COALESCE((v_resolved->>'one_time_gross')::numeric, 0);
  v_discount_pct := COALESCE((v_resolved->>'discount_percent')::numeric, 0);
  v_discount_amount := COALESCE((v_resolved->>'discount_amount')::numeric, 0);
  v_net := COALESCE((v_resolved->>'net_amount')::numeric, 0);

  -- Persist net + discount_amount; never let an aceito proposal lose its approved_amount
  UPDATE public.proposals
    SET payment_expected_amount = v_net,
        discount_amount = v_discount_amount,
        approved_amount = CASE
          WHEN status = 'accepted' THEN
            -- Always realign approved value to the canonical net (fixes already-broken records)
            v_net
          ELSE approved_amount
        END
    WHERE id = p_proposal_id;

  -- Keep opportunity in sync with NET
  IF v_proposal.opportunity_id IS NOT NULL THEN
    UPDATE public.opportunities
      SET valor_previsto = v_net
      WHERE id = v_proposal.opportunity_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', p_reason,
    'total_amount', v_total,
    'one_time_total', v_one_time_total,
    'recurring_total', v_recurring_total,
    'one_time_gross', v_gross,
    'discount_percent', v_discount_pct,
    'discount_amount', v_discount_amount,
    'net_amount', v_net,
    'is_event', v_is_event,
    'is_recurring', v_is_recurring,
    'dynamic_result', v_dyn_result,
    'snapshot', v_snapshot,
    'resolved', v_resolved,
    'post_event_tier_applied', v_post_event_applied,
    'max_due_date', v_max_due_date,
    'event_start_date', v_event_start
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.orchestrate_proposal_financials(uuid, text) TO authenticated, service_role;


-- 3) Backfill: rerun orchestration for the recently-affected proposals so that
-- payment_expected_amount, discount_amount, approved_amount and
-- opportunities.valor_previsto reflect the canonical NET value.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.proposals
    WHERE deleted_at IS NULL
      AND updated_at >= now() - interval '30 days'
  LOOP
    BEGIN
      PERFORM public.orchestrate_proposal_financials(r.id, 'forensic_backfill_2026_05_18');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'backfill failed for proposal %: %', r.id, SQLERRM;
    END;
  END LOOP;
END;
$$;