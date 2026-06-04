
-- DYNAMIC PRICING AUTO-REFRESH
-- Idempotent RPC that ensures the persisted dynamic pricing snapshot
-- matches the tier vigente at server now(). If stale, it re-applies the
-- canonical value via apply_dynamic_price_to_proposal and refreshes the
-- pricing ledger. No-op for accepted/rejected/frozen/deleted proposals
-- and for proposals without active dynamic pricing.

CREATE OR REPLACE FUNCTION public.ensure_proposal_dynamic_pricing_current(
  p_proposal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_rule_id uuid;
  v_rule_enabled boolean;
  v_rule_status text;
  v_now timestamptz := now();
  v_persisted_tier uuid;
  v_persisted_ends timestamptz;
  v_current_tier_id uuid;
  v_current_label text;
  v_current_amount numeric;
  v_current_ends timestamptz;
  v_next_tier_id uuid;
  v_next_amount numeric;
  v_next_starts timestamptz;
  v_stale boolean := false;
  v_refreshed boolean := false;
  v_apply_result jsonb;
  v_warning text := NULL;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'proposal_id', p_proposal_id,
      'refreshed', false,
      'source', 'not_found',
      'warning', 'PROPOSAL_NOT_FOUND'
    );
  END IF;

  -- Skip frozen / non-editable proposals
  IF COALESCE(v_proposal.price_frozen_on_approval, false)
     OR v_proposal.status IN ('accepted', 'rejected')
     OR v_proposal.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'proposal_id', p_proposal_id,
      'refreshed', false,
      'source', 'frozen_or_closed',
      'current_amount', v_proposal.dynamic_pricing_current_amount,
      'current_tier_id', v_proposal.dynamic_pricing_snapshot->>'current_tier_id',
      'current_tier_name', v_proposal.dynamic_pricing_snapshot->>'current_label',
      'current_tier_valid_until', v_proposal.dynamic_pricing_snapshot->>'current_ends_at',
      'next_tier_amount', NULLIF(v_proposal.dynamic_pricing_snapshot->>'next_amount','')::numeric,
      'next_tier_starts_at', v_proposal.dynamic_pricing_snapshot->>'next_starts_at',
      'warning', NULL
    );
  END IF;

  -- Find active rule
  SELECT id, enabled, status
    INTO v_rule_id, v_rule_enabled, v_rule_status
    FROM public.proposal_dynamic_pricing_rules
    WHERE proposal_id = p_proposal_id
    LIMIT 1;

  IF v_rule_id IS NULL
     OR COALESCE(v_rule_enabled, false) = false
     OR v_rule_status NOT IN ('active') THEN
    RETURN jsonb_build_object(
      'proposal_id', p_proposal_id,
      'refreshed', false,
      'source', 'no_active_rule',
      'warning', NULL
    );
  END IF;

  -- Determine which tier covers now() according to wall-clock boundaries
  SELECT id, label, final_amount, starts_at, ends_at
    INTO v_current_tier_id, v_current_label, v_current_amount, v_current_ends, v_current_ends
    FROM public.proposal_dynamic_pricing_tiers
   WHERE pricing_rule_id = v_rule_id
     AND (starts_at IS NULL OR starts_at <= v_now)
     AND (ends_at   IS NULL OR ends_at   >= v_now)
   ORDER BY tier_order ASC
   LIMIT 1;

  -- Reset and re-fetch correct columns (the previous SELECT overwrote v_current_ends twice; fix):
  SELECT id, label, final_amount, ends_at
    INTO v_current_tier_id, v_current_label, v_current_amount, v_current_ends
    FROM public.proposal_dynamic_pricing_tiers
   WHERE pricing_rule_id = v_rule_id
     AND (starts_at IS NULL OR starts_at <= v_now)
     AND (ends_at   IS NULL OR ends_at   >= v_now)
   ORDER BY tier_order ASC
   LIMIT 1;

  -- Next tier (strictly future)
  SELECT id, final_amount, starts_at
    INTO v_next_tier_id, v_next_amount, v_next_starts
    FROM public.proposal_dynamic_pricing_tiers
   WHERE pricing_rule_id = v_rule_id
     AND starts_at IS NOT NULL
     AND starts_at > v_now
   ORDER BY starts_at ASC
   LIMIT 1;

  v_persisted_tier := NULLIF(v_proposal.dynamic_pricing_snapshot->>'current_tier_id','')::uuid;
  v_persisted_ends := NULLIF(v_proposal.dynamic_pricing_snapshot->>'current_ends_at','')::timestamptz;

  IF v_current_tier_id IS NULL THEN
    -- No tier covers now(): rule may be exhausted / future / pre-event
    v_warning := 'NO_CURRENT_TIER_AT_NOW';
    v_stale := v_persisted_tier IS NOT NULL;
  ELSE
    v_stale := (v_persisted_tier IS DISTINCT FROM v_current_tier_id)
            OR (v_persisted_ends IS NOT NULL AND v_persisted_ends < v_now)
            OR (v_proposal.dynamic_pricing_current_amount IS DISTINCT FROM v_current_amount);
  END IF;

  IF v_stale THEN
    BEGIN
      v_apply_result := public.apply_dynamic_price_to_proposal(p_proposal_id, NULL);
      v_refreshed := true;
      -- Refresh the pricing ledger so payment schedule + breakdown follow
      PERFORM public.ensure_proposal_pricing_ready(p_proposal_id);
      -- Re-read proposal for canonical fields
      SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
    EXCEPTION WHEN OTHERS THEN
      v_warning := 'APPLY_FAILED: ' || SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'proposal_id', p_proposal_id,
    'refreshed', v_refreshed,
    'current_amount', COALESCE(v_proposal.dynamic_pricing_current_amount, v_current_amount),
    'current_tier_id', COALESCE(v_proposal.dynamic_pricing_snapshot->>'current_tier_id', v_current_tier_id::text),
    'current_tier_name', COALESCE(v_proposal.dynamic_pricing_snapshot->>'current_label', v_current_label),
    'current_tier_valid_until', COALESCE(v_proposal.dynamic_pricing_snapshot->>'current_ends_at', v_current_ends::text),
    'next_tier_amount', COALESCE(NULLIF(v_proposal.dynamic_pricing_snapshot->>'next_amount','')::numeric, v_next_amount),
    'next_tier_starts_at', COALESCE(v_proposal.dynamic_pricing_snapshot->>'next_starts_at', v_next_starts::text),
    'last_calculated_at', v_proposal.dynamic_pricing_last_calculated_at,
    'source', CASE WHEN v_refreshed THEN 'reapplied' ELSE 'up_to_date' END,
    'warning', v_warning,
    'snapshot', v_proposal.dynamic_pricing_snapshot
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_proposal_dynamic_pricing_current(uuid)
  TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.ensure_proposal_dynamic_pricing_current(uuid) IS
  'Idempotent: detecta tier vigente em server now() e reaplica preço dinâmico + ledger se stale. No-op para propostas aceitas/rejeitadas/congeladas/deletadas. Pode ser chamado por anon (link público) — sempre via security definer.';
