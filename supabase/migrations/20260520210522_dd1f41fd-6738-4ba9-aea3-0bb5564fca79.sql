
-- ============================================================
-- PRICE CORE 2.0A — Proposal Pricing Ledger
-- Fonte única da verdade financeira de propostas
-- ============================================================

-- 1) Campos espelho na tabela proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS pricing_subtotal_items numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_recurring_subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_manual_discount_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_manual_discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_inventory_adjustment_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_base_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_dynamic_adjustment_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_dynamic_adjustment_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_effective_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_payment_schedule_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_erp_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_approval_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_breakdown_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_last_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_has_divergence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_divergence_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_needs_recalculation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_proposals_pricing_needs_recalc
  ON public.proposals(organization_id) WHERE pricing_needs_recalculation = true;
CREATE INDEX IF NOT EXISTS idx_proposals_pricing_has_divergence
  ON public.proposals(organization_id) WHERE pricing_has_divergence = true;

-- ============================================================
-- 2) Helper: resolve_manual_discount
-- Fonte canônica: proposal_payment_terms.discount_percent (one_time, MAX).
-- Fallback legacy: proposals.discount_amount / subtotal_one_time.
-- Warning quando ambos > 0 e divergentes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_manual_discount(
  p_proposal_id uuid,
  p_subtotal_one_time numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pt_pct numeric := 0;
  v_legacy_amount numeric := 0;
  v_legacy_pct numeric := 0;
  v_final_pct numeric := 0;
  v_warning jsonb := NULL;
BEGIN
  SELECT COALESCE(MAX(COALESCE(discount_percent, 0)), 0)
    INTO v_pt_pct
    FROM public.proposal_payment_terms
   WHERE proposal_id = p_proposal_id AND payment_type = 'one_time';
  v_pt_pct := LEAST(GREATEST(v_pt_pct, 0), 100);

  SELECT COALESCE(discount_amount, 0) INTO v_legacy_amount
    FROM public.proposals WHERE id = p_proposal_id;

  IF p_subtotal_one_time > 0 AND v_legacy_amount > 0 THEN
    v_legacy_pct := ROUND((v_legacy_amount / p_subtotal_one_time * 100.0)::numeric, 4);
  END IF;

  IF v_pt_pct > 0 THEN
    v_final_pct := v_pt_pct;
    IF v_legacy_pct > 0 AND ABS(v_legacy_pct - v_pt_pct) > 0.01 THEN
      v_warning := jsonb_build_object(
        'code', 'manual_discount_double_source',
        'payment_terms_pct', v_pt_pct,
        'legacy_pct', v_legacy_pct,
        'legacy_amount', v_legacy_amount
      );
    END IF;
  ELSIF v_legacy_pct > 0 THEN
    v_final_pct := v_legacy_pct;
    v_warning := jsonb_build_object(
      'code', 'manual_discount_legacy_fallback',
      'legacy_pct', v_legacy_pct,
      'legacy_amount', v_legacy_amount
    );
  END IF;

  RETURN jsonb_build_object(
    'percent', v_final_pct,
    'source', CASE WHEN v_pt_pct > 0 THEN 'payment_terms' WHEN v_legacy_pct > 0 THEN 'legacy_discount_amount' ELSE 'none' END,
    'warning', v_warning
  );
END;
$$;

-- ============================================================
-- 3) RPC principal: recalculate_proposal_pricing_ledger
-- Única função autorizada a gravar campos pricing_*.
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_proposal_pricing_ledger(
  p_proposal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_subtotal_one_time numeric := 0;
  v_subtotal_recurring numeric := 0;
  v_inventory_adj numeric := 0;
  v_discount_info jsonb;
  v_discount_pct numeric := 0;
  v_discount_amount numeric := 0;
  v_base_amount numeric := 0;
  v_dyn_enabled boolean := false;
  v_dyn_applicability text := 'manual';
  v_dyn_mode text;
  v_dyn_pct numeric := 0;
  v_dyn_amount numeric := 0;
  v_dyn_tier RECORD;
  v_dyn_next_tier RECORD;
  v_dyn_prev_tier RECORD;
  v_reference_date timestamptz;
  v_effective_amount numeric := 0;
  v_schedule jsonb := '[]'::jsonb;
  v_schedule_total numeric := 0;
  v_schedule_diff numeric := 0;
  v_has_divergence boolean := false;
  v_divergence jsonb := '{}'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_pt RECORD;
  v_installment_amount numeric;
  v_remaining numeric;
  v_i integer;
  v_due date;
  v_lines jsonb := '[]'::jsonb;
  v_is_frozen boolean := false;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROPOSAL_NOT_FOUND');
  END IF;

  -- Guarda anti-recursão para triggers
  PERFORM set_config('pricing_ledger.skip_dirty', '1', true);

  -- ---- Congelamento após aprovação ----
  v_is_frozen := (v_proposal.status = 'accepted' AND COALESCE(v_proposal.price_frozen_on_approval, false) = true);

  -- ---- Subtotais a partir dos itens ----
  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(billing_type,'one_time') <> 'recurring' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN billing_type = 'recurring' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(billing_type,'one_time') <> 'recurring' THEN COALESCE(inventory_adjustment_amount,0) ELSE 0 END), 0)
  INTO v_subtotal_one_time, v_subtotal_recurring, v_inventory_adj
  FROM public.proposal_items
  WHERE proposal_id = p_proposal_id;

  -- ---- Desconto manual ----
  v_discount_info := public.resolve_manual_discount(p_proposal_id, v_subtotal_one_time);
  v_discount_pct := COALESCE((v_discount_info->>'percent')::numeric, 0);
  v_discount_amount := ROUND((v_subtotal_one_time * v_discount_pct / 100.0)::numeric, 2);
  IF (v_discount_info->'warning') IS NOT NULL AND v_discount_info->'warning' <> 'null'::jsonb THEN
    v_warnings := v_warnings || jsonb_build_array(v_discount_info->'warning');
  END IF;

  -- ---- Base comercial ----
  v_base_amount := ROUND((v_subtotal_one_time - v_discount_amount + v_inventory_adj)::numeric, 2);

  -- ---- Ajuste dinâmico ----
  v_dyn_enabled := COALESCE(v_proposal.dynamic_pricing_enabled, false);
  v_dyn_applicability := COALESCE(v_proposal.dynamic_pricing_applicability, 'manual');
  v_dyn_mode := v_proposal.dynamic_pricing_mode;

  v_reference_date := COALESCE(
    v_proposal.dynamic_pricing_reference_date,
    (SELECT MIN(dynamic_pricing_reference_date)::timestamptz FROM public.proposal_payment_terms WHERE proposal_id = p_proposal_id AND dynamic_pricing_reference_date IS NOT NULL),
    now()
  );

  IF v_dyn_enabled AND v_subtotal_recurring = 0 THEN
    -- Tier ativo: starts_at <= ref < ends_at; se nenhum, pega o último ainda válido
    SELECT * INTO v_dyn_tier
      FROM public.proposal_dynamic_pricing_tiers
     WHERE proposal_id = p_proposal_id
       AND starts_at <= v_reference_date
       AND (ends_at IS NULL OR ends_at > v_reference_date)
     ORDER BY tier_order DESC
     LIMIT 1;

    IF v_dyn_tier.id IS NOT NULL THEN
      IF v_dyn_tier.adjustment_type IN ('percent','percentage','pct') THEN
        v_dyn_pct := COALESCE(v_dyn_tier.adjustment_value, 0);
        v_dyn_amount := ROUND((v_base_amount * v_dyn_pct / 100.0)::numeric, 2);
      ELSIF v_dyn_tier.adjustment_type IN ('amount','flat','absolute') THEN
        v_dyn_amount := ROUND(COALESCE(v_dyn_tier.adjustment_value, 0)::numeric, 2);
        v_dyn_pct := CASE WHEN v_base_amount > 0 THEN ROUND((v_dyn_amount / v_base_amount * 100.0)::numeric, 4) ELSE 0 END;
      ELSIF v_dyn_tier.final_amount IS NOT NULL THEN
        v_dyn_amount := ROUND((v_dyn_tier.final_amount - v_base_amount)::numeric, 2);
        v_dyn_pct := CASE WHEN v_base_amount > 0 THEN ROUND((v_dyn_amount / v_base_amount * 100.0)::numeric, 4) ELSE 0 END;
      END IF;

      SELECT * INTO v_dyn_next_tier
        FROM public.proposal_dynamic_pricing_tiers
       WHERE proposal_id = p_proposal_id AND starts_at > v_reference_date
       ORDER BY starts_at ASC LIMIT 1;
      SELECT * INTO v_dyn_prev_tier
        FROM public.proposal_dynamic_pricing_tiers
       WHERE proposal_id = p_proposal_id AND ends_at IS NOT NULL AND ends_at <= v_reference_date
       ORDER BY ends_at DESC LIMIT 1;
    END IF;
  END IF;

  -- ---- Valor vigente ----
  v_effective_amount := ROUND((v_base_amount + v_dyn_amount + v_subtotal_recurring)::numeric, 2);

  -- ---- Cronograma (com última parcela absorvendo resíduo) ----
  v_lines := '[]'::jsonb;
  v_schedule_total := 0;

  SELECT * INTO v_pt FROM public.proposal_payment_terms
   WHERE proposal_id = p_proposal_id AND payment_type = 'one_time'
   ORDER BY created_at ASC LIMIT 1;

  IF v_pt.id IS NOT NULL THEN
    IF v_pt.manual_schedule IS NOT NULL AND jsonb_typeof(v_pt.manual_schedule) = 'array' AND jsonb_array_length(v_pt.manual_schedule) > 0 THEN
      v_lines := v_pt.manual_schedule;
      SELECT COALESCE(SUM((value->>'amount')::numeric), 0) INTO v_schedule_total FROM jsonb_array_elements(v_lines) AS value;
    ELSE
      -- gera cronograma baseado em entry + installments
      DECLARE
        v_entry_amount numeric := 0;
        v_entry_pct numeric := COALESCE(v_pt.entry_percent, 0);
        v_installments integer := GREATEST(COALESCE(v_pt.installments, 1), 1);
        v_rest numeric;
        v_acc numeric := 0;
      BEGIN
        v_entry_amount := ROUND((v_base_amount + v_dyn_amount) * v_entry_pct / 100.0, 2);
        v_rest := ROUND((v_base_amount + v_dyn_amount - v_entry_amount)::numeric, 2);
        IF v_entry_amount > 0 THEN
          v_lines := v_lines || jsonb_build_array(jsonb_build_object(
            'index', 0,
            'label', 'Entrada',
            'amount', v_entry_amount,
            'due_date', COALESCE(v_pt.entry_date::text, CURRENT_DATE::text)
          ));
          v_acc := v_entry_amount;
        END IF;

        IF v_installments > 0 AND v_rest > 0 THEN
          v_installment_amount := ROUND((v_rest / v_installments)::numeric, 2);
          FOR v_i IN 1..v_installments LOOP
            v_due := COALESCE(v_pt.first_installment_date, v_pt.first_payment_date, CURRENT_DATE)
                     + ((v_i - 1) * COALESCE(v_pt.installment_interval_days, 30)) * INTERVAL '1 day';
            IF v_i = v_installments THEN
              -- absorve o resíduo
              v_installment_amount := ROUND((v_rest - (v_installment_amount * (v_installments - 1)))::numeric, 2);
            END IF;
            v_lines := v_lines || jsonb_build_array(jsonb_build_object(
              'index', v_i,
              'label', 'Parcela ' || v_i || '/' || v_installments,
              'amount', v_installment_amount,
              'due_date', v_due::text
            ));
            v_acc := v_acc + v_installment_amount;
          END LOOP;
        END IF;
        v_schedule_total := v_acc;
      END;
    END IF;
  ELSE
    -- sem payment_terms one_time: cronograma = valor vigente em 1 parcela
    IF (v_base_amount + v_dyn_amount) > 0 THEN
      v_lines := jsonb_build_array(jsonb_build_object(
        'index', 1, 'label', 'Pagamento único',
        'amount', v_base_amount + v_dyn_amount,
        'due_date', CURRENT_DATE::text
      ));
      v_schedule_total := v_base_amount + v_dyn_amount;
    END IF;
  END IF;

  -- Recorrente entra como linhas adicionais (informativo)
  IF v_subtotal_recurring > 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'index', 999, 'label', 'Mensalidade recorrente',
      'amount', v_subtotal_recurring,
      'due_date', NULL,
      'recurring', true
    ));
    v_schedule_total := v_schedule_total + v_subtotal_recurring;
  END IF;

  v_schedule := v_lines;
  v_schedule_diff := ABS(v_effective_amount - v_schedule_total);

  -- ---- Divergência ----
  v_has_divergence := v_schedule_diff > 0.01;
  v_divergence := jsonb_build_object(
    'schedule_diff', v_schedule_diff,
    'effective_amount', v_effective_amount,
    'schedule_total', v_schedule_total
  );

  IF v_is_frozen AND ABS(COALESCE(v_proposal.approved_amount, 0) - v_effective_amount) > 0.01 THEN
    v_has_divergence := true;
    v_divergence := v_divergence || jsonb_build_object(
      'frozen_approved_amount', v_proposal.approved_amount,
      'shadow_effective_amount', v_effective_amount,
      'reason', 'frozen_vs_shadow_mismatch'
    );
  END IF;

  -- ---- Snapshot ----
  v_snapshot := jsonb_build_object(
    'version', 2,
    'calculated_at', now(),
    'proposal_id', p_proposal_id,
    'frozen', v_is_frozen,
    'reference_date', v_reference_date,
    'subtotal_items', v_subtotal_one_time,
    'recurring_subtotal', v_subtotal_recurring,
    'manual_discount', jsonb_build_object(
      'percent', v_discount_pct,
      'amount', v_discount_amount,
      'source', v_discount_info->>'source'
    ),
    'inventory_adjustment_amount', v_inventory_adj,
    'base_amount', v_base_amount,
    'dynamic_adjustment', jsonb_build_object(
      'enabled', v_dyn_enabled,
      'applicability', v_dyn_applicability,
      'mode', v_dyn_mode,
      'percent', v_dyn_pct,
      'amount', v_dyn_amount,
      'tier_id', v_dyn_tier.id,
      'tier_label', v_dyn_tier.label,
      'tier_starts_at', v_dyn_tier.starts_at,
      'tier_ends_at', v_dyn_tier.ends_at,
      'next_tier_id', v_dyn_next_tier.id,
      'next_tier_starts_at', v_dyn_next_tier.starts_at,
      'previous_tier_id', v_dyn_prev_tier.id,
      'previous_tier_final_amount', v_dyn_prev_tier.final_amount
    ),
    'effective_amount', v_effective_amount,
    'payment_schedule', v_schedule,
    'payment_schedule_total', v_schedule_total,
    'erp_amount', v_schedule_total,
    'approval_amount', v_effective_amount,
    'has_divergence', v_has_divergence,
    'divergence_details', v_divergence,
    'warnings', v_warnings,
    'pricing_status', CASE
      WHEN v_is_frozen THEN 'frozen'
      WHEN v_has_divergence THEN 'divergent'
      ELSE 'ok'
    END
  );

  -- ---- Persistência (respeita congelamento) ----
  IF v_is_frozen THEN
    -- Mantém os campos públicos como estavam; só atualiza shadow + flags internas
    UPDATE public.proposals SET
      pricing_breakdown_snapshot = COALESCE(approval_snapshot, pricing_breakdown_snapshot),
      pricing_divergence_details = v_divergence,
      pricing_has_divergence = v_has_divergence,
      pricing_needs_recalculation = false,
      pricing_last_calculated_at = now()
    WHERE id = p_proposal_id;
  ELSE
    UPDATE public.proposals SET
      pricing_subtotal_items = v_subtotal_one_time,
      pricing_recurring_subtotal = v_subtotal_recurring,
      pricing_manual_discount_percent = v_discount_pct,
      pricing_manual_discount_amount = v_discount_amount,
      pricing_inventory_adjustment_amount = v_inventory_adj,
      pricing_base_amount = v_base_amount,
      pricing_dynamic_adjustment_percent = v_dyn_pct,
      pricing_dynamic_adjustment_amount = v_dyn_amount,
      pricing_effective_amount = v_effective_amount,
      pricing_payment_schedule_total = v_schedule_total,
      pricing_erp_amount = v_schedule_total,
      pricing_approval_amount = v_effective_amount,
      pricing_breakdown_snapshot = v_snapshot,
      pricing_has_divergence = v_has_divergence,
      pricing_divergence_details = v_divergence,
      pricing_needs_recalculation = false,
      pricing_last_calculated_at = now(),
      dynamic_pricing_current_amount = CASE WHEN v_dyn_enabled THEN v_base_amount + v_dyn_amount ELSE dynamic_pricing_current_amount END,
      payment_expected_amount = v_schedule_total
    WHERE id = p_proposal_id;
  END IF;

  PERFORM set_config('pricing_ledger.skip_dirty', '0', true);

  RETURN jsonb_build_object('ok', true, 'snapshot', v_snapshot);
END;
$$;

-- ============================================================
-- 4) Triggers de marcação (NÃO recálculo direto)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_proposal_pricing_dirty(p_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_proposal_id IS NULL THEN RETURN; END IF;
  IF current_setting('pricing_ledger.skip_dirty', true) = '1' THEN RETURN; END IF;
  UPDATE public.proposals
     SET pricing_needs_recalculation = true
   WHERE id = p_proposal_id
     AND pricing_needs_recalculation = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_proposal_items_mark_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.mark_proposal_pricing_dirty(COALESCE(NEW.proposal_id, OLD.proposal_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_items_mark_pricing_dirty ON public.proposal_items;
CREATE TRIGGER trg_proposal_items_mark_pricing_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.proposal_items
FOR EACH ROW EXECUTE FUNCTION public.trg_proposal_items_mark_dirty();

CREATE OR REPLACE FUNCTION public.trg_proposal_payment_terms_mark_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.mark_proposal_pricing_dirty(COALESCE(NEW.proposal_id, OLD.proposal_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_payment_terms_mark_pricing_dirty ON public.proposal_payment_terms;
CREATE TRIGGER trg_proposal_payment_terms_mark_pricing_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.proposal_payment_terms
FOR EACH ROW EXECUTE FUNCTION public.trg_proposal_payment_terms_mark_dirty();

CREATE OR REPLACE FUNCTION public.trg_proposals_self_mark_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('pricing_ledger.skip_dirty', true) = '1' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (
       NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
    OR NEW.dynamic_pricing_enabled IS DISTINCT FROM OLD.dynamic_pricing_enabled
    OR NEW.dynamic_pricing_applicability IS DISTINCT FROM OLD.dynamic_pricing_applicability
    OR NEW.dynamic_pricing_mode IS DISTINCT FROM OLD.dynamic_pricing_mode
    OR NEW.dynamic_pricing_reference_date IS DISTINCT FROM OLD.dynamic_pricing_reference_date
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
  ) THEN
    NEW.pricing_needs_recalculation := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposals_self_mark_pricing_dirty ON public.proposals;
CREATE TRIGGER trg_proposals_self_mark_pricing_dirty
BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.trg_proposals_self_mark_dirty();

-- Mudança em regra/tier de pricing dinâmico marca apenas propostas que usam applicability=automatic
CREATE OR REPLACE FUNCTION public.trg_dynamic_pricing_rules_mark_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_proposal uuid;
BEGIN
  v_org := COALESCE(NEW.organization_id, OLD.organization_id);
  v_proposal := COALESCE(NEW.proposal_id, OLD.proposal_id);

  IF v_proposal IS NOT NULL THEN
    PERFORM public.mark_proposal_pricing_dirty(v_proposal);
  ELSIF v_org IS NOT NULL THEN
    UPDATE public.proposals
       SET pricing_needs_recalculation = true
     WHERE organization_id = v_org
       AND pricing_needs_recalculation = false
       AND COALESCE(dynamic_pricing_applicability, 'manual') = 'automatic'
       AND status IN ('draft', 'sent', 'viewed', 'pending_approval');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dpr_mark_pricing_dirty ON public.proposal_dynamic_pricing_rules;
CREATE TRIGGER trg_dpr_mark_pricing_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.proposal_dynamic_pricing_rules
FOR EACH ROW EXECUTE FUNCTION public.trg_dynamic_pricing_rules_mark_dirty();

DROP TRIGGER IF EXISTS trg_dpt_mark_pricing_dirty ON public.proposal_dynamic_pricing_tiers;
CREATE TRIGGER trg_dpt_mark_pricing_dirty
AFTER INSERT OR UPDATE OR DELETE ON public.proposal_dynamic_pricing_tiers
FOR EACH ROW EXECUTE FUNCTION public.trg_dynamic_pricing_rules_mark_dirty();

-- ============================================================
-- 5) Permissões
-- ============================================================
GRANT EXECUTE ON FUNCTION public.recalculate_proposal_pricing_ledger(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.resolve_manual_discount(uuid, numeric) TO authenticated, service_role;

-- ============================================================
-- 6) Backfill: marca todas as propostas vivas como dirty
-- ============================================================
UPDATE public.proposals
   SET pricing_needs_recalculation = true
 WHERE deleted_at IS NULL
   AND status IN ('draft', 'sent', 'viewed', 'pending_approval');
