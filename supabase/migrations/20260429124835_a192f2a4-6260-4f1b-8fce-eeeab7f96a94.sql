CREATE OR REPLACE FUNCTION public.trg_enqueue_indicators_from_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR NEW.stage_id IS DISTINCT FROM OLD.stage_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.valor_previsto IS DISTINCT FROM OLD.valor_previsto
     OR NEW.prob IS DISTINCT FROM OLD.prob
     OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.won_at IS DISTINCT FROM OLD.won_at
     OR NEW.lost_at IS DISTINCT FROM OLD.lost_at
     OR NEW.opportunity_score IS DISTINCT FROM OLD.opportunity_score
  THEN
    PERFORM public.enqueue_opportunity_indicators_recalc(
      NEW.id, NEW.organization_id, NEW.account_id,
      'opportunities_trigger', TG_OP
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_enqueue_indicators_from_opportunity() FROM anon, authenticated, public;