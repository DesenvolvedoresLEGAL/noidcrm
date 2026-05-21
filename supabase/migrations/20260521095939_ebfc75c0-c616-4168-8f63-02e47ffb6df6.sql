
CREATE OR REPLACE VIEW public.v_proposals_normalized_v2 AS
SELECT
  id,
  organization_id,
  opportunity_id,
  status,
  created_at,
  updated_at,
  accepted_at,
  COALESCE(
    NULLIF(subtotal, 0::numeric),
    COALESCE(total_amount, 0::numeric) + COALESCE(discount_amount, 0::numeric),
    COALESCE(value, 0::numeric),
    0::numeric
  ) AS gross_amount,
  COALESCE(discount_amount, 0::numeric) AS discount_amount,
  COALESCE(approved_amount, total_amount, value, 0::numeric) AS net_amount
FROM proposals p
WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.resolve_approved_commercial_amount(p_opportunity_id uuid)
RETURNS TABLE (amount numeric, source text, is_final boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_opp RECORD;
  v_prop RECORD;
  v_schedule_sum numeric;
  v_snap numeric;
BEGIN
  SELECT o.id, o.accepted_proposal_id, o.valor_previsto INTO v_opp
    FROM opportunities o WHERE o.id = p_opportunity_id AND o.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN QUERY SELECT 0::numeric, 'zero'::text, false; RETURN; END IF;

  IF v_opp.accepted_proposal_id IS NOT NULL THEN
    SELECT p.id, p.approved_amount, p.approved_payment_schedule,
           p.approval_snapshot, p.total_amount INTO v_prop
      FROM proposals p
     WHERE p.id = v_opp.accepted_proposal_id AND p.deleted_at IS NULL;

    IF v_prop.approved_amount IS NOT NULL AND v_prop.approved_amount > 0 THEN
      RETURN QUERY SELECT v_prop.approved_amount::numeric, 'approved_amount'::text, true; RETURN;
    END IF;

    IF v_prop.approved_payment_schedule IS NOT NULL THEN
      SELECT COALESCE(SUM((elem->>'amount')::numeric), 0) INTO v_schedule_sum
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(v_prop.approved_payment_schedule) = 'array'
              THEN v_prop.approved_payment_schedule
            WHEN jsonb_typeof(v_prop.approved_payment_schedule->'installments') = 'array'
              THEN v_prop.approved_payment_schedule->'installments'
            ELSE '[]'::jsonb
          END
        ) AS elem
       WHERE (elem->>'amount') IS NOT NULL;
      IF v_schedule_sum IS NOT NULL AND v_schedule_sum > 0 THEN
        RETURN QUERY SELECT v_schedule_sum, 'approved_payment_schedule'::text, true; RETURN;
      END IF;
    END IF;

    IF v_prop.approval_snapshot IS NOT NULL THEN
      BEGIN
        v_snap := COALESCE(
          NULLIF((v_prop.approval_snapshot->>'approved_amount')::numeric, 0),
          NULLIF((v_prop.approval_snapshot->>'net_amount')::numeric, 0),
          NULLIF((v_prop.approval_snapshot->>'net_total')::numeric, 0)
        );
        IF v_snap IS NOT NULL AND v_snap > 0 THEN
          RETURN QUERY SELECT v_snap, 'approval_snapshot'::text, true; RETURN;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    IF v_prop.total_amount IS NOT NULL AND v_prop.total_amount > 0 THEN
      RETURN QUERY SELECT v_prop.total_amount::numeric, 'pricing_ledger'::text, false; RETURN;
    END IF;
  END IF;

  IF v_opp.valor_previsto IS NOT NULL AND v_opp.valor_previsto > 0 THEN
    RETURN QUERY SELECT v_opp.valor_previsto::numeric, 'opportunity_value_legacy'::text, false; RETURN;
  END IF;

  RETURN QUERY SELECT 0::numeric, 'zero'::text, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_approved_commercial_amount(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.commercial_won_revenue_view AS
WITH base AS (
  SELECT
    o.id AS opportunity_id,
    o.organization_id,
    o.title,
    o.status,
    o.pipeline_id,
    o.stage_id,
    o.account_id,
    o.owner_user_id,
    o.valor_previsto AS legacy_opportunity_value,
    o.accepted_proposal_id,
    o.closed_at,
    o.created_at,
    p.proposal_number,
    p.accepted_at AS proposal_accepted_at,
    pl.name AS pipeline_name,
    pl.pipeline_type
  FROM opportunities o
  LEFT JOIN proposals p ON p.id = o.accepted_proposal_id AND p.deleted_at IS NULL
  LEFT JOIN pipelines pl ON pl.id = o.pipeline_id
  WHERE o.deleted_at IS NULL
    AND (
      o.status = 'won'
      OR (o.accepted_proposal_id IS NOT NULL AND pl.pipeline_type IN ('onboarding','renewal'))
    )
)
SELECT
  b.opportunity_id,
  b.organization_id,
  b.accepted_proposal_id AS proposal_id,
  b.proposal_number,
  b.account_id,
  acc.razao_social AS account_name,
  acc.nome_fantasia,
  b.owner_user_id AS seller_id,
  prof.full_name AS seller_name,
  b.closed_at AS won_at,
  b.proposal_accepted_at AS approved_at,
  r.amount AS approved_amount,
  r.source AS amount_source,
  r.is_final AS is_final_approved_value,
  b.legacy_opportunity_value,
  COALESCE(r.amount, 0) - COALESCE(b.legacy_opportunity_value, 0) AS delta_vs_opportunity_value,
  b.pipeline_id,
  b.pipeline_name,
  b.pipeline_type,
  b.title AS opportunity_title,
  b.status
FROM base b
LEFT JOIN LATERAL public.resolve_approved_commercial_amount(b.opportunity_id) r ON true
LEFT JOIN accounts acc ON acc.id = b.account_id
LEFT JOIN profiles prof ON prof.user_id = b.owner_user_id;

GRANT SELECT ON public.commercial_won_revenue_view TO authenticated;

CREATE OR REPLACE FUNCTION public.dry_run_sync_won_opportunity_values_from_approved_proposals(
  p_organization_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  opportunity_id uuid, proposal_id uuid, proposal_number text,
  account_name text, seller_name text, pipeline_name text,
  legacy_opportunity_value numeric, approved_amount numeric,
  delta numeric, won_at timestamptz, amount_source text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT v.opportunity_id, v.proposal_id, v.proposal_number,
         v.account_name, v.seller_name, v.pipeline_name,
         v.legacy_opportunity_value, v.approved_amount,
         v.delta_vs_opportunity_value, v.won_at, v.amount_source
    FROM public.commercial_won_revenue_view v
   WHERE v.organization_id = p_organization_id
     AND v.is_final_approved_value = true
     AND v.proposal_id IS NOT NULL
     AND ABS(COALESCE(v.delta_vs_opportunity_value, 0)) > 0.01
     AND (p_start IS NULL OR v.won_at >= p_start)
     AND (p_end   IS NULL OR v.won_at <= p_end)
   ORDER BY ABS(v.delta_vs_opportunity_value) DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dry_run_sync_won_opportunity_values_from_approved_proposals(uuid, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_won_opportunity_value_from_approved_proposal(p_opportunity_id uuid)
RETURNS TABLE (opportunity_id uuid, before_value numeric, after_value numeric, source text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_before numeric; v_proposal_id uuid; v_resolved RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT o.organization_id, o.valor_previsto, o.accepted_proposal_id
    INTO v_org, v_before, v_proposal_id
    FROM opportunities o WHERE o.id = p_opportunity_id AND o.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity_not_found'; END IF;
  IF v_proposal_id IS NULL THEN RAISE EXCEPTION 'opportunity_has_no_accepted_proposal'; END IF;

  SELECT * INTO v_resolved FROM public.resolve_approved_commercial_amount(p_opportunity_id);
  IF v_resolved.amount IS NULL OR v_resolved.amount <= 0 OR v_resolved.is_final = false THEN
    RAISE EXCEPTION 'no_final_approved_amount_resolvable';
  END IF;

  UPDATE opportunities SET valor_previsto = v_resolved.amount, updated_at = now()
   WHERE id = p_opportunity_id;

  INSERT INTO system_events (organization_id, event_type, payload, created_at)
  VALUES (v_org, 'opportunity.value_synced_from_approved_proposal',
    jsonb_build_object(
      'opportunity_id', p_opportunity_id, 'proposal_id', v_proposal_id,
      'before_value', v_before, 'after_value', v_resolved.amount,
      'source', v_resolved.source, 'actor', auth.uid()
    ), now());

  RETURN QUERY SELECT p_opportunity_id, v_before, v_resolved.amount, v_resolved.source;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_won_opportunity_value_from_approved_proposal(uuid) TO authenticated;
