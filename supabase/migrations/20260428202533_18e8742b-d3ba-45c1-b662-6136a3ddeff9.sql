-- 1. Adicionar coluna accepted_at em acceptance_effect_jobs
ALTER TABLE public.acceptance_effect_jobs
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- 2. Backfill com proposals.accepted_at
UPDATE public.acceptance_effect_jobs j
   SET accepted_at = p.accepted_at
  FROM public.proposals p
 WHERE p.id = j.proposal_id AND j.accepted_at IS NULL;

-- 3. Trocar unique de (proposal_id) -> (proposal_id, accepted_at)
ALTER TABLE public.acceptance_effect_jobs
  DROP CONSTRAINT IF EXISTS acceptance_effect_jobs_proposal_id_key;

DROP INDEX IF EXISTS public.acceptance_effect_jobs_proposal_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS acceptance_effect_jobs_proposal_acceptance_uq
  ON public.acceptance_effect_jobs (proposal_id, accepted_at);

-- 4. Atualizar trigger para suportar re-aceitação
CREATE OR REPLACE FUNCTION public.enqueue_acceptance_effect_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_reacceptance boolean := false;
BEGIN
  IF NEW.status = 'accepted' AND NEW.accepted_at IS NOT NULL THEN
    -- Primeira aceitação OU mudança de accepted_at em status já 'accepted'
    IF (TG_OP = 'INSERT')
       OR (OLD.status IS DISTINCT FROM 'accepted')
       OR (OLD.accepted_at IS DISTINCT FROM NEW.accepted_at)
    THEN
      -- Detectar re-aceitação para auditoria
      IF TG_OP = 'UPDATE'
         AND OLD.status = 'accepted'
         AND OLD.accepted_at IS DISTINCT FROM NEW.accepted_at
         AND OLD.accepted_at IS NOT NULL
      THEN
        v_is_reacceptance := true;
      END IF;

      INSERT INTO public.acceptance_effect_jobs (proposal_id, organization_id, opportunity_id, accepted_at)
      VALUES (NEW.id, NEW.organization_id, NEW.opportunity_id, NEW.accepted_at)
      ON CONFLICT (proposal_id, accepted_at) DO NOTHING;

      -- Log auditoria de re-aceitação
      IF v_is_reacceptance THEN
        BEGIN
          INSERT INTO public.system_events (
            event_type, event_category, action,
            entity_type, entity_id,
            organization_id, actor_type, payload
          ) VALUES (
            'proposal.reaccepted', 'lifecycle', 'enqueued',
            'proposal', NEW.id,
            NEW.organization_id, 'trigger',
            jsonb_build_object(
              'previous_accepted_at', OLD.accepted_at,
              'new_accepted_at', NEW.accepted_at,
              'opportunity_id', NEW.opportunity_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- não falhar o trigger se system_events tiver schema diferente
          NULL;
        END;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;