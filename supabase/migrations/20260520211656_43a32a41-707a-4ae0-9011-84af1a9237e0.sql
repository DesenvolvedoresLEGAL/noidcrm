CREATE OR REPLACE FUNCTION public.recalculate_proposal_pricing_ledger(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_subtotal_items numeric := 0;
  v_subtotal_recurring numeric := 0;
  v_inventory_adj numeric := 0;
  v_manual_pct numeric := 0;
  v_manual_amount numeric := 0;
  v_manual_source text := 'none';
  v_manual_warnings text[] := ARRAY[]::text[];
  v_base_amount numeric := 0;
  v_dyn_enabled boolean := false;
  v_dyn_applicability text := 'manual';
  v_dyn_mode text := null;
  v_dyn_pct numeric := 0;
  v_dyn_amount numeric := 0;
  v_dyn_tier_id uuid := null;
  v_dyn_tier_label text := null;
  v_dyn_tier_starts_at timestamptz := null;
  v_dyn_tier_ends_at timestamptz := null;
  v_dyn_tier_adjustment_type text := null;
  v_dyn_tier_adjustment_value numeric := null;
  v_dyn_tier_final_amount numeric := null;
  v_dyn_next_tier_id uuid := null;
  v_dyn_next_tier_starts_at timestamptz := null;
  v_dyn_prev_tier_id uuid := null;
  v_dyn_prev_tier_final_amount numeric := null;
  v_reference_date timestamptz;
  v_effective_amount numeric := 0;
  v_payment_schedule jsonb := '[]'::jsonb;
  v_payment_schedule_total numeric := 0;
  v_schedule_diff numeric := 0;
  v_erp_amount numeric := 0;
  v_approval_amount numeric := 0;
  v_has_divergence boolean := false;
  v_divergence_details jsonb := '{}'::jsonb;
  v_snapshot jsonb;
  v_pt RECORD;
  v_installments int;
  v_inst_value numeric;
  v_last_inst_value numeric;
  v_due_date date;
  v_idx int;
  v_freeze boolean := false;
  v_approval_snapshot jsonb;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'proposal_not_found');
  END IF;

  v_freeze := COALESCE(v_proposal.price_frozen_on_approval, false);
  v_approval_snapshot := v_proposal.approval_snapshot;

  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(billing_type,'one_time') <> 'recurring' THEN COALESCE(total, quantity*unit_price, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(billing_type,'one_time') = 'recurring' THEN COALESCE(total, quantity*unit_price, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(billing_type,'one_time') <> 'recurring' THEN COALESCE(inventory_adjustment_amount,0) ELSE 0 END), 0)
  INTO v_subtotal_items, v_subtotal_recurring, v_inventory_adj
  FROM public.proposal_items
  WHERE proposal_id = p_proposal_id;

  SELECT * INTO v_pt FROM public.proposal_payment_terms WHERE proposal_id = p_proposal_id LIMIT 1;
  IF v_pt.id IS NOT NULL AND COALESCE(v_pt.discount_percent,0) > 0 THEN
    v_manual_pct := v_pt.discount_percent;
    v_manual_source := 'payment_terms';
  ELSIF COALESCE(v_proposal.discount_amount,0) > 0 THEN
    v_manual_amount := v_proposal.discount_amount;
    v_manual_source := 'proposals.discount_amount';
  END IF;

  IF v_manual_pct > 0 THEN
    v_manual_amount := ROUND((v_subtotal_items * v_manual_pct / 100.0)::numeric, 2);
  ELSIF v_manual_amount > 0 AND v_subtotal_items > 0 THEN
    v_manual_pct := ROUND((v_manual_amount / v_subtotal_items * 100.0)::numeric, 4);
  END IF;

  IF v_pt.id IS NOT NULL AND COALESCE(v_pt.discount_percent,0) > 0 AND COALESCE(v_proposal.discount_amount,0) > 0 THEN
    v_manual_warnings := array_append(v_manual_warnings, 'manual_discount_double_source');
  END IF;

  v_base_amount := ROUND((v_subtotal_items - v_manual_amount + v_inventory_adj)::numeric, 2);

  v_dyn_enabled := COALESCE(v_proposal.dynamic_pricing_enabled, false);
  v_dyn_applicability := COALESCE(v_proposal.dynamic_pricing_applicability, 'manual');
  v_dyn_mode := v_proposal.dynamic_pricing_mode;
  v_reference_date := COALESCE(
    v_proposal.dynamic_pricing_reference_date,
    (SELECT MIN(dynamic_pricing_reference_date)::timestamptz FROM public.proposal_payment_terms WHERE proposal_id = p_proposal_id AND dynamic_pricing_reference_date IS NOT NULL),
    now()
  );

  IF v_dyn_enabled AND v_subtotal_recurring = 0 THEN
    SELECT id, label, starts_at, ends_at, adjustment_type, adjustment_value, final_amount
      INTO v_dyn_tier_id, v_dyn_tier_label, v_dyn_tier_starts_at, v_dyn_tier_ends_at, v_dyn_tier_adjustment_type, v_dyn_tier_adjustment_value, v_dyn_tier_final_amount
      FROM public.proposal_dynamic_pricing_tiers
     WHERE proposal_id = p_proposal_id
       AND starts_at <= v_reference_date
       AND (ends_at IS NULL OR ends_at > v_reference_date)
     ORDER BY tier_order DESC
     LIMIT 1;

    IF v_dyn_tier_id IS NOT NULL THEN
      IF v_dyn_tier_adjustment_type IN ('percent','percentage','pct','percent_adjustment') THEN
        v_dyn_pct := COALESCE(v_dyn_tier_adjustment_value, 0);
        v_dyn_amount := ROUND((v_base_amount * v_dyn_pct / 100.0)::numeric, 2);
      ELSIF v_dyn_tier_adjustment_type IN ('amount','flat','absolute','amount_adjustment') THEN
        v_dyn_amount := ROUND(COALESCE(v_dyn_tier_adjustment_value, 0)::numeric, 2);
        v_dyn_pct := CASE WHEN v_base_amount > 0 THEN ROUND((v_dyn_amount / v_base_amount * 100.0)::numeric, 4) ELSE 0 END;
      ELSIF v_dyn_tier_final_amount IS NOT NULL THEN
        v_dyn_amount := ROUND((v_dyn_tier_final_amount - v_base_amount)::numeric, 2);
        v_dyn_pct := CASE WHEN v_base_amount > 0 THEN ROUND((v_dyn_amount / v_base_amount * 100.0)::numeric, 4) ELSE 0 END;
      END IF;

      SELECT id, starts_at INTO v_dyn_next_tier_id, v_dyn_next_tier_starts_at
        FROM public.proposal_dynamic_pricing_tiers
       WHERE proposal_id = p_proposal_id AND starts_at > v_reference_date
       ORDER BY starts_at ASC LIMIT 1;
      SELECT id, final_amount INTO v_dyn_prev_tier_id, v_dyn_prev_tier_final_amount
        FROM public.proposal_dynamic_pricing_tiers
       WHERE proposal_id = p_proposal_id AND ends_at IS NOT NULL AND ends_at <= v_reference_date
       ORDER BY ends_at DESC LIMIT 1;
    END IF;
  END IF;

  v_effective_amount := ROUND((v_base_amount + v_dyn_amount + v_subtotal_recurring)::numeric, 2);

  IF v_pt.id IS NOT NULL THEN
    v_installments := GREATEST(COALESCE(v_pt.installments, 1), 1);
  ELSE
    v_installments := 1;
  END IF;

  v_inst_value := ROUND((v_effective_amount / v_installments)::numeric, 2);
  v_last_inst_value := ROUND((v_effective_amount - v_inst_value * (v_installments - 1))::numeric, 2);

  v_payment_schedule := '[]'::jsonb;
  FOR v_idx IN 1..v_installments LOOP
    v_due_date := COALESCE(v_pt.first_installment_date, CURRENT_DATE)
                  + ((v_idx - 1) * COALESCE(v_pt.installment_interval_days, 30));
    v_payment_schedule := v_payment_schedule || jsonb_build_array(jsonb_build_object(
      'index', v_idx,
      'label', 'Parcela ' || v_idx || '/' || v_installments,
      'due_date', v_due_date,
      'amount', CASE WHEN v_idx = v_installments THEN v_last_inst_value ELSE v_inst_value END
    ));
  END LOOP;

  v_payment_schedule_total := v_inst_value * (v_installments - 1) + v_last_inst_value;
  v_schedule_diff := ROUND((v_payment_schedule_total - v_effective_amount)::numeric, 2);

  v_erp_amount := v_effective_amount;
  v_approval_amount := v_effective_amount;

  v_has_divergence := ABS(v_schedule_diff) > 0.02;
  v_divergence_details := jsonb_build_object(
    'schedule_total', v_payment_schedule_total,
    'schedule_diff', v_schedule_diff,
    'effective_amount', v_effective_amount
  );

  v_snapshot := jsonb_build_object(
    'version', 2,
    'proposal_id', p_proposal_id,
    'calculated_at', now(),
    'reference_date', v_reference_date,
    'pricing_status', 'ok',
    'subtotal_items', v_subtotal_items,
    'recurring_subtotal', v_subtotal_recurring,
    'inventory_adjustment_amount', v_inventory_adj,
    'manual_discount', jsonb_build_object('percent', v_manual_pct, 'amount', v_manual_amount, 'source', v_manual_source),
    'base_amount', v_base_amount,
    'dynamic_adjustment', jsonb_build_object(
      'enabled', v_dyn_enabled,
      'applicability', v_dyn_applicability,
      'mode', v_dyn_mode,
      'percent', v_dyn_pct,
      'amount', v_dyn_amount,
      'tier_id', v_dyn_tier_id,
      'tier_label', v_dyn_tier_label,
      'tier_starts_at', v_dyn_tier_starts_at,
      'tier_ends_at', v_dyn_tier_ends_at,
      'next_tier_id', v_dyn_next_tier_id,
      'next_tier_starts_at', v_dyn_next_tier_starts_at,
      'previous_tier_id', v_dyn_prev_tier_id,
      'previous_tier_final_amount', v_dyn_prev_tier_final_amount
    ),
    'effective_amount', v_effective_amount,
    'payment_schedule', v_payment_schedule,
    'payment_schedule_total', v_payment_schedule_total,
    'erp_amount', v_erp_amount,
    'approval_amount', v_approval_amount,
    'has_divergence', v_has_divergence,
    'divergence_details', v_divergence_details,
    'frozen', v_freeze,
    'warnings', to_jsonb(v_manual_warnings)
  );

  IF v_proposal.status = 'accepted' AND v_freeze AND v_approval_snapshot IS NOT NULL THEN
    UPDATE public.proposals
       SET pricing_breakdown_snapshot = jsonb_set(COALESCE(pricing_breakdown_snapshot,'{}'::jsonb), '{shadow}', v_snapshot, true),
           pricing_needs_recalculation = false,
           pricing_last_calculated_at = now()
     WHERE id = p_proposal_id;
    RETURN jsonb_build_object('ok', true, 'frozen', true, 'approval_snapshot', v_approval_snapshot, 'shadow', v_snapshot);
  END IF;

  UPDATE public.proposals
     SET pricing_subtotal_items = v_subtotal_items,
         pricing_manual_discount_percent = v_manual_pct,
         pricing_manual_discount_amount = v_manual_amount,
         pricing_inventory_adjustment_amount = v_inventory_adj,
         pricing_base_amount = v_base_amount,
         pricing_dynamic_adjustment_percent = v_dyn_pct,
         pricing_dynamic_adjustment_amount = v_dyn_amount,
         pricing_effective_amount = v_effective_amount,
         pricing_payment_schedule_total = v_payment_schedule_total,
         pricing_erp_amount = v_erp_amount,
         pricing_approval_amount = v_approval_amount,
         pricing_breakdown_snapshot = v_snapshot,
         pricing_has_divergence = v_has_divergence,
         pricing_divergence_details = v_divergence_details,
         pricing_needs_recalculation = false,
         pricing_last_calculated_at = now(),
         dynamic_pricing_current_amount = CASE WHEN v_dyn_enabled THEN v_base_amount + v_dyn_amount ELSE dynamic_pricing_current_amount END,
         dynamic_pricing_status = CASE WHEN v_dyn_enabled THEN COALESCE(dynamic_pricing_status,'active') ELSE dynamic_pricing_status END
   WHERE id = p_proposal_id;

  RETURN jsonb_build_object('ok', true, 'snapshot', v_snapshot);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_proposal_pricing_ledger(uuid) TO authenticated, service_role;