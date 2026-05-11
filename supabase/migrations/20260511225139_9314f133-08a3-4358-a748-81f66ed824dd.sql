CREATE OR REPLACE FUNCTION public.sync_proposals_on_opportunity_lost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason_text text;
BEGIN
  IF NEW.status = 'lost' AND (OLD.status IS DISTINCT FROM 'lost') THEN
    SELECT name INTO v_reason_text FROM public.loss_reasons WHERE id = NEW.loss_reason_id;

    UPDATE public.proposals
       SET status = 'rejected',
           declined_at = COALESCE(declined_at, now()),
           declined_reason = COALESCE(
             declined_reason,
             CASE
               WHEN NEW.loss_comment IS NOT NULL AND NEW.loss_comment <> ''
                 THEN 'Oportunidade marcada como perdida: ' || NEW.loss_comment
               WHEN v_reason_text IS NOT NULL
                 THEN 'Oportunidade marcada como perdida: ' || v_reason_text
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