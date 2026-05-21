-- =============================================================================
-- P0 Revenue Integrity Freeze — fechar a chain V2 (reports/forecast/dashboards)
-- na mesma composição comercial usada pelo Deal Card e Aba Propostas.
-- Não altera dados de propostas, snapshots, ERP, Pix, PDF ou provider.
-- =============================================================================

-- 1) Resolver por proposta (mesma regra de resolve_approved_commercial_amount,
--    mas escopado a 1 proposta — para uso em views que normalizam propostas).
CREATE OR REPLACE FUNCTION public.resolve_approved_commercial_amount_by_proposal(p_proposal_id uuid)
RETURNS TABLE(amount numeric, source text, is_final boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prop RECORD;
  v_base numeric;
  v_column numeric;
  v_snap numeric;
  v_snap_field text;
  v_discount numeric;
  v_schedule_sum numeric;
  v_ratio numeric;
  v_known_mult numeric[] := ARRAY[1.10, 1.20, 1.25, 1.30, 1.50]::numeric[];
BEGIN
  SELECT p.id, p.approved_amount, p.approved_payment_schedule,
         p.approval_snapshot, p.total_amount, p.discount_amount,
         p.pricing_manual_discount_amount, p.value
    INTO v_prop
    FROM proposals p
   WHERE p.id = p_proposal_id AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 'zero'::text, false;
    RETURN;
  END IF;

  v_base    := NULLIF(v_prop.total_amount, 0);
  v_column  := NULLIF(v_prop.approved_amount, 0);
  v_discount := COALESCE(NULLIF(v_prop.pricing_manual_discount_amount,0), NULLIF(v_prop.discount_amount,0), 0);

  BEGIN
    v_snap := NULLIF((v_prop.approval_snapshot->>'payment_expected_amount')::numeric, 0);
    IF v_snap IS NOT NULL THEN
      v_snap_field := 'approval_snapshot.payment_expected_amount';
    ELSE
      v_snap := NULLIF((v_prop.approval_snapshot->>'approved_amount')::numeric, 0);
      IF v_snap IS NOT NULL THEN
        v_snap_field := 'approval_snapshot.approved_amount';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_snap := NULL;
  END;

  IF v_snap IS NULL AND v_column IS NULL THEN
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
        ) AS elem WHERE (elem->>'amount') IS NOT NULL;
      IF v_schedule_sum > 0 THEN
        RETURN QUERY SELECT v_schedule_sum, 'approved_payment_schedule'::text, true;
        RETURN;
      END IF;
    END IF;
    IF v_base IS NOT NULL THEN
      RETURN QUERY SELECT v_base, 'pricing_ledger'::text, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT 0::numeric, 'zero'::text, false;
    RETURN;
  END IF;

  IF v_snap IS NULL THEN
    RETURN QUERY SELECT v_column, 'approved_amount_column'::text, true;
    RETURN;
  END IF;
  IF v_column IS NULL THEN
    RETURN QUERY SELECT v_snap, v_snap_field, true;
    RETURN;
  END IF;

  -- A) consenso
  IF ABS(v_snap - v_column) <= 0.02 THEN
    RETURN QUERY SELECT v_snap, 'approval_snapshot+column_consensus'::text, true;
    RETURN;
  END IF;
  -- B) snap == base - desconto manual
  IF v_base IS NOT NULL AND v_discount > 0 AND ABS(v_snap - (v_base - v_discount)) <= 0.50 THEN
    RETURN QUERY SELECT v_snap, v_snap_field, true;
    RETURN;
  END IF;
  -- C) column == snap - desconto manual (caso OGGI)
  IF v_discount > 0 AND ABS(v_column - (v_snap - v_discount)) <= 0.50 THEN
    RETURN QUERY SELECT v_column, 'approved_amount_column'::text, true;
    RETURN;
  END IF;
  -- D) ratio column/snap em multiplicador conhecido de dynamic pricing
  IF v_snap > 0 THEN
    v_ratio := v_column / v_snap;
    IF EXISTS (SELECT 1 FROM unnest(v_known_mult) m WHERE ABS(v_ratio - m) <= 0.005) THEN
      RETURN QUERY SELECT v_snap, v_snap_field, true;
      RETURN;
    END IF;
  END IF;
  -- E) snap == base sem ajuste e column inflado
  IF v_base IS NOT NULL AND ABS(v_snap - v_base) <= 0.02 AND v_column > v_snap THEN
    RETURN QUERY SELECT v_snap, v_snap_field, true;
    RETURN;
  END IF;

  -- Fallback: snapshot é imutável, vence
  RETURN QUERY SELECT v_snap, v_snap_field, true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_approved_commercial_amount_by_proposal(uuid)
  TO authenticated, service_role;

-- 2) Atualizar v_proposals_normalized_v2: net_amount usa o resolver para
--    propostas aceitas. Demais status mantêm comportamento legado.
--    Isso propaga automaticamente para v_opportunity_accepted_proposal_v2,
--    v_opportunity_amounts_v2 e toda a chain V2 (forecast, relatórios,
--    dashboards, comissão).
CREATE OR REPLACE VIEW public.v_proposals_normalized_v2 AS
SELECT
  p.id,
  p.organization_id,
  p.opportunity_id,
  p.status,
  p.created_at,
  p.updated_at,
  p.accepted_at,
  COALESCE(
    NULLIF(p.subtotal, 0::numeric),
    COALESCE(p.total_amount, 0::numeric) + COALESCE(p.discount_amount, 0::numeric),
    COALESCE(p.value, 0::numeric),
    0::numeric
  ) AS gross_amount,
  COALESCE(p.discount_amount, 0::numeric) AS discount_amount,
  CASE
    WHEN p.status = 'accepted' THEN
      COALESCE(r.amount, p.approved_amount, p.total_amount, p.value, 0::numeric)
    ELSE
      COALESCE(p.approved_amount, p.total_amount, p.value, 0::numeric)
  END AS net_amount
FROM proposals p
LEFT JOIN LATERAL public.resolve_approved_commercial_amount_by_proposal(p.id)
  AS r(amount, source, is_final)
  ON p.status = 'accepted'
WHERE p.deleted_at IS NULL;