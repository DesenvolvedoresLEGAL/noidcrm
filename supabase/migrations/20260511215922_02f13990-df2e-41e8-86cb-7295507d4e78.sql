
CREATE OR REPLACE FUNCTION public.sync_proposals_on_opportunity_lost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'lost' AND (OLD.status IS DISTINCT FROM 'lost') THEN
    UPDATE public.proposals
       SET status = 'rejected',
           declined_at = COALESCE(declined_at, now()),
           declined_reason = COALESCE(
             declined_reason,
             CASE
               WHEN NEW.lost_reason IS NOT NULL AND NEW.lost_reason <> ''
                 THEN 'Oportunidade marcada como perdida: ' || NEW.lost_reason
               ELSE 'Oportunidade marcada como perdida'
             END
           ),
           updated_at = now()
     WHERE opportunity_id = NEW.id
       AND status IN ('draft','sent')
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_proposals_on_opportunity_lost ON public.opportunities;
CREATE TRIGGER trg_sync_proposals_on_opportunity_lost
AFTER UPDATE OF status ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.sync_proposals_on_opportunity_lost();
