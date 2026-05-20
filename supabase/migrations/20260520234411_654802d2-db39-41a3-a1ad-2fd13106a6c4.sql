CREATE OR REPLACE FUNCTION public.run_proposal_financial_audit(p_period_start date, p_period_end date, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_user uuid; v_run_id uuid; v_proposal record;
  v_intent_expected numeric; v_erp_payload jsonb;
  v_slack_amount numeric; v_slack_payload jsonb;
  v_deal_amount numeric; v_ledger_effective numeric; v_ledger_erp numeric;
  v_payment_schedule_total numeric; v_approval_snapshot jsonb; v_snap_amount numeric;
  v_reconstructed numeric; v_max_delta numeric;
  v_canonical numeric; v_canonical_source text;
  v_div text[]; v_audit_status text; v_action text;
  v_total int := 0; v_ok int := 0; v_div_count int := 0; v_review_count int := 0;
  v_total_approved numeric := 0; v_total_delta numeric := 0;
  v_amounts numeric[]; v_a numeric; v_b numeric; v_i int; v_j int;
  v_approved_at timestamptz;
  v_items_total numeric;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN RAISE EXCEPTION 'no_organization'; END IF;
  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'owner')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  IF p_period_end < p_period_start THEN RAISE EXCEPTION 'invalid_period'; END IF;

  INSERT INTO public.proposal_financial_audit_runs(
    organization_id, period_start, period_end, status, dry_run, created_by
  ) VALUES (v_org, p_period_start, p_period_end, 'running', p_dry_run, v_user)
  RETURNING id INTO v_run_id;

  FOR v_proposal IN
    SELECT p.id, p.proposal_number, p.organization_id, p.opportunity_id, p.status,
           p.approval_snapshot, p.approved_amount, p.total_amount,
           COALESCE(p.accepted_at, p.signed_at, p.price_frozen_at, p.updated_at) AS approved_at,
           o.valor_previsto AS opp_value, o.status AS opp_status, o.id AS opp_id,
           o.title AS account_name
    FROM public.proposals p
    LEFT JOIN public.opportunities o ON o.id = p.opportunity_id
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND COALESCE(p.accepted_at, p.signed_at, p.price_frozen_at, p.updated_at)::date
          BETWEEN p_period_start AND p_period_end
  LOOP
    v_total := v_total + 1;
    v_div := ARRAY[]::text[]; v_reconstructed := NULL;
    v_approved_at := v_proposal.approved_at;

    v_slack_amount := NULL; v_slack_payload := NULL;
    BEGIN
      SELECT (ndl.provider_response->>'amount')::numeric, ndl.provider_response
        INTO v_slack_amount, v_slack_payload
        FROM public.notification_delivery_logs ndl
        JOIN public.notifications_v2 n ON n.id = ndl.notification_id
       WHERE ndl.channel::text = 'slack'
         AND (n.payload->>'proposal_id')::uuid = v_proposal.id
         AND (ndl.provider_response ? 'amount')
       ORDER BY ndl.attempted_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_slack_amount := NULL; END;

    v_deal_amount := v_proposal.opp_value;

    v_ledger_effective := NULL; v_ledger_erp := NULL;
    BEGIN
      SELECT effective_amount, erp_amount INTO v_ledger_effective, v_ledger_erp
        FROM public.proposal_pricing_ledger
       WHERE proposal_id = v_proposal.id
       ORDER BY created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_ledger_effective := NULL; END;

    v_items_total := NULL;
    BEGIN
      SELECT COALESCE(SUM(total),0) INTO v_items_total
        FROM public.proposal_items WHERE proposal_id = v_proposal.id;
    EXCEPTION WHEN OTHERS THEN v_items_total := NULL; END;

    v_payment_schedule_total := NULL;
    BEGIN
      SELECT COALESCE(SUM(amount),0) INTO v_payment_schedule_total
        FROM public.proposal_payment_schedule WHERE proposal_id = v_proposal.id;
    EXCEPTION WHEN OTHERS THEN v_payment_schedule_total := NULL; END;

    v_intent_expected := NULL;
    BEGIN
      SELECT expected_amount INTO v_intent_expected
        FROM public.proposal_payment_intents
       WHERE proposal_id = v_proposal.id
       ORDER BY created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_intent_expected := NULL; END;

    v_erp_payload := NULL;
    BEGIN
      SELECT payload INTO v_erp_payload
        FROM public.proposal_erp_sync_logs
       WHERE proposal_id = v_proposal.id
       ORDER BY created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_erp_payload := NULL; END;

    v_approval_snapshot := v_proposal.approval_snapshot;
    v_snap_amount := COALESCE(
      NULLIF(v_approval_snapshot->>'effective_amount','')::numeric,
      NULLIF(v_approval_snapshot->>'approved_amount','')::numeric,
      NULLIF(v_approval_snapshot->>'payment_expected_amount','')::numeric,
      NULLIF(v_approval_snapshot->'dynamic_pricing'->>'current_amount','')::numeric
    );

    v_canonical := NULL; v_canonical_source := NULL;
    IF v_snap_amount IS NOT NULL THEN
      v_canonical := v_snap_amount; v_canonical_source := 'approval_snapshot';
    ELSIF v_proposal.approved_amount IS NOT NULL THEN
      v_canonical := v_proposal.approved_amount; v_canonical_source := 'approved_amount';
    ELSIF v_payment_schedule_total IS NOT NULL AND v_payment_schedule_total > 0 THEN
      v_canonical := v_payment_schedule_total; v_canonical_source := 'approved_payment_schedule';
    ELSIF v_ledger_effective IS NOT NULL THEN
      v_canonical := v_ledger_effective; v_canonical_source := 'ledger';
      v_reconstructed := v_ledger_effective;
    ELSE v_canonical_source := 'indeterminate'; END IF;

    IF v_snap_amount IS NULL AND v_ledger_effective IS NOT NULL THEN
      v_reconstructed := v_ledger_effective; END IF;

    v_amounts := ARRAY[]::numeric[];
    IF v_canonical IS NOT NULL THEN v_amounts := array_append(v_amounts, v_canonical); END IF;
    IF v_deal_amount IS NOT NULL THEN v_amounts := array_append(v_amounts, v_deal_amount); END IF;
    IF v_proposal.total_amount IS NOT NULL THEN v_amounts := array_append(v_amounts, v_proposal.total_amount); END IF;
    IF v_proposal.approved_amount IS NOT NULL THEN v_amounts := array_append(v_amounts, v_proposal.approved_amount); END IF;
    IF v_items_total IS NOT NULL AND v_items_total > 0 THEN v_amounts := array_append(v_amounts, v_items_total); END IF;
    IF v_ledger_effective IS NOT NULL THEN v_amounts := array_append(v_amounts, v_ledger_effective); END IF;
    IF v_ledger_erp IS NOT NULL THEN v_amounts := array_append(v_amounts, v_ledger_erp); END IF;
    IF v_payment_schedule_total IS NOT NULL AND v_payment_schedule_total > 0 THEN v_amounts := array_append(v_amounts, v_payment_schedule_total); END IF;
    IF v_intent_expected IS NOT NULL THEN v_amounts := array_append(v_amounts, v_intent_expected); END IF;

    v_max_delta := 0;
    IF array_length(v_amounts,1) IS NOT NULL THEN
      FOR v_i IN 1..array_length(v_amounts,1) LOOP
        FOR v_j IN 1..array_length(v_amounts,1) LOOP
          v_a := v_amounts[v_i]; v_b := v_amounts[v_j];
          IF abs(v_a - v_b) > v_max_delta THEN v_max_delta := abs(v_a - v_b); END IF;
        END LOOP;
      END LOOP;
    END IF;

    IF v_slack_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_slack_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'slack_mismatch'); END IF;
    IF v_deal_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_deal_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'deal_mismatch'); END IF;
    IF v_proposal.total_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_proposal.total_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'proposal_total_mismatch'); END IF;
    IF v_proposal.approved_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_proposal.approved_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'approved_amount_mismatch'); END IF;
    IF v_items_total IS NOT NULL AND v_items_total > 0 AND v_canonical IS NOT NULL AND abs(v_items_total - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'items_mismatch'); END IF;
    IF v_ledger_effective IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_ledger_effective - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'ledger_effective_mismatch'); END IF;
    IF v_payment_schedule_total IS NOT NULL AND v_payment_schedule_total > 0 AND v_canonical IS NOT NULL AND abs(v_payment_schedule_total - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'schedule_mismatch'); END IF;
    IF v_intent_expected IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_intent_expected - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'payment_intent_mismatch'); END IF;

    IF v_canonical_source = 'indeterminate' THEN
      v_audit_status := 'needs_review'; v_action := 'manual_review';
      v_review_count := v_review_count + 1;
    ELSIF v_max_delta <= 0.01 AND array_length(v_div,1) IS NULL THEN
      v_audit_status := 'ok'; v_action := 'none'; v_ok := v_ok + 1;
    ELSE
      v_audit_status := 'divergent'; v_action := 'apply_safe'; v_div_count := v_div_count + 1;
    END IF;

    IF v_canonical IS NOT NULL THEN v_total_approved := v_total_approved + v_canonical; END IF;
    v_total_delta := v_total_delta + COALESCE(v_max_delta,0);

    INSERT INTO public.proposal_financial_audit_items(
      audit_run_id, organization_id, proposal_id, proposal_number, opportunity_id,
      account_name, proposal_status, opportunity_status, approved_at,
      slack_amount, deal_amount, proposal_total_amount,
      ledger_effective_amount, ledger_erp_amount,
      approved_amount, approval_snapshot_amount, payment_schedule_total,
      payment_intent_expected_amount, erp_sent_amount,
      reconstructed_ledger_amount,
      canonical_amount, canonical_source, max_delta, divergence_types,
      recommended_action, audit_status, raw_values
    ) VALUES (
      v_run_id, v_org, v_proposal.id, v_proposal.proposal_number, v_proposal.opportunity_id,
      v_proposal.account_name, v_proposal.status, v_proposal.opp_status, v_approved_at,
      v_slack_amount, v_deal_amount, v_proposal.total_amount,
      v_ledger_effective, v_ledger_erp,
      v_proposal.approved_amount, v_snap_amount, v_payment_schedule_total,
      v_intent_expected, NULLIF(v_erp_payload->>'amount','')::numeric,
      v_reconstructed,
      v_canonical, v_canonical_source, v_max_delta, v_div,
      v_action, v_audit_status,
      jsonb_build_object(
        'items_total', v_items_total,
        'slack_payload', v_slack_payload,
        'erp_payload', v_erp_payload,
        'approval_snapshot', v_approval_snapshot
      )
    );
  END LOOP;

  UPDATE public.proposal_financial_audit_runs
     SET status='completed', total_proposals=v_total, ok_count=v_ok,
         divergent_count=v_div_count, needs_review_count=v_review_count,
         total_approved_amount=v_total_approved,
         total_detected_delta=v_total_delta, completed_at=now()
   WHERE id=v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id, 'total', v_total, 'ok', v_ok,
    'divergent', v_div_count, 'needs_review', v_review_count,
    'total_delta', v_total_delta, 'dry_run', p_dry_run
  );
END;
$function$;