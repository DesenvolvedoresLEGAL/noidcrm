-- Corrigir a função log_ai_score_event para validar UUID antes do cast
CREATE OR REPLACE FUNCTION public.log_ai_score_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO timeline_events (
    organization_id,
    opportunity_id,
    type,
    activity_type,
    title,
    actor_user_id,
    metadata,
    timestamp
  ) VALUES (
    NEW.organization_id,
    CASE 
      WHEN NEW.entity_type = 'opportunity' AND NEW.entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN NEW.entity_id::uuid 
      ELSE NULL 
    END,
    'ai',
    'ai_score_generated',
    'Inteligência IA gerada',
    NULL,
    jsonb_build_object(
      'score_type', NEW.score_type,
      'score', NEW.score,
      'grade', NEW.grade,
      'confidence', NEW.confidence,
      'explanation', NEW.explanation
    ),
    now()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;