CREATE OR REPLACE FUNCTION public.track_opportunity_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.prospect_id IS NOT NULL AND NEW.playbook_run_id IS NOT NULL THEN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id OR OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO run_events (workspace_id, playbook_run_id, level, message, payload)
      VALUES (
        NEW.organization_id,
        NEW.playbook_run_id,
        'feedback',
        CASE
          WHEN NEW.status = 'won' THEN 'Oportunidade ganha'
          WHEN NEW.status = 'lost' THEN 'Oportunidade perdida'
          ELSE 'Oportunidade avançou de estágio'
        END,
        jsonb_build_object(
          'opportunity_id', NEW.id,
          'old_stage_id', OLD.stage_id,
          'new_stage_id', NEW.stage_id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'valor_previsto', NEW.valor_previsto
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunity_feedback
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.track_opportunity_feedback();