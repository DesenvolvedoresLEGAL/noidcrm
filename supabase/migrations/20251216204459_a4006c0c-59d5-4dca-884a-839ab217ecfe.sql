-- Adicionar proteção anti-duplicação no trigger de criação de contratos
CREATE OR REPLACE FUNCTION public.create_contract_from_proposal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract_id UUID;
  v_account_id UUID;
  v_contact_id UUID;
  v_owner_user_id UUID;
  v_existing_contract_id UUID;
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    
    -- CRITICAL: Check if contract already exists for this proposal
    SELECT id INTO v_existing_contract_id
    FROM contracts
    WHERE opportunity_id = NEW.opportunity_id
      AND organization_id = NEW.organization_id
    LIMIT 1;
    
    -- If contract already exists, do nothing (prevent duplicate)
    IF v_existing_contract_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get opportunity details
    SELECT account_id, contact_id, owner_user_id
    INTO v_account_id, v_contact_id, v_owner_user_id
    FROM opportunities
    WHERE id = NEW.opportunity_id;
    
    -- Create contract if we have required data
    IF v_account_id IS NOT NULL AND v_owner_user_id IS NOT NULL THEN
      INSERT INTO contracts (
        organization_id,
        opportunity_id,
        account_id,
        contact_id,
        owner_user_id,
        title,
        contract_value,
        status,
        start_date,
        end_date,
        payment_terms,
        terms_and_conditions
      ) VALUES (
        NEW.organization_id,
        NEW.opportunity_id,
        v_account_id,
        v_contact_id,
        v_owner_user_id,
        'Contrato - ' || COALESCE(NEW.title, 'Sem título'),
        COALESCE(NEW.value, NEW.total_amount, 0),
        'active',
        CURRENT_DATE,
        NEW.expires_at,
        (SELECT string_agg(
          COALESCE(payment_type, 'Pagamento') || ': R$ ' || COALESCE(monthly_value::text, '0') || 
          CASE WHEN comments IS NOT NULL THEN ' - ' || comments ELSE '' END, 
          E'\n'
        ) FROM proposal_payment_terms WHERE proposal_id = NEW.id),
        NEW.terms
      ) RETURNING id INTO v_contract_id;
      
      -- Update opportunity status to 'won' and link contract
      UPDATE opportunities
      SET status = 'won'
      WHERE id = NEW.opportunity_id;
      
      -- Log the contract creation
      INSERT INTO audit_log (
        organization_id,
        action,
        entity_type,
        entity_id,
        metadata
      ) VALUES (
        NEW.organization_id,
        'contract_created_from_proposal',
        'contract',
        v_contract_id,
        jsonb_build_object(
          'proposal_id', NEW.id,
          'opportunity_id', NEW.opportunity_id,
          'acceptor_name', NEW.acceptor_name
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;