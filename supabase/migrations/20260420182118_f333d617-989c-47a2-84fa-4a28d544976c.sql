
CREATE OR REPLACE FUNCTION public.tg_ai_agent_run_fill_opportunity_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.opportunity_id IS NULL THEN
    NEW.opportunity_id := COALESCE(
      NULLIF(NEW.context_snapshot_json->'opportunity'->>'id','')::uuid,
      CASE WHEN NEW.entity_type = 'opportunity' THEN NEW.entity_id END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_agent_run_fill_opportunity_id ON public.ai_agent_execution_runs;
CREATE TRIGGER trg_ai_agent_run_fill_opportunity_id
BEFORE INSERT OR UPDATE ON public.ai_agent_execution_runs
FOR EACH ROW
EXECUTE FUNCTION public.tg_ai_agent_run_fill_opportunity_id();

-- Re-run backfill once trigger exists
UPDATE public.ai_agent_execution_runs SET opportunity_id = opportunity_id WHERE opportunity_id IS NULL AND (entity_type='opportunity' OR context_snapshot_json ? 'opportunity');
