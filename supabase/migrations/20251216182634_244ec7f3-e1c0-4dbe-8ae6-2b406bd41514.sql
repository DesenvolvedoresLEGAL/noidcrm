-- ===========================================
-- FIX: Corrigir trigger log_workflow_system_events
-- ===========================================

-- Substituir result_data por actions_executed que é a coluna correta
CREATE OR REPLACE FUNCTION public.log_workflow_system_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_system_event(
      NEW.trace_id, NEW.organization_id,
      'automation', NULL,
      'workflow.triggered', 'automation', 'trigger',
      'opportunity', NEW.opportunity_id,
      jsonb_build_object(
        'workflow_rule_id', NEW.workflow_rule_id,
        'trigger_type', NEW.trigger_type,
        'trigger_data', NEW.trigger_data
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM log_system_event(
        NEW.trace_id, NEW.organization_id,
        'automation', NULL,
        'workflow.' || NEW.status, 'automation', NEW.status,
        'opportunity', NEW.opportunity_id,
        jsonb_build_object(
          'workflow_rule_id', NEW.workflow_rule_id,
          'execution_id', NEW.id,
          'actions_executed', NEW.actions_executed
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ===========================================
-- SISTEMA ANTI-DUPLICAÇÃO DE AUTOMAÇÕES
-- ===========================================

-- 1. Adicionar campos de controle ao workflow_executions
ALTER TABLE workflow_executions 
ADD COLUMN IF NOT EXISTS execution_hash TEXT,
ADD COLUMN IF NOT EXISTS process_count INTEGER DEFAULT 0;

-- Criar índice para o hash
CREATE INDEX IF NOT EXISTS idx_workflow_executions_hash ON workflow_executions(execution_hash);

-- 2. Índice para consultas de deduplicação
CREATE INDEX IF NOT EXISTS idx_workflow_executions_dedup 
ON workflow_executions(workflow_rule_id, opportunity_id, status);

-- 3. Modificar a função trigger para prevenir execuções duplicadas
CREATE OR REPLACE FUNCTION public.check_workflow_on_opportunity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trigger_type workflow_trigger_type;
  v_hash TEXT;
BEGIN
  -- Determine trigger type based on change
  IF TG_OP = 'INSERT' THEN
    v_trigger_type := 'opportunity_created';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Stage change
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      -- Check for stage_enter triggers for new stage
      INSERT INTO workflow_executions (
        workflow_rule_id, organization_id, opportunity_id, trigger_type, trigger_data, status, execution_hash
      )
      SELECT 
        wr.id, 
        wr.organization_id, 
        NEW.id, 
        'stage_enter',
        jsonb_build_object(
          'old_stage_id', OLD.stage_id,
          'new_stage_id', NEW.stage_id,
          'pipeline_id', NEW.pipeline_id
        ),
        'pending',
        md5(wr.id::text || NEW.id::text || 'stage_enter' || NEW.stage_id::text)
      FROM workflow_rules wr
      WHERE wr.organization_id = NEW.organization_id
        AND wr.is_active = true
        AND wr.trigger_type = 'stage_enter'
        AND (wr.trigger_config->>'stage_id' = NEW.stage_id OR wr.trigger_config->>'stage_id' IS NULL)
        AND (wr.trigger_config->>'pipeline_id' = NEW.pipeline_id OR wr.trigger_config->>'pipeline_id' IS NULL)
        -- PREVENÇÃO DE DUPLICATAS
        AND NOT EXISTS (
          SELECT 1 FROM workflow_executions we
          WHERE we.workflow_rule_id = wr.id
            AND we.opportunity_id = NEW.id
            AND we.status IN ('pending', 'running')
            AND we.trigger_data->>'new_stage_id' = NEW.stage_id
        );
    END IF;
    
    -- Status change to won
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'won' THEN
      INSERT INTO workflow_executions (
        workflow_rule_id, organization_id, opportunity_id, trigger_type, trigger_data, status, execution_hash
      )
      SELECT 
        wr.id, 
        wr.organization_id, 
        NEW.id, 
        'opportunity_won',
        jsonb_build_object('pipeline_id', NEW.pipeline_id, 'valor_previsto', NEW.valor_previsto),
        'pending',
        md5(wr.id::text || NEW.id::text || 'opportunity_won')
      FROM workflow_rules wr
      WHERE wr.organization_id = NEW.organization_id
        AND wr.is_active = true
        AND wr.trigger_type = 'opportunity_won'
        AND (wr.trigger_config->>'pipeline_id' = NEW.pipeline_id OR wr.trigger_config->>'pipeline_id' IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM workflow_executions we
          WHERE we.workflow_rule_id = wr.id
            AND we.opportunity_id = NEW.id
            AND we.status IN ('pending', 'running')
            AND we.trigger_type = 'opportunity_won'
        );
    END IF;
    
    -- Status change to lost
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'lost' THEN
      INSERT INTO workflow_executions (
        workflow_rule_id, organization_id, opportunity_id, trigger_type, trigger_data, status, execution_hash
      )
      SELECT 
        wr.id, 
        wr.organization_id, 
        NEW.id, 
        'opportunity_lost',
        jsonb_build_object('pipeline_id', NEW.pipeline_id, 'loss_reason_id', NEW.loss_reason_id),
        'pending',
        md5(wr.id::text || NEW.id::text || 'opportunity_lost')
      FROM workflow_rules wr
      WHERE wr.organization_id = NEW.organization_id
        AND wr.is_active = true
        AND wr.trigger_type = 'opportunity_lost'
        AND (wr.trigger_config->>'pipeline_id' = NEW.pipeline_id OR wr.trigger_config->>'pipeline_id' IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM workflow_executions we
          WHERE we.workflow_rule_id = wr.id
            AND we.opportunity_id = NEW.id
            AND we.status IN ('pending', 'running')
            AND we.trigger_type = 'opportunity_lost'
        );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4. Limpar atividades duplicadas existentes (manter a mais antiga)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY opportunity_id, title 
      ORDER BY created_at ASC
    ) as rn
  FROM activities
  WHERE is_automated = true 
    AND status = 'pending'
)
DELETE FROM activities 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 5. Marcar workflow_executions pendentes duplicadas como failed
WITH duplicate_executions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workflow_rule_id, opportunity_id, trigger_type 
      ORDER BY created_at ASC
    ) as rn
  FROM workflow_executions
  WHERE status = 'pending'
)
UPDATE workflow_executions
SET status = 'failed', 
    completed_at = now(),
    actions_executed = jsonb_build_array(jsonb_build_object('error', 'Marked as duplicate during cleanup'))
WHERE id IN (SELECT id FROM duplicate_executions WHERE rn > 1);