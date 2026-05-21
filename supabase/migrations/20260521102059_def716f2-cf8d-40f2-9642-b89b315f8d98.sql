-- =============================================================================
-- Atualiza resolve_approved_commercial_amount com regras de composição comercial
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resolve_approved_commercial_amount(p_opportunity_id uuid)
RETURNS TABLE(amount numeric, source text, is_final boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_opp RECORD;
  v_prop RECORD;
  v_base numeric;
  v_column numeric;
  v_snap numeric;
  v_snap_field text;
  v_discount numeric;
  v_schedule_sum numeric;
  v_ratio numeric;
  v_known_mult numeric[] := ARRAY[1.10, 1.20, 1.25, 1.30, 1.50]::numeric[];
  v_is_known boolean;
BEGIN
  SELECT o.id, o.accepted_proposal_id, o.valor_previsto INTO v_opp
    FROM opportunities o WHERE o.id = p_opportunity_id AND o.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 'zero'::text, false;
    RETURN;
  END IF;

  IF v_opp.accepted_proposal_id IS NULL THEN
    IF v_opp.valor_previsto IS NOT NULL AND v_opp.valor_previsto > 0 THEN
      RETURN QUERY SELECT v_opp.valor_previsto::numeric, 'opportunity_value_legacy'::text, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT 0::numeric, 'zero'::text, false;
    RETURN;
  END IF;

  SELECT p.id, p.approved_amount, p.approved_payment_schedule,
         p.approval_snapshot, p.total_amount, p.discount_amount,
         p.pricing_manual_discount_amount, p.value
    INTO v_prop
    FROM proposals p
   WHERE p.id = v_opp.accepted_proposal_id AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    IF v_opp.valor_previsto IS NOT NULL AND v_opp.valor_previsto > 0 THEN
      RETURN QUERY SELECT v_opp.valor_previsto::numeric, 'opportunity_value_legacy'::text, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT 0::numeric, 'zero'::text, false;
    RETURN;
  END IF;

  v_base := NULLIF(v_prop.total_amount, 0);
  v_column := NULLIF(v_prop.approved_amount, 0);
  v_discount := COALESCE(NULLIF(v_prop.pricing_manual_discount_amount,0), NULLIF(v_prop.discount_amount,0), 0);

  -- snapshot net amount (payment_expected_amount preferido sobre approved_amount)
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

  -- Sem snapshot nem column: schedule -> ledger -> legado
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
    IF v_opp.valor_previsto IS NOT NULL AND v_opp.valor_previsto > 0 THEN
      RETURN QUERY SELECT v_opp.valor_previsto::numeric, 'opportunity_value_legacy'::text, false;
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

  -- Regra A: consenso (snap == column)
  IF ABS(v_snap - v_column) <= 0.02 THEN
    RETURN QUERY SELECT v_snap, 'approval_snapshot+column_consensus'::text, true;
    RETURN;
  END IF;

  -- Regra B: snap == base - desconto manual → snap é líquido pós-desconto
  IF v_base IS NOT NULL AND v_discount > 0 AND ABS(v_snap - (v_base - v_discount)) <= 0.50 THEN
    RETURN QUERY SELECT v_snap, v_snap_field, true;
    RETURN;
  END IF;

  -- Regra C: column == snap - desconto manual → snapshot era bruto (OGGI)
  IF v_discount > 0 AND ABS(v_column - (v_snap - v_discount)) <= 0.50 THEN
    RETURN QUERY SELECT v_column, 'approved_amount_column'::text, true;
    RETURN;
  END IF;

  -- Regra D: column ≈ snap × multiplicador conhecido → column contaminado
  IF v_snap > 0 THEN
    v_ratio := v_column / v_snap;
    v_is_known := EXISTS (SELECT 1 FROM unnest(v_known_mult) m WHERE ABS(v_ratio - m) <= 0.005);
    IF v_is_known THEN
      RETURN QUERY SELECT v_snap, v_snap_field, true;
      RETURN;
    END IF;
  END IF;

  -- Regra E: snap == base sem desconto e column inflado → snap vence
  IF v_base IS NOT NULL AND ABS(v_snap - v_base) <= 0.02 AND v_column > v_snap THEN
    RETURN QUERY SELECT v_snap, v_snap_field, true;
    RETURN;
  END IF;

  -- Fallback: needs manual review → snap (mais seguro, imutável)
  RETURN QUERY SELECT v_snap, v_snap_field, true;
END;
$function$;

-- =============================================================================
-- Auditoria administrativa de divergência
-- =============================================================================
CREATE OR REPLACE FUNCTION public.audit_approved_amount_vs_approval_snapshot(
  p_organization_id uuid DEFAULT NULL,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS TABLE(
  proposal_id uuid,
  proposal_number text,
  cliente text,
  accepted_at timestamptz,
  base_amount numeric,
  approved_amount_column numeric,
  snapshot_payment_expected_amount numeric,
  snapshot_approved_amount numeric,
  approved_payment_schedule_total numeric,
  manual_discount_amount numeric,
  manual_discount_percent numeric,
  dynamic_label text,
  ratio_col_over_snap numeric,
  delta_column_vs_snapshot numeric,
  recommended_canonical_amount numeric,
  recommended_source text,
  warnings text[],
  review_required boolean,
  risk_status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  WITH src AS (
    SELECT p.id AS proposal_id,
           p.proposal_number,
           COALESCE(p.client_name, '') AS cliente,
           p.accepted_at,
           p.organization_id,
           p.total_amount::numeric AS base_amount,
           p.approved_amount::numeric AS column_amount,
           NULLIF((p.approval_snapshot->>'payment_expected_amount')::numeric, 0) AS snap_payment_expected,
           NULLIF((p.approval_snapshot->>'approved_amount')::numeric, 0) AS snap_approved,
           p.approval_snapshot->'dynamic_pricing'->>'current_label' AS dynamic_label,
           COALESCE(p.discount_amount, 0)::numeric AS discount_amount,
           COALESCE(p.pricing_manual_discount_percent, 0)::numeric AS manual_discount_percent,
           (SELECT COALESCE(SUM(COALESCE((x->>'amount')::numeric,(x->>'value')::numeric,(x->>'net')::numeric,(x->>'total')::numeric)),0)
              FROM jsonb_array_elements(
                CASE jsonb_typeof(p.approved_payment_schedule)
                  WHEN 'array' THEN p.approved_payment_schedule
                  WHEN 'object' THEN COALESCE(p.approved_payment_schedule->'installments','[]'::jsonb)
                  ELSE '[]'::jsonb END
              ) x
           ) AS schedule_total
      FROM proposals p
     WHERE p.deleted_at IS NULL
       AND (p.accepted_at IS NOT NULL OR p.status IN ('accepted','approved','won'))
       AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
       AND (p_start IS NULL OR p.accepted_at >= p_start)
       AND (p_end IS NULL OR p.accepted_at <= p_end)
  ), calc AS (
    SELECT *,
           COALESCE(snap_payment_expected, snap_approved) AS snap,
           CASE WHEN snap_payment_expected IS NOT NULL THEN 'approval_snapshot.payment_expected_amount'
                WHEN snap_approved IS NOT NULL THEN 'approval_snapshot.approved_amount'
                ELSE NULL END AS snap_source
      FROM src
  ), decided AS (
    SELECT *,
      CASE WHEN snap > 0 THEN ROUND(column_amount / snap, 4) END AS ratio,
      CASE
        WHEN snap IS NULL AND column_amount IS NULL THEN 0::numeric
        WHEN snap IS NULL THEN column_amount
        WHEN column_amount IS NULL THEN snap
        WHEN ABS(snap - column_amount) <= 0.02 THEN snap
        WHEN base_amount IS NOT NULL AND discount_amount > 0 AND ABS(snap - (base_amount - discount_amount)) <= 0.50 THEN snap
        WHEN discount_amount > 0 AND ABS(column_amount - (snap - discount_amount)) <= 0.50 THEN column_amount
        WHEN snap > 0 AND EXISTS (
          SELECT 1 FROM unnest(ARRAY[1.10,1.20,1.25,1.30,1.50]::numeric[]) m
           WHERE ABS((column_amount/snap) - m) <= 0.005
        ) THEN snap
        WHEN base_amount IS NOT NULL AND ABS(snap - base_amount) <= 0.02 AND column_amount > snap THEN snap
        ELSE snap
      END AS resolved_amount,
      CASE
        WHEN snap IS NULL AND column_amount IS NULL THEN 'zero'
        WHEN snap IS NULL THEN 'approved_amount_column'
        WHEN column_amount IS NULL THEN snap_source
        WHEN ABS(snap - column_amount) <= 0.02 THEN 'approval_snapshot+column_consensus'
        WHEN base_amount IS NOT NULL AND discount_amount > 0 AND ABS(snap - (base_amount - discount_amount)) <= 0.50 THEN snap_source
        WHEN discount_amount > 0 AND ABS(column_amount - (snap - discount_amount)) <= 0.50 THEN 'approved_amount_column'
        WHEN snap > 0 AND EXISTS (
          SELECT 1 FROM unnest(ARRAY[1.10,1.20,1.25,1.30,1.50]::numeric[]) m
           WHERE ABS((column_amount/snap) - m) <= 0.005
        ) THEN snap_source
        WHEN base_amount IS NOT NULL AND ABS(snap - base_amount) <= 0.02 AND column_amount > snap THEN snap_source
        ELSE snap_source
      END AS resolved_source,
      (
        SELECT ARRAY_REMOVE(ARRAY[
          CASE WHEN snap IS NOT NULL AND column_amount IS NOT NULL AND ABS(snap - column_amount) > 0.02
               THEN 'approved_amount_column_mismatch' END,
          CASE WHEN discount_amount > 0 AND snap IS NOT NULL AND column_amount IS NOT NULL
                AND ABS(column_amount - (snap - discount_amount)) <= 0.50
               THEN 'approval_snapshot_may_be_gross_before_discount' END,
          CASE WHEN snap > 0 AND column_amount IS NOT NULL AND EXISTS (
                  SELECT 1 FROM unnest(ARRAY[1.10,1.20,1.25,1.30,1.50]::numeric[]) m
                   WHERE ABS((column_amount/snap) - m) <= 0.005
                )
               THEN 'approved_amount_column_contaminated_after_approval' END,
          CASE WHEN snap IS NOT NULL AND column_amount IS NOT NULL
                AND ABS(snap - column_amount) > 0.02
                AND NOT (ABS(snap - column_amount) <= 0.02)
                AND NOT (base_amount IS NOT NULL AND discount_amount > 0 AND ABS(snap - (base_amount - discount_amount)) <= 0.50)
                AND NOT (discount_amount > 0 AND ABS(column_amount - (snap - discount_amount)) <= 0.50)
                AND NOT (snap > 0 AND EXISTS (SELECT 1 FROM unnest(ARRAY[1.10,1.20,1.25,1.30,1.50]::numeric[]) m WHERE ABS((column_amount/snap) - m) <= 0.005))
                AND NOT (base_amount IS NOT NULL AND ABS(snap - base_amount) <= 0.02 AND column_amount > snap)
               THEN 'needs_manual_review_amount_conflict' END
        ], NULL)
      ) AS warnings_arr,
      (
        snap IS NOT NULL AND column_amount IS NOT NULL
        AND ABS(snap - column_amount) > 0.02
        AND NOT (base_amount IS NOT NULL AND discount_amount > 0 AND ABS(snap - (base_amount - discount_amount)) <= 0.50)
        AND NOT (discount_amount > 0 AND ABS(column_amount - (snap - discount_amount)) <= 0.50)
        AND NOT (snap > 0 AND EXISTS (SELECT 1 FROM unnest(ARRAY[1.10,1.20,1.25,1.30,1.50]::numeric[]) m WHERE ABS((column_amount/snap) - m) <= 0.005))
        AND NOT (base_amount IS NOT NULL AND ABS(snap - base_amount) <= 0.02 AND column_amount > snap)
      ) AS review_required_flag
    FROM calc
  )
  SELECT
    d.proposal_id,
    d.proposal_number,
    d.cliente,
    d.accepted_at,
    d.base_amount,
    d.column_amount,
    d.snap_payment_expected,
    d.snap_approved,
    d.schedule_total,
    d.discount_amount,
    d.manual_discount_percent,
    d.dynamic_label,
    d.ratio,
    ROUND(d.column_amount - d.snap, 2),
    d.resolved_amount,
    d.resolved_source,
    COALESCE(d.warnings_arr, ARRAY[]::text[]),
    d.review_required_flag,
    CASE
      WHEN d.snap IS NULL THEN 'no_snapshot'
      WHEN d.column_amount IS NULL THEN 'column_null'
      WHEN ABS(d.snap - d.column_amount) <= 0.02 THEN 'OK'
      WHEN d.review_required_flag THEN 'NEEDS_REVIEW'
      ELSE 'COLUMN_MISMATCH'
    END
  FROM decided d
  WHERE (d.snap IS NOT NULL OR d.column_amount IS NOT NULL)
    AND (d.snap IS NULL OR d.column_amount IS NULL OR ABS(d.snap - d.column_amount) > 0.02)
  ORDER BY ABS(COALESCE(d.column_amount - d.snap, 0)) DESC NULLS LAST;
END;
$function$;