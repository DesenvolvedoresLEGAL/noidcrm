CREATE OR REPLACE FUNCTION public.create_contract_from_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_contract_id uuid;
  v_account_id uuid;
  v_contact_id uuid;
  v_owner_user_id uuid;
  v_net numeric;
  v_payment_terms text;
  v_action text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    SELECT account_id, contact_id, owner_user_id
    INTO v_account_id, v_contact_id, v_owner_user_id
    FROM public.opportunities
    WHERE id = NEW.opportunity_id;

    v_net := COALESCE(
      NULLIF(NEW.approved_amount, 0),
      NULLIF(NEW.payment_expected_amount, 0),
      NULLIF(NEW.total_amount, 0),
      NEW.value,
      0
    );

    SELECT string_agg(
      COALESCE(ppt.payment_condition, ppt.payment_type) || ': ' ||
      COALESCE(ppt.payment_expected_amount::text, ppt.total_amount::text, NEW.value::text),
      E'\n'
    )
    INTO v_payment_terms
    FROM public.proposal_payment_terms ppt
    WHERE ppt.proposal_id = NEW.id;

    IF v_account_id IS NOT NULL AND v_owner_user_id IS NOT NULL THEN
      SELECT id
      INTO v_contract_id
      FROM public.contracts
      WHERE organization_id = NEW.organization_id
        AND opportunity_id = NEW.opportunity_id
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_contract_id IS NULL THEN
        INSERT INTO public.contracts (
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
          v_payment_terms,
          NEW.terms
        ) RETURNING id INTO v_contract_id;

        v_action := 'contract_created_from_proposal';
      ELSE
        UPDATE public.contracts
        SET account_id = v_account_id,
            contact_id = v_contact_id,
            owner_user_id = v_owner_user_id,
            title = 'Contrato - ' || NEW.title,
            contract_value = v_net,
            status = 'active',
            start_date = COALESCE(start_date, CURRENT_DATE),
            end_date = NEW.expires_at,
            payment_terms = v_payment_terms,
            terms_and_conditions = NEW.terms,
            deleted_at = NULL,
            updated_at = now()
        WHERE id = v_contract_id;

        v_action := 'contract_updated_from_reapproval';
      END IF;

      UPDATE public.opportunities
      SET status = 'won',
          accepted_proposal_id = NEW.id,
          valor_previsto = v_net
      WHERE id = NEW.opportunity_id;

      INSERT INTO public.audit_log (organization_id, action, entity_type, entity_id, metadata)
      VALUES (
        NEW.organization_id, v_action, 'contract', v_contract_id,
        jsonb_build_object(
          'proposal_id', NEW.id,
          'opportunity_id', NEW.opportunity_id,
          'acceptor_name', NEW.acceptor_name,
          'net_amount', v_net,
          'reused_existing_contract', v_action = 'contract_updated_from_reapproval'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;