CREATE OR REPLACE FUNCTION public.reset_proposal_approval_state(p_proposal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prop public.proposals%ROWTYPE;
  v_recalc jsonb;
BEGIN
  SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
  IF v_prop.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'proposal_not_found');
  END IF;

  -- Reabertura administrativa: precisa passar pelo guard_frozen_approval_amount,
  -- que caso contrário restaura silenciosamente os campos congelados e faz o
  -- update posterior de status falhar com stale_approval_state.
  PERFORM set_config('app.allow_frozen_overwrite', 'true', true);

  UPDATE public.proposals SET
    price_frozen_on_approval = false,
    approved_amount = NULL,
    approved_payment_schedule = '{}'::jsonb,
    approved_dynamic_pricing_tier_id = NULL,
    approval_snapshot = '{}'::jsonb,
    pricing_needs_recalculation = true,
    updated_at = now()
  WHERE id = p_proposal_id;

  v_recalc := public.recalculate_proposal_pricing_ledger(p_proposal_id);

  PERFORM set_config('app.allow_frozen_overwrite', 'false', true);

  RETURN jsonb_build_object('ok', true, 'recalc', v_recalc);
END;
$function$;