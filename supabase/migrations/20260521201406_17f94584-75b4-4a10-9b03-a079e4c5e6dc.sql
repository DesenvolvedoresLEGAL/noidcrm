
CREATE OR REPLACE FUNCTION public.reset_proposal_approval_state(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prop public.proposals%ROWTYPE;
  v_recalc jsonb;
BEGIN
  SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
  IF v_prop.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'proposal_not_found');
  END IF;

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

  RETURN jsonb_build_object('ok', true, 'recalc', v_recalc);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_proposal_approval_state(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_proposal_freeze_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.price_frozen_on_approval, false) = true
     AND NEW.status IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'invalid_freeze_state: proposta % com status % não pode estar com price_frozen_on_approval=true.', NEW.id, NEW.status;
  END IF;

  IF NEW.status IS DISTINCT FROM 'accepted' THEN
    IF NEW.approved_amount IS NOT NULL
       OR (NEW.approval_snapshot IS NOT NULL AND NEW.approval_snapshot <> '{}'::jsonb)
       OR (NEW.approved_payment_schedule IS NOT NULL AND NEW.approved_payment_schedule <> '{}'::jsonb)
       OR NEW.approved_dynamic_pricing_tier_id IS NOT NULL THEN
      IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'invalid_approval_state: proposta % com status % não pode carregar dados de aprovação.', NEW.id, NEW.status;
      END IF;
      IF (NEW.approved_amount IS NOT NULL AND NEW.approved_amount IS NOT DISTINCT FROM OLD.approved_amount)
         OR (NEW.approval_snapshot <> '{}'::jsonb AND NEW.approval_snapshot IS NOT DISTINCT FROM OLD.approval_snapshot)
         OR (NEW.approved_payment_schedule <> '{}'::jsonb AND NEW.approved_payment_schedule IS NOT DISTINCT FROM OLD.approved_payment_schedule) THEN
        RAISE EXCEPTION 'stale_approval_state: proposta % foi reaberta (status=%) mas mantém dados de aprovação anterior.', NEW.id, NEW.status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_proposal_freeze ON public.proposals;
CREATE TRIGGER trg_guard_proposal_freeze
BEFORE INSERT OR UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.guard_proposal_freeze_consistency();

SELECT public.reset_proposal_approval_state('8590d66f-1346-4498-8b2d-b6c8bf1a0c34'::uuid);
