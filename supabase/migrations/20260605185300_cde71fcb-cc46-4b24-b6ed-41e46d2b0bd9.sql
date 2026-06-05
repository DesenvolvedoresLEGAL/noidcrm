-- Hardens stale detection for dynamic pricing auto-refresh.
-- Adds comparison against the displayed proposal amounts
-- (total_amount, payment_expected_amount) and against the persisted
-- pricing ledger effective_amount, so the RPC triggers a reapply whenever
-- the user-facing value drifts from the current tier — not only when the
-- internal snapshot tier_id changes.

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
  v_ledger_effective numeric;
  v_card_amount numeric;
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

  -- Frozen / non-editable proposals: no-op (preserve PDF approved, accepted SSoT)
  IF COALESCE(v_proposal.price_frozen_on_approval, false)
     OR v_proposal.status IN ('accepted', 'rejected', 'cancelled', 'archived')
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

  -- Active rule
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

  -- Tier vigente at server now()
  SELECT id, label, final_amount, ends_at
    INTO v_current_tier_id, v_current_label, v_current_amount, v_current_ends
    FROM public.proposal_dynamic_pricing_tiers
   WHERE pricing_rule_id = v_rule_id
     AND (starts_at IS NULL OR starts_at <= v_now)
     AND (ends_at   IS NULL OR ends_at   >= v_now)
   ORDER BY tier_order ASC
   LIMIT 1;

  -- Strict next tier
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
  v_ledger_effective := NULLIF(v_proposal.pricing_breakdown_snapshot->>'effective_amount','')::numeric;
  v_card_amount := COALESCE(v_proposal.payment_expected_amount, v_proposal.total_amount);

  IF v_current_tier_id IS NULL THEN
    v_warning := 'NO_CURRENT_TIER_AT_NOW';
    v_stale := v_persisted_tier IS NOT NULL;
  ELSE
    -- A proposta é considerada stale se QUALQUER um destes divergir:
    --   tier_id / ends_at vencido / current_amount persistido /
    --   ledger effective_amount / valor exibido no card (>R$0,01).
    v_stale :=
         (v_persisted_tier IS DISTINCT FROM v_current_tier_id)
      OR (v_persisted_ends IS NOT NULL AND v_persisted_ends < v_now)
      OR (v_proposal.dynamic_pricing_current_amount IS DISTINCT FROM v_current_amount)
      OR (v_ledger_effective IS NOT NULL
          AND v_current_amount IS NOT NULL
          AND abs(v_ledger_effective - v_current_amount) > 0.01)
      OR (v_card_amount IS NOT NULL
          AND v_current_amount IS NOT NULL
          AND abs(v_card_amount - v_current_amount) > 0.01)
      OR (NULLIF(v_proposal.dynamic_pricing_snapshot->>'current_amount','')::numeric
          IS DISTINCT FROM v_current_amount);
  END IF;

  IF v_stale THEN
    BEGIN
      v_apply_result := public.apply_dynamic_price_to_proposal(p_proposal_id, NULL);
      v_refreshed := true;
      PERFORM public.ensure_proposal_pricing_ready(p_proposal_id);
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

-- Manter grants (idempotente — anon segue revogado).
REVOKE EXECUTE ON FUNCTION public.ensure_proposal_dynamic_pricing_current(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_proposal_dynamic_pricing_current(uuid)
  TO authenticated, service_role;

-- Wrapper público: aceitar mais status ainda editáveis comercialmente.
CREATE OR REPLACE FUNCTION public.ensure_public_proposal_dynamic_pricing_current(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_proposal_id uuid;
  v_status text;
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) = 0 THEN
    RETURN jsonb_build_object(
      'refreshed', false,
      'source', 'invalid_token',
      'warning', 'token ausente'
    );
  END IF;

  SELECT p.id, p.status
    INTO v_proposal_id, v_status
  FROM public.proposals p
  WHERE p.public_token IS NOT NULL
    AND (
      p.public_token = p_token
      OR p.public_token = encode(extensions.digest(p_token, 'sha256'), 'hex')
    )
  LIMIT 1;

  IF v_proposal_id IS NULL THEN
    RETURN jsonb_build_object(
      'refreshed', false,
      'source', 'not_found',
      'warning', 'token inválido'
    );
  END IF;

  -- Bloqueia apenas o que está realmente congelado. Demais status comerciais
  -- (draft/open/aberta/sent/viewed/visualized/visualizada/pending/pending_approval)
  -- devem rodar o refresh. A RPC interna também valida price_frozen_on_approval.
  IF v_status IN ('accepted', 'rejected', 'cancelled', 'archived') THEN
    RETURN jsonb_build_object(
      'proposal_id', v_proposal_id,
      'refreshed', false,
      'source', 'frozen_or_closed',
      'warning', null
    );
  END IF;

  SELECT public.ensure_proposal_dynamic_pricing_current(v_proposal_id)
    INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'proposal_id', v_proposal_id,
    'refreshed', false,
    'source', 'no_result',
    'warning', null
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_public_proposal_dynamic_pricing_current(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_public_proposal_dynamic_pricing_current(text)
  TO anon, authenticated, service_role;