CREATE OR REPLACE FUNCTION public.generate_event_antecedence_pricing_for_proposal(p_proposal_id uuid, p_force_regenerate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_ref_date date;
  v_org uuid;
  v_base numeric;
  v_rule_id uuid;
  v_existing public.proposal_dynamic_pricing_rules%ROWTYPE;
  v_user uuid := auth.uid();
  v_factor record;
  v_starts timestamptz;
  v_ends timestamptz;
  v_final numeric;
  v_must_regen boolean := p_force_regenerate;
  v_snapshot jsonb;
  v_days int;
  v_tz text := 'America/Sao_Paulo';
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PROPOSAL_NOT_FOUND');
  END IF;

  v_org := v_proposal.organization_id;

  IF COALESCE(v_proposal.dynamic_pricing_applicability,'none') <> 'automatic'
     OR COALESCE(v_proposal.dynamic_pricing_mode,'none') <> 'automatic_by_valid_until'
     OR COALESCE(v_proposal.revenue_type,'') NOT IN ('one_time_event','one_time_non_event') THEN
    RETURN jsonb_build_object(
      'status', 'not_applicable',
      'message', 'Tabela dinâmica não aplicável para este template'
    );
  END IF;

  IF v_proposal.expires_at IS NOT NULL THEN
    v_ref_date := (v_proposal.expires_at AT TIME ZONE v_tz)::date;
  ELSIF v_proposal.event_start_date IS NOT NULL THEN
    v_ref_date := v_proposal.event_start_date;
  ELSIF v_proposal.opportunity_id IS NOT NULL THEN
    SELECT event_start_date INTO v_ref_date
      FROM public.opportunities WHERE id = v_proposal.opportunity_id;
  END IF;

  IF v_ref_date IS NULL THEN
    RETURN jsonb_build_object(
      'error','VALIDITY_MISSING',
      'message','Defina a validade da proposta para gerar a condição comercial automática.'
    );
  END IF;

  v_base := COALESCE(NULLIF(v_proposal.total_amount,0), v_proposal.value, 0);
  IF v_base <= 0 THEN
    SELECT COALESCE(SUM(total),0) INTO v_base
      FROM public.proposal_items WHERE proposal_id = p_proposal_id;
  END IF;

  IF v_base <= 0 THEN
    RETURN jsonb_build_object(
      'error','BASE_AMOUNT_MISSING',
      'message','Adicione itens com valor para gerar a condição comercial.'
    );
  END IF;

  SELECT * INTO v_existing FROM public.proposal_dynamic_pricing_rules WHERE proposal_id = p_proposal_id;
  IF v_existing.id IS NULL THEN
    INSERT INTO public.proposal_dynamic_pricing_rules
      (organization_id, proposal_id, enabled, base_amount, currency, status,
       pricing_mode, event_start_date, auto_generated, post_event_policy, created_by, updated_by)
    VALUES
      (v_org, p_proposal_id, true, v_base, COALESCE(v_proposal.currency,'BRL'), 'active',
       'event_antecedence', v_ref_date, true, 'surcharge', v_user, v_user)
    RETURNING id INTO v_rule_id;
    v_must_regen := true;

    INSERT INTO public.proposal_dynamic_pricing_events
      (organization_id, proposal_id, pricing_rule_id, event_type, message)
    VALUES
      (v_org, p_proposal_id, v_rule_id, 'created', 'Tabela dinâmica gerada automaticamente pela validade da proposta');
  ELSE
    v_rule_id := v_existing.id;
    IF v_existing.event_start_date IS DISTINCT FROM v_ref_date
       OR v_existing.base_amount IS DISTINCT FROM v_base
       OR v_existing.pricing_mode <> 'event_antecedence'
       OR NOT COALESCE(v_existing.auto_generated,false) THEN
      v_must_regen := true;
    END IF;

    UPDATE public.proposal_dynamic_pricing_rules
      SET pricing_mode = 'event_antecedence',
          event_start_date = v_ref_date,
          auto_generated = true,
          enabled = true,
          status = 'active',
          base_amount = v_base,
          currency = COALESCE(v_proposal.currency, currency),
          updated_by = v_user
      WHERE id = v_rule_id;

    IF v_must_regen THEN
      INSERT INTO public.proposal_dynamic_pricing_events
        (organization_id, proposal_id, pricing_rule_id, event_type, message)
      VALUES
        (v_org, p_proposal_id, v_rule_id, 'updated', 'Tabela dinâmica regenerada automaticamente');
    END IF;
  END IF;

  IF v_must_regen THEN
    DELETE FROM public.proposal_dynamic_pricing_tiers
      WHERE pricing_rule_id = v_rule_id AND auto_generated = true;

    FOR v_factor IN
      SELECT * FROM public.proposal_dynamic_pricing_factor_rules
      WHERE organization_id = v_org AND status = 'active'
      ORDER BY sort_order ASC
    LOOP
      IF v_factor.max_days_before_event = -1 THEN
        -- pós evento: começa no dia seguinte à validade, 00:00 horário SP
        v_starts := ((v_ref_date + 1)::timestamp) AT TIME ZONE v_tz;
        v_ends := NULL;
      ELSIF v_factor.max_days_before_event IS NULL AND v_factor.min_days_before_event IS NOT NULL THEN
        v_starts := NULL;
        v_ends := ((v_ref_date - v_factor.min_days_before_event)::timestamp
                   + INTERVAL '23 hours 59 minutes 59 seconds') AT TIME ZONE v_tz;
      ELSE
        v_starts := ((v_ref_date - v_factor.max_days_before_event)::timestamp) AT TIME ZONE v_tz;
        v_ends := ((v_ref_date - v_factor.min_days_before_event)::timestamp
                   + INTERVAL '23 hours 59 minutes 59 seconds') AT TIME ZONE v_tz;
      END IF;

      IF v_factor.adjustment_type = 'percent' THEN
        v_final := GREATEST(0, v_base + (v_base * v_factor.adjustment_value / 100));
      ELSE
        v_final := GREATEST(0, v_base + v_factor.adjustment_value);
      END IF;

      INSERT INTO public.proposal_dynamic_pricing_tiers
        (organization_id, proposal_id, pricing_rule_id, tier_order, label,
         starts_at, ends_at, adjustment_type, adjustment_value, final_amount, auto_generated)
      VALUES
        (v_org, p_proposal_id, v_rule_id, v_factor.sort_order, v_factor.label,
         v_starts, v_ends,
         CASE WHEN v_factor.adjustment_type='percent' THEN 'percent_adjustment' ELSE 'fixed_adjustment' END,
         v_factor.adjustment_value, v_final, true);
    END LOOP;
  END IF;

  v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, now());

  UPDATE public.proposals
    SET dynamic_pricing_enabled = true,
        dynamic_pricing_current_amount = NULLIF(v_snapshot->>'current_amount','')::numeric,
        dynamic_pricing_status = COALESCE(v_snapshot->>'status', 'active'),
        dynamic_pricing_snapshot = v_snapshot,
        dynamic_pricing_last_calculated_at = now()
    WHERE id = p_proposal_id;

  v_days := (v_ref_date - CURRENT_DATE);

  RETURN jsonb_build_object(
    'proposal_id', p_proposal_id,
    'pricing_rule_id', v_rule_id,
    'base_amount', v_base,
    'reference_date', v_ref_date,
    'days_until_validity', v_days,
    'current_amount', v_snapshot->'current_amount',
    'current_label', v_snapshot->'current_label',
    'next_amount', v_snapshot->'next_amount',
    'next_label', v_snapshot->'next_label',
    'status', v_snapshot->'status',
    'snapshot', v_snapshot
  );
END;
$function$;