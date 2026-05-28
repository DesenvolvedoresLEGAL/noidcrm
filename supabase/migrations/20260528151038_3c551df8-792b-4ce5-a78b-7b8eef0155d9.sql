-- 1) BACKFILL: restaura approved_amount ao valor real do cronograma aprovado
--    nas propostas aceitas contaminadas por reaplicação de dynamic pricing.
WITH frozen AS (
  SELECT p.id,
    (SELECT COALESCE(SUM((x->>'amount')::numeric),0)
     FROM jsonb_array_elements(
       CASE
         WHEN jsonb_typeof(p.approved_payment_schedule->'schedule')='array' THEN p.approved_payment_schedule->'schedule'
         WHEN jsonb_typeof(p.approved_payment_schedule)='array' THEN p.approved_payment_schedule
         ELSE '[]'::jsonb
       END
     ) x) AS schedule_sum
  FROM public.proposals p
  WHERE p.status='accepted' AND p.deleted_at IS NULL
)
UPDATE public.proposals p
   SET approved_amount = f.schedule_sum
  FROM frozen f
 WHERE p.id = f.id
   AND f.schedule_sum > 0
   AND ABS(p.approved_amount - f.schedule_sum) > 0.5;

-- 2) GUARD TRIGGER: após status='accepted', bloqueia mudanças em
--    approved_amount, approved_payment_schedule e approval_snapshot
--    feitas por código que não seja explicitamente um admin reset.
--    Isso impede que orchestrators de pricing contaminem o valor aprovado.
CREATE OR REPLACE FUNCTION public.guard_frozen_approval_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass boolean := false;
BEGIN
  -- Aplicação só faz sentido para proposta JÁ aceita anteriormente.
  IF OLD.status IS DISTINCT FROM 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Permite reset administrativo via setting de sessão
  -- (set_config('app.allow_frozen_overwrite','true',true) dentro de RPC admin).
  BEGIN
    v_bypass := current_setting('app.allow_frozen_overwrite', true) = 'true';
  EXCEPTION WHEN OTHERS THEN
    v_bypass := false;
  END;
  IF v_bypass THEN
    RETURN NEW;
  END IF;

  -- Restaura silenciosamente campos congelados se forem alterados.
  IF NEW.approved_amount IS DISTINCT FROM OLD.approved_amount THEN
    NEW.approved_amount := OLD.approved_amount;
  END IF;
  IF NEW.approved_payment_schedule IS DISTINCT FROM OLD.approved_payment_schedule THEN
    NEW.approved_payment_schedule := OLD.approved_payment_schedule;
  END IF;
  IF NEW.approval_snapshot IS DISTINCT FROM OLD.approval_snapshot THEN
    NEW.approval_snapshot := OLD.approval_snapshot;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_frozen_approval_amount ON public.proposals;
CREATE TRIGGER trg_guard_frozen_approval_amount
BEFORE UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.guard_frozen_approval_amount();

COMMENT ON FUNCTION public.guard_frozen_approval_amount() IS
  'FROZEN APPROVAL GUARD: impede sobrescrita de approved_amount / approved_payment_schedule / approval_snapshot após aceite. Permite override apenas via SET LOCAL app.allow_frozen_overwrite=true (admin reset).';
