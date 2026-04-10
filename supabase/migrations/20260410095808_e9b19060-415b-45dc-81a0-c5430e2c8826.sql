-- Fix the trigger to filter by stage_id and pipeline_id and add anti-duplication
CREATE OR REPLACE FUNCTION public.check_workflow_on_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Activity completed
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    INSERT INTO workflow_executions (
      workflow_rule_id, organization_id, opportunity_id, activity_id, trigger_type, trigger_data, status
    )
    SELECT 
      wr.id, wr.organization_id, NEW.opportunity_id, NEW.id, 'activity_completed',
      jsonb_build_object('activity_type', NEW.type, 'activity_title', NEW.title),
      'pending'
    FROM workflow_rules wr
    WHERE wr.organization_id = NEW.organization_id
      AND wr.is_active = true
      AND wr.trigger_type = 'activity_completed'
      AND NEW.opportunity_id IS NOT NULL
      AND (wr.trigger_config->>'activity_type' = NEW.type OR wr.trigger_config->>'activity_type' IS NULL)
      -- CRITICAL FIX: Filter by stage_id of the opportunity
      AND (
        wr.trigger_config->>'stage_id' IS NULL 
        OR wr.trigger_config->>'stage_id' = (
          SELECT o.stage_id::text FROM opportunities o WHERE o.id = NEW.opportunity_id
        )
      )
      -- CRITICAL FIX: Filter by pipeline_id of the opportunity
      AND (
        wr.trigger_config->>'pipeline_id' IS NULL 
        OR wr.trigger_config->>'pipeline_id' = (
          SELECT o.pipeline_id::text FROM opportunities o WHERE o.id = NEW.opportunity_id
        )
      )
      -- Anti-duplication: skip if pending/running execution already exists
      AND NOT EXISTS (
        SELECT 1 FROM workflow_executions we
        WHERE we.workflow_rule_id = wr.id
          AND we.opportunity_id = NEW.opportunity_id
          AND we.status IN ('pending', 'running')
      );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Clean up incorrectly created pending executions from activity_completed cascades
UPDATE workflow_executions we
SET status = 'failed', 
    completed_at = now(),
    actions_executed = jsonb_build_array(jsonb_build_object('skipped', true, 'reason', 'Stage mismatch - cleaned by migration'))
WHERE we.status = 'pending'
  AND we.trigger_type = 'activity_completed'
  AND we.opportunity_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM workflow_rules wr
    JOIN opportunities o ON o.id = we.opportunity_id
    WHERE wr.id = we.workflow_rule_id
      AND wr.trigger_config->>'stage_id' IS NOT NULL
      AND wr.trigger_config->>'stage_id' != o.stage_id::text
  );