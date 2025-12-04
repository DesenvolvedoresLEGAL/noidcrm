-- Create function to track opportunity changes
CREATE OR REPLACE FUNCTION public.track_opportunity_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_user_id UUID;
  v_field_name TEXT;
  v_old_value JSONB;
  v_new_value JSONB;
BEGIN
  -- Get the current user from auth context (or use a default for system actions)
  v_actor_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    -- Log creation
    INSERT INTO public.audit_log (
      organization_id, actor_user_id, action, entity_type, entity_id, metadata
    ) VALUES (
      NEW.organization_id, v_actor_user_id, 'opportunity_created', 'opportunity', NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'valor_previsto', NEW.valor_previsto,
        'stage_id', NEW.stage_id
      )
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Track stage changes
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'stage_moved', 'opportunity', NEW.id,
        'stage_id', to_jsonb(OLD.stage_id), to_jsonb(NEW.stage_id)
      );
    END IF;
    
    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'status_changed', 'opportunity', NEW.id,
        'status', to_jsonb(OLD.status), to_jsonb(NEW.status)
      );
    END IF;
    
    -- Track title changes
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'title', to_jsonb(OLD.title), to_jsonb(NEW.title)
      );
    END IF;
    
    -- Track valor_previsto changes
    IF OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'valor_previsto', to_jsonb(OLD.valor_previsto), to_jsonb(NEW.valor_previsto)
      );
    END IF;
    
    -- Track probability changes
    IF OLD.prob IS DISTINCT FROM NEW.prob THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'prob', to_jsonb(OLD.prob), to_jsonb(NEW.prob)
      );
    END IF;
    
    -- Track temperature changes
    IF OLD.temperature IS DISTINCT FROM NEW.temperature THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'temperature', to_jsonb(OLD.temperature), to_jsonb(NEW.temperature)
      );
    END IF;
    
    -- Track close_date_prevista changes
    IF OLD.close_date_prevista IS DISTINCT FROM NEW.close_date_prevista THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'close_date_prevista', to_jsonb(OLD.close_date_prevista), to_jsonb(NEW.close_date_prevista)
      );
    END IF;
    
    -- Track owner changes
    IF OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'owner_user_id', to_jsonb(OLD.owner_user_id), to_jsonb(NEW.owner_user_id)
      );
    END IF;
    
    -- Track account changes
    IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'account_id', to_jsonb(OLD.account_id), to_jsonb(NEW.account_id)
      );
    END IF;
    
    -- Track contact changes
    IF OLD.contact_id IS DISTINCT FROM NEW.contact_id THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'contact_id', to_jsonb(OLD.contact_id), to_jsonb(NEW.contact_id)
      );
    END IF;
    
    -- Track loss_reason changes
    IF OLD.loss_reason_id IS DISTINCT FROM NEW.loss_reason_id THEN
      INSERT INTO public.audit_log (
        organization_id, actor_user_id, action, entity_type, entity_id, field_name, old_value, new_value
      ) VALUES (
        NEW.organization_id, v_actor_user_id, 'field_updated', 'opportunity', NEW.id,
        'loss_reason_id', to_jsonb(OLD.loss_reason_id), to_jsonb(NEW.loss_reason_id)
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (
      organization_id, actor_user_id, action, entity_type, entity_id, metadata
    ) VALUES (
      OLD.organization_id, v_actor_user_id, 'opportunity_deleted', 'opportunity', OLD.id,
      jsonb_build_object('title', OLD.title)
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for opportunities
DROP TRIGGER IF EXISTS track_opportunity_audit ON public.opportunities;
CREATE TRIGGER track_opportunity_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.track_opportunity_changes();