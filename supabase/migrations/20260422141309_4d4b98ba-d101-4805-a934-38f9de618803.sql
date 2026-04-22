-- 1) Marca como lidas notificações v2 de vencimento/expiração de propostas
--    cuja oportunidade pai está perdida/ganha/excluída
UPDATE public.notifications_v2 n
SET read_at = COALESCE(n.read_at, now()),
    status = CASE WHEN n.status = 'pending' THEN 'dismissed' ELSE n.status END
FROM public.notification_events e
JOIN public.proposals p ON p.id = e.proposal_id
JOIN public.opportunities o ON o.id = p.opportunity_id
WHERE n.event_id = e.id
  AND n.type IN ('proposal_expiring', 'proposal_expiring_24h', 'proposal_expiring_48h', 'proposal_expired')
  AND n.read_at IS NULL
  AND (o.status <> 'open' OR o.deleted_at IS NOT NULL);

-- 2) Cancela atividades pendentes vinculadas a oportunidades já encerradas
UPDATE public.activities a
SET status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = COALESCE(a.cancellation_reason, 'Oportunidade encerrada — cancelada automaticamente')
FROM public.opportunities o
WHERE a.opportunity_id = o.id
  AND a.status = 'pending'
  AND (o.status <> 'open' OR o.deleted_at IS NOT NULL);

-- 3) Trigger: quando a oportunidade for marcada como won/lost (ou soft-deleted),
--    cancela atividades pendentes e dispensa notificações de vencimento de propostas associadas
CREATE OR REPLACE FUNCTION public.cleanup_on_opportunity_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('won', 'lost'))
     OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN

    UPDATE public.activities
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = COALESCE(cancellation_reason, 'Oportunidade encerrada — cancelada automaticamente')
    WHERE opportunity_id = NEW.id
      AND status = 'pending';

    UPDATE public.notifications_v2 n
    SET read_at = COALESCE(n.read_at, now()),
        status = CASE WHEN n.status = 'pending' THEN 'dismissed' ELSE n.status END
    FROM public.notification_events e
    JOIN public.proposals p ON p.id = e.proposal_id
    WHERE n.event_id = e.id
      AND p.opportunity_id = NEW.id
      AND n.type IN ('proposal_expiring', 'proposal_expiring_24h', 'proposal_expiring_48h', 'proposal_expired')
      AND n.read_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_on_opportunity_close ON public.opportunities;
CREATE TRIGGER trg_cleanup_on_opportunity_close
AFTER UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_on_opportunity_close();