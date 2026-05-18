-- Fix legacy contract creation to use the NET approved amount
CREATE OR REPLACE FUNCTION public.create_contract_from_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_account_id UUID;
  v_contact_id UUID;
  v_owner_user_id UUID;
  v_net numeric;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    SELECT account_id, contact_id, owner_user_id
    INTO v_account_id, v_contact_id, v_owner_user_id
    FROM opportunities WHERE id = NEW.opportunity_id;

    -- Net approved value, with fallback chain
    v_net := COALESCE(
      NULLIF(NEW.approved_amount, 0),
      NULLIF(NEW.payment_expected_amount, 0),
      NULLIF(NEW.total_amount, 0),
      NEW.value,
      0
    );

    IF v_account_id IS NOT NULL AND v_owner_user_id IS NOT NULL THEN
      INSERT INTO contracts (
        organization_id, opportunity_id, account_id, contact_id, owner_user_id,
        title, contract_value, status, start_date, end_date,
        payment_terms, terms_and_conditions
      ) VALUES (
        NEW.organization_id, NEW.opportunity_id, v_account_id, v_contact_id, v_owner_user_id,
        'Contrato - ' || NEW.title,
        v_net,
        'active',
        CURRENT_DATE,
        NEW.expires_at,
        (SELECT string_agg(
            COALESCE(payment_condition, payment_type) || ': ' ||
            COALESCE(payment_expected_amount::text, total_amount::text, value::text),
            E'\n')
          FROM proposal_payment_terms ppt
          CROSS JOIN proposals p2
          WHERE ppt.proposal_id = NEW.id AND p2.id = NEW.id),
        NEW.terms
      ) RETURNING id INTO v_contract_id;

      UPDATE opportunities SET status = 'won' WHERE id = NEW.opportunity_id;

      INSERT INTO audit_log (organization_id, action, entity_type, entity_id, metadata)
      VALUES (
        NEW.organization_id, 'contract_created_from_proposal', 'contract', v_contract_id,
        jsonb_build_object(
          'proposal_id', NEW.id,
          'opportunity_id', NEW.opportunity_id,
          'acceptor_name', NEW.acceptor_name,
          'net_amount', v_net
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;