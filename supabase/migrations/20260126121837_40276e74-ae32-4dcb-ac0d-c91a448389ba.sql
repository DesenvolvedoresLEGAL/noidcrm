-- Fix: Prevent NULL message in notifications when proposal title is NULL
-- The trigger was failing because 'string' || NULL returns NULL in PostgreSQL

CREATE OR REPLACE FUNCTION notify_proposal_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_title TEXT;
BEGIN
  -- Get the opportunity owner
  v_user_id := (SELECT owner_user_id FROM opportunities WHERE id = NEW.opportunity_id);
  
  -- Use COALESCE to ensure we always have a valid title for the notification message
  v_title := COALESCE(NULLIF(TRIM(NEW.title), ''), NEW.proposal_number, 'Nova Proposta');
  
  -- Only create notification if we have a valid user
  IF v_user_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM create_system_notification(
        v_user_id,
        NEW.organization_id,
        'proposal_created',
        'Nova proposta criada',
        'Proposta "' || v_title || '" foi criada.',
        jsonb_build_object('proposal_id', NEW.id, 'title', v_title)
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM create_system_notification(
          v_user_id,
          NEW.organization_id,
          'proposal_status',
          CASE 
            WHEN NEW.status = 'accepted' THEN 'Proposta aceita!'
            WHEN NEW.status = 'rejected' THEN 'Proposta rejeitada'
            WHEN NEW.status = 'sent' THEN 'Proposta enviada'
            ELSE 'Proposta atualizada'
          END,
          'Proposta "' || v_title || '" teve status alterado para ' || NEW.status,
          jsonb_build_object('proposal_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;