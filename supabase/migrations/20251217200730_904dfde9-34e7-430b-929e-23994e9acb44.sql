-- Corrigir o trigger incluindo a coluna action
CREATE OR REPLACE FUNCTION public.trigger_extract_memories_from_win_loss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO system_events (
    organization_id,
    event_type,
    event_category,
    entity_type,
    entity_id,
    actor_type,
    action,
    payload
  ) VALUES (
    NEW.organization_id,
    'memory_extraction_requested',
    'ai',
    'win_loss_record',
    NEW.id,
    'system',
    'memory_extraction_requested',
    jsonb_build_object(
      'outcome', NEW.outcome,
      'reason_id', NEW.reason_id,
      'win_reason_id', NEW.win_reason_id,
      'objections_faced', NEW.objections_faced,
      'strengths_mentioned', NEW.strengths_mentioned,
      'weaknesses_mentioned', NEW.weaknesses_mentioned,
      'lessons_learned', NEW.lessons_learned,
      'key_differentiator', NEW.key_differentiator,
      'customer_feedback', NEW.customer_feedback
    )
  );
  
  RETURN NEW;
END;
$function$;