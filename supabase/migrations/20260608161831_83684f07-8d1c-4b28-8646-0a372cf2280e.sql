
-- FREEZE-ON-APPROVAL GUARD
-- Impede mutações em proposal_payment_terms quando a proposta está aprovada
-- e congelada (price_frozen_on_approval = true). Reabrir a proposta via
-- fluxo administrativo (que limpa price_frozen_on_approval) é o caminho
-- correto para qualquer edição legítima pós-aceite.

CREATE OR REPLACE FUNCTION public.guard_proposal_payment_terms_frozen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id uuid;
  v_status text;
  v_frozen boolean;
BEGIN
  v_target_id := COALESCE(NEW.proposal_id, OLD.proposal_id);
  IF v_target_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT p.status, COALESCE(p.price_frozen_on_approval, false)
    INTO v_status, v_frozen
    FROM public.proposals p
   WHERE p.id = v_target_id;

  IF v_frozen IS TRUE AND v_status = 'accepted' THEN
    RAISE EXCEPTION
      'Proposta aprovada e congelada — termos de pagamento não podem ser alterados. Reabra a proposta antes de editar.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_proposal_payment_terms_frozen ON public.proposal_payment_terms;

CREATE TRIGGER trg_guard_proposal_payment_terms_frozen
BEFORE INSERT OR UPDATE OR DELETE ON public.proposal_payment_terms
FOR EACH ROW
EXECUTE FUNCTION public.guard_proposal_payment_terms_frozen();

COMMENT ON FUNCTION public.guard_proposal_payment_terms_frozen() IS
  'FREEZE-ON-APPROVAL: bloqueia INSERT/UPDATE/DELETE em proposal_payment_terms quando a proposta está aprovada e congelada. Garante que o link público mostre exatamente o que o cliente aprovou.';
