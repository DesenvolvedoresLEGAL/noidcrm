
-- Corrigir a trigger log_opportunity_revenue_event para não referenciar o campo mrr inexistente
CREATE OR REPLACE FUNCTION public.log_opportunity_revenue_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Criação de oportunidade
  IF TG_OP = 'INSERT' THEN
    INSERT INTO revenue_events (
      organization_id, account_id, contact_id, opportunity_id, user_id,
      channel, event_type, event_subtype, payload, source
    ) VALUES (
      NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, NEW.owner_user_id,
      'system', 'opportunity_created', NULL,
      jsonb_build_object('title', NEW.title, 'value', NEW.valor_previsto, 'stage_id', NEW.stage_id),
      'automation'
    );
    RETURN NEW;
  END IF;
  
  -- Atualização de oportunidade
  IF TG_OP = 'UPDATE' THEN
    -- Mudança de estágio
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, source
      ) VALUES (
        NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, auth.uid(),
        'system', 'stage_change', NULL,
        jsonb_build_object('old_stage', OLD.stage_id, 'new_stage', NEW.stage_id),
        'automation'
      );
    END IF;
    
    -- Ganho - REMOVIDO referência a NEW.mrr que não existe
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'won' THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, revenue_impact, source
      ) VALUES (
        NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, auth.uid(),
        'system', 'win', NULL,
        jsonb_build_object('value', NEW.valor_previsto),
        NEW.valor_previsto,
        'automation'
      );
    END IF;
    
    -- Perda
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'lost' THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, revenue_impact, source
      ) VALUES (
        NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, auth.uid(),
        'system', 'loss', NULL,
        jsonb_build_object('value', NEW.valor_previsto, 'loss_reason', NEW.loss_reason_id),
        -COALESCE(NEW.valor_previsto, 0),
        'automation'
      );
    END IF;
    
    -- Mudança de valor
    IF OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, revenue_impact, source
      ) VALUES (
        NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, auth.uid(),
        'system', 'value_change', NULL,
        jsonb_build_object('old_value', OLD.valor_previsto, 'new_value', NEW.valor_previsto),
        COALESCE(NEW.valor_previsto, 0) - COALESCE(OLD.valor_previsto, 0),
        'automation'
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;
