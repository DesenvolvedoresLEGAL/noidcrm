-- Adicionar campos à tabela audit_log para rastreamento detalhado
ALTER TABLE public.audit_log 
ADD COLUMN IF NOT EXISTS entity_type TEXT,
ADD COLUMN IF NOT EXISTS entity_id UUID,
ADD COLUMN IF NOT EXISTS field_name TEXT,
ADD COLUMN IF NOT EXISTS old_value JSONB,
ADD COLUMN IF NOT EXISTS new_value JSONB;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Função para rastrear mudanças em opportunities
CREATE OR REPLACE FUNCTION public.track_opportunity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_field_name TEXT;
  v_old_value JSONB;
  v_new_value JSONB;
BEGIN
  -- Determinar tipo de ação
  IF TG_OP = 'INSERT' THEN
    v_action := 'opportunity_created';
    INSERT INTO public.audit_log (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      NEW.organization_id,
      NEW.owner_user_id,
      v_action,
      'opportunity',
      NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'valor_previsto', NEW.valor_previsto,
        'stage_id', NEW.stage_id
      )
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Rastrear mudanças específicas em campos importantes
    
    -- Título
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id,
        field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, NEW.owner_user_id, 'field_updated', 'opportunity', NEW.id,
        'title', to_jsonb(OLD.title), to_jsonb(NEW.title)
      );
    END IF;
    
    -- Valor previsto
    IF OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id,
        field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, NEW.owner_user_id, 'field_updated', 'opportunity', NEW.id,
        'valor_previsto', to_jsonb(OLD.valor_previsto), to_jsonb(NEW.valor_previsto)
      );
    END IF;
    
    -- Probabilidade
    IF OLD.prob IS DISTINCT FROM NEW.prob THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id,
        field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, NEW.owner_user_id, 'field_updated', 'opportunity', NEW.id,
        'prob', to_jsonb(OLD.prob), to_jsonb(NEW.prob)
      );
    END IF;
    
    -- Estágio
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id,
        field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, NEW.owner_user_id, 'stage_moved', 'opportunity', NEW.id,
        'stage_id', to_jsonb(OLD.stage_id), to_jsonb(NEW.stage_id)
      );
    END IF;
    
    -- Status (won/lost)
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id,
        field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, NEW.owner_user_id, 'status_changed', 'opportunity', NEW.id,
        'status', to_jsonb(OLD.status), to_jsonb(NEW.status)
      );
    END IF;
    
    -- Temperatura
    IF OLD.temperature IS DISTINCT FROM NEW.temperature THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id,
        field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, NEW.owner_user_id, 'field_updated', 'opportunity', NEW.id,
        'temperature', to_jsonb(OLD.temperature), to_jsonb(NEW.temperature)
      );
    END IF;
    
    -- Produto
    IF OLD.produto IS DISTINCT FROM NEW.produto THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id,
        field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, NEW.owner_user_id, 'field_updated', 'opportunity', NEW.id,
        'produto', to_jsonb(OLD.produto), to_jsonb(NEW.produto)
      );
    END IF;
    
    -- Data de fechamento prevista
    IF OLD.close_date_prevista IS DISTINCT FROM NEW.close_date_prevista THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id,
        field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, NEW.owner_user_id, 'field_updated', 'opportunity', NEW.id,
        'close_date_prevista', to_jsonb(OLD.close_date_prevista), to_jsonb(NEW.close_date_prevista)
      );
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'opportunity_deleted';
    INSERT INTO public.audit_log (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      OLD.organization_id,
      OLD.owner_user_id,
      v_action,
      'opportunity',
      OLD.id,
      jsonb_build_object('title', OLD.title)
    );
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Criar trigger para rastrear mudanças
DROP TRIGGER IF EXISTS track_opportunity_changes_trigger ON public.opportunities;
CREATE TRIGGER track_opportunity_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.track_opportunity_changes();