-- =========================================================================
-- P0: Stop proposal cloning on operational handoff + audit hardening
-- =========================================================================

-- 1) Link operacional → proposta aprovada original
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS accepted_proposal_id uuid NULL;

DO $$ BEGIN
  ALTER TABLE public.opportunities
    ADD CONSTRAINT opportunities_accepted_proposal_id_fkey
    FOREIGN KEY (accepted_proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_opportunities_accepted_proposal
  ON public.opportunities(accepted_proposal_id)
  WHERE accepted_proposal_id IS NOT NULL;

-- 2) Marcação em propostas
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS clone_status text NULL,
  ADD COLUMN IF NOT EXISTS superseded_by_proposal_id uuid NULL;

DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_clone_status_chk
    CHECK (clone_status IS NULL OR clone_status IN ('active','clone_error','superseded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_superseded_by_proposal_id_fkey
    FOREIGN KEY (superseded_by_proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_proposals_clone_status
  ON public.proposals(clone_status)
  WHERE clone_status IS NOT NULL;

-- 3) Expandir audit_scope_status para incluir clone_error
DO $$ BEGIN
  ALTER TABLE public.proposal_financial_audit_items
    DROP CONSTRAINT IF EXISTS proposal_financial_audit_items_scope_status_chk;
  ALTER TABLE public.proposal_financial_audit_items
    ADD CONSTRAINT proposal_financial_audit_items_scope_status_chk
    CHECK (audit_scope_status IN (
      'in_scope','out_of_scope_duplicate','out_of_scope_superseded',
      'out_of_scope_draft','out_of_scope_old_version','out_of_scope_non_winning',
      'out_of_scope_clone_error','needs_scope_review'
    ));
END $$;

-- 4) Trigger DB: bloqueia INSERT de proposta-clone em oportunidade operacional
--    quando a oportunidade de origem já tem proposta aceita pelo cliente.
CREATE OR REPLACE FUNCTION public.block_operational_proposal_clone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_opp_id uuid;
  v_pipeline_type text;
  v_has_accepted boolean := false;
BEGIN
  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.source_opportunity_id, p.pipeline_type
    INTO v_source_opp_id, v_pipeline_type
    FROM public.opportunities o
    LEFT JOIN public.pipelines p ON p.id = o.pipeline_id
   WHERE o.id = NEW.opportunity_id;

  IF v_source_opp_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_pipeline_type NOT IN ('onboarding','renewal') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.proposals pr
     WHERE pr.opportunity_id = v_source_opp_id
       AND pr.deleted_at IS NULL
       AND (pr.accepted_at IS NOT NULL OR pr.status IN ('accepted','approved','won'))
  ) INTO v_has_accepted;

  IF v_has_accepted THEN
    RAISE EXCEPTION 'OPERATIONAL_PROPOSAL_CLONE_BLOCKED: a oportunidade % é operacional e a comercial de origem (%) já tem proposta aprovada. Use opportunities.accepted_proposal_id em vez de criar um clone.',
      NEW.opportunity_id, v_source_opp_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_operational_proposal_clone ON public.proposals;
CREATE TRIGGER trg_block_operational_proposal_clone
  BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.block_operational_proposal_clone();

-- 5) RPC v4: estende a auditoria para detectar clones operacionais legados
CREATE OR REPLACE FUNCTION public.run_proposal_financial_audit(
  p_period_start date, p_period_end date, p_dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_user uuid; v_run_id uuid; v_proposal record;
  v_intent_expected numeric; v_erp_payload jsonb;
  v_slack_amount numeric; v_slack_payload jsonb;
  v_deal_amount numeric; v_ledger_effective numeric; v_ledger_erp numeric;
  v_payment_schedule_total numeric; v_approval_snapshot jsonb; v_snap_amount numeric;
  v_reconstructed numeric; v_max_delta numeric;
  v_canonical numeric; v_canonical_source text;
  v_div text[]; v_audit_status text; v_action text;
  v_total int := 0; v_ok int := 0; v_div_count int := 0; v_review_count int := 0;
  v_total_approved numeric := 0; v_total_delta numeric := 0;
  v_in_scope_count int := 0; v_out_count int := 0; v_scope_review_count int := 0;
  v_in_scope_delta numeric := 0; v_out_scope_delta numeric := 0;
  v_amounts numeric[]; v_a numeric; v_b numeric; v_i int; v_j int;
  v_approved_at timestamptz;
  v_items_total numeric;
  v_gross numeric; v_disc_amount numeric; v_disc_percent numeric;
  v_expected_net numeric; v_has_manual_discount boolean;
  v_snap_ignores_discount boolean;
  v_erp_sent_amount numeric;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN RAISE EXCEPTION 'no_organization'; END IF;
  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'owner')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  IF p_period_end < p_period_start THEN RAISE EXCEPTION 'invalid_period'; END IF;

  INSERT INTO public.proposal_financial_audit_runs(
    organization_id, period_start, period_end, status, dry_run, created_by
  ) VALUES (v_org, p_period_start, p_period_end, 'running', p_dry_run, v_user)
  RETURNING id INTO v_run_id;

  CREATE TEMP TABLE _audit_candidates ON COMMIT DROP AS
  WITH base AS (
    SELECT
      p.id, p.proposal_number, p.organization_id, p.opportunity_id, p.status,
      p.approval_snapshot, p.approved_amount, p.total_amount,
      p.discount_amount, p.pricing_manual_discount_percent, p.pricing_manual_discount_amount,
      p.accepted_at, p.sent_at, p.created_at, p.signed_at, p.price_frozen_at, p.updated_at,
      p.clone_status,
      COALESCE(p.accepted_at, p.signed_at, p.price_frozen_at, p.updated_at) AS approved_at,
      o.id AS opp_id, o.title AS opp_title, o.status AS opp_status,
      o.valor_previsto AS opp_value, o.account_id,
      o.source_opportunity_id AS opp_source_opp_id,
      pl.pipeline_type AS pipeline_type,
      a.nome_fantasia, a.razao_social,
      (p.status IN ('accepted','approved','won') OR p.accepted_at IS NOT NULL) AS has_accept,
      (p.approval_snapshot IS NOT NULL AND p.approval_snapshot::text <> '{}'::text) AS has_snapshot,
      (p.approved_amount IS NOT NULL) AS has_approved_amount,
      EXISTS(SELECT 1 FROM public.proposal_payment_intents pi WHERE pi.proposal_id = p.id) AS has_payment_intent,
      EXISTS(SELECT 1 FROM public.proposal_erp_sync_logs es WHERE es.proposal_id = p.id) AS has_erp_sync,
      (o.status IN ('won','ganha','closed_won')) AS opp_is_won
    FROM public.proposals p
    LEFT JOIN public.opportunities o ON o.id = p.opportunity_id
    LEFT JOIN public.pipelines pl ON pl.id = o.pipeline_id
    LEFT JOIN public.accounts a ON a.id = o.account_id
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND COALESCE(p.accepted_at, p.signed_at, p.price_frozen_at, p.updated_at)::date
          BETWEEN p_period_start AND p_period_end
  ),
  scored AS (
    SELECT b.*,
      ( CASE WHEN b.has_accept THEN 1000 ELSE 0 END
      + CASE WHEN b.opp_is_won AND b.has_accept THEN 500 ELSE 0 END
      + CASE WHEN b.has_snapshot THEN 100 ELSE 0 END
      + CASE WHEN b.has_approved_amount THEN 50 ELSE 0 END
      + CASE WHEN b.has_payment_intent OR b.has_erp_sync THEN 30 ELSE 0 END
      ) AS score
    FROM base b
  ),
  ranked AS (
    SELECT s.*,
      ROW_NUMBER() OVER (
        PARTITION BY s.opp_id
        ORDER BY s.score DESC,
                 s.accepted_at DESC NULLS LAST,
                 s.sent_at DESC NULLS LAST,
                 s.created_at DESC
      ) AS rank_for_opp,
      MAX(s.score) OVER (PARTITION BY s.opp_id) AS opp_max_score,
      COUNT(*) OVER (PARTITION BY s.opp_id) AS opp_proposal_count
    FROM scored s
  ),
  clones AS (
    SELECT r.id,
      EXISTS(
        SELECT 1 FROM ranked r2
        WHERE r2.account_id IS NOT NULL
          AND r2.account_id = r.account_id
          AND r2.opp_id <> r.opp_id
          AND lower(coalesce(r2.opp_title,'')) = lower(coalesce(r.opp_title,''))
          AND r2.has_accept = true
      ) AS is_operational_clone,
      -- Detecção forte: opp tem source_opportunity_id + pipeline operacional + origem tem proposta aceita
      (
        r.opp_source_opp_id IS NOT NULL
        AND r.pipeline_type IN ('onboarding','renewal')
        AND EXISTS(
          SELECT 1 FROM public.proposals pr_src
           WHERE pr_src.opportunity_id = r.opp_source_opp_id
             AND pr_src.deleted_at IS NULL
             AND (pr_src.accepted_at IS NOT NULL OR pr_src.status IN ('accepted','approved','won'))
        )
      ) AS is_operational_clone_strong,
      (
        SELECT pr_src.id FROM public.proposals pr_src
         WHERE pr_src.opportunity_id = r.opp_source_opp_id
           AND pr_src.deleted_at IS NULL
           AND (pr_src.accepted_at IS NOT NULL OR pr_src.status IN ('accepted','approved','won'))
         ORDER BY pr_src.accepted_at DESC NULLS LAST, pr_src.updated_at DESC
         LIMIT 1
      ) AS source_approved_proposal_id
    FROM ranked r
  )
  SELECT r.*, c.is_operational_clone, c.is_operational_clone_strong, c.source_approved_proposal_id
  FROM ranked r LEFT JOIN clones c ON c.id = r.id;

  FOR v_proposal IN SELECT * FROM _audit_candidates LOOP
    DECLARE
      v_winning boolean;
      v_scope_status text;
      v_select_reason text;
    BEGIN
    v_total := v_total + 1;
    v_div := ARRAY[]::text[]; v_reconstructed := NULL;
    v_approved_at := v_proposal.approved_at;

    v_slack_amount := NULL; v_slack_payload := NULL;
    BEGIN
      SELECT (ndl.provider_response->>'amount')::numeric, ndl.provider_response
        INTO v_slack_amount, v_slack_payload
        FROM public.notification_delivery_logs ndl
        JOIN public.notifications_v2 n ON n.id = ndl.notification_id
       WHERE ndl.channel::text = 'slack'
         AND (n.payload->>'proposal_id')::uuid = v_proposal.id
         AND (ndl.provider_response ? 'amount')
       ORDER BY ndl.attempted_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_slack_amount := NULL; END;

    v_deal_amount := v_proposal.opp_value;

    v_ledger_effective := NULL; v_ledger_erp := NULL;
    BEGIN
      SELECT effective_amount, erp_amount INTO v_ledger_effective, v_ledger_erp
        FROM public.proposal_pricing_ledger
       WHERE proposal_id = v_proposal.id
       ORDER BY created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_ledger_effective := NULL; END;

    v_items_total := NULL;
    BEGIN
      SELECT COALESCE(SUM(total),0) INTO v_items_total
        FROM public.proposal_items WHERE proposal_id = v_proposal.id;
    EXCEPTION WHEN OTHERS THEN v_items_total := NULL; END;

    v_payment_schedule_total := NULL;
    BEGIN
      SELECT COALESCE(SUM(amount),0) INTO v_payment_schedule_total
        FROM public.proposal_payment_schedule WHERE proposal_id = v_proposal.id;
    EXCEPTION WHEN OTHERS THEN v_payment_schedule_total := NULL; END;

    v_intent_expected := NULL;
    BEGIN
      SELECT expected_amount INTO v_intent_expected
        FROM public.proposal_payment_intents
       WHERE proposal_id = v_proposal.id
       ORDER BY created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_intent_expected := NULL; END;

    v_erp_payload := NULL; v_erp_sent_amount := NULL;
    BEGIN
      SELECT payload INTO v_erp_payload
        FROM public.proposal_erp_sync_logs
       WHERE proposal_id = v_proposal.id
       ORDER BY created_at DESC LIMIT 1;
      v_erp_sent_amount := NULLIF(v_erp_payload->>'amount','')::numeric;
    EXCEPTION WHEN OTHERS THEN v_erp_payload := NULL; END;

    v_approval_snapshot := v_proposal.approval_snapshot;
    v_snap_amount := COALESCE(
      NULLIF(v_approval_snapshot->>'effective_amount','')::numeric,
      NULLIF(v_approval_snapshot->>'approved_amount','')::numeric,
      NULLIF(v_approval_snapshot->>'payment_expected_amount','')::numeric,
      NULLIF(v_approval_snapshot->'dynamic_pricing'->>'current_amount','')::numeric
    );

    v_disc_amount := COALESCE(
      NULLIF(v_proposal.pricing_manual_discount_amount,0),
      v_proposal.discount_amount, 0);
    v_disc_percent := COALESCE(NULLIF(v_proposal.pricing_manual_discount_percent,0), 0);
    v_gross := COALESCE(NULLIF(v_items_total,0),
                        CASE WHEN v_proposal.approved_amount IS NOT NULL AND v_disc_amount > 0
                             THEN v_proposal.approved_amount + v_disc_amount END);
    IF v_disc_percent = 0 AND v_disc_amount > 0 AND v_gross IS NOT NULL AND v_gross > 0 THEN
      v_disc_percent := round((v_disc_amount / v_gross) * 100, 2);
    END IF;
    v_has_manual_discount := COALESCE(v_disc_amount,0) > 0.01;
    v_expected_net := CASE WHEN v_gross IS NOT NULL AND v_has_manual_discount
                           THEN round(v_gross - v_disc_amount, 2) END;
    v_snap_ignores_discount := v_has_manual_discount
      AND v_snap_amount IS NOT NULL AND v_gross IS NOT NULL
      AND abs(v_snap_amount - v_gross) <= 0.01
      AND v_expected_net IS NOT NULL
      AND abs(v_snap_amount - v_expected_net) > 0.01;

    v_canonical := NULL; v_canonical_source := NULL;
    IF v_has_manual_discount AND v_expected_net IS NOT NULL THEN
      IF v_proposal.approved_amount IS NOT NULL AND abs(v_proposal.approved_amount - v_expected_net) <= 0.01 THEN
        v_canonical := v_proposal.approved_amount; v_canonical_source := 'approved_amount';
      ELSIF v_payment_schedule_total IS NOT NULL AND v_payment_schedule_total > 0
            AND abs(v_payment_schedule_total - v_expected_net) <= 0.01 THEN
        v_canonical := v_payment_schedule_total; v_canonical_source := 'approved_payment_schedule';
      ELSIF v_deal_amount IS NOT NULL AND abs(v_deal_amount - v_expected_net) <= 0.01 THEN
        v_canonical := v_deal_amount; v_canonical_source := 'approved_amount';
      ELSIF NOT v_snap_ignores_discount AND v_snap_amount IS NOT NULL THEN
        v_canonical := v_snap_amount; v_canonical_source := 'approval_snapshot';
      ELSE
        v_canonical := v_expected_net; v_canonical_source := 'manual_review';
      END IF;
    ELSE
      IF v_snap_amount IS NOT NULL THEN
        v_canonical := v_snap_amount; v_canonical_source := 'approval_snapshot';
      ELSIF v_proposal.approved_amount IS NOT NULL THEN
        v_canonical := v_proposal.approved_amount; v_canonical_source := 'approved_amount';
      ELSIF v_payment_schedule_total IS NOT NULL AND v_payment_schedule_total > 0 THEN
        v_canonical := v_payment_schedule_total; v_canonical_source := 'approved_payment_schedule';
      ELSIF v_ledger_effective IS NOT NULL THEN
        v_canonical := v_ledger_effective; v_canonical_source := 'ledger';
        v_reconstructed := v_ledger_effective;
      ELSE v_canonical_source := 'indeterminate'; END IF;
    END IF;

    IF v_snap_amount IS NULL AND v_ledger_effective IS NOT NULL THEN
      v_reconstructed := v_ledger_effective; END IF;

    v_amounts := ARRAY[]::numeric[];
    IF v_canonical IS NOT NULL THEN v_amounts := array_append(v_amounts, v_canonical); END IF;
    IF v_deal_amount IS NOT NULL THEN v_amounts := array_append(v_amounts, v_deal_amount); END IF;
    IF v_proposal.total_amount IS NOT NULL THEN v_amounts := array_append(v_amounts, v_proposal.total_amount); END IF;
    IF v_proposal.approved_amount IS NOT NULL THEN v_amounts := array_append(v_amounts, v_proposal.approved_amount); END IF;
    IF v_items_total IS NOT NULL AND v_items_total > 0 THEN v_amounts := array_append(v_amounts, v_items_total); END IF;
    IF v_ledger_effective IS NOT NULL THEN v_amounts := array_append(v_amounts, v_ledger_effective); END IF;
    IF v_ledger_erp IS NOT NULL THEN v_amounts := array_append(v_amounts, v_ledger_erp); END IF;
    IF v_payment_schedule_total IS NOT NULL AND v_payment_schedule_total > 0 THEN v_amounts := array_append(v_amounts, v_payment_schedule_total); END IF;
    IF v_intent_expected IS NOT NULL THEN v_amounts := array_append(v_amounts, v_intent_expected); END IF;

    v_max_delta := 0;
    IF array_length(v_amounts,1) IS NOT NULL THEN
      FOR v_i IN 1..array_length(v_amounts,1) LOOP
        FOR v_j IN 1..array_length(v_amounts,1) LOOP
          v_a := v_amounts[v_i]; v_b := v_amounts[v_j];
          IF abs(v_a - v_b) > v_max_delta THEN v_max_delta := abs(v_a - v_b); END IF;
        END LOOP;
      END LOOP;
    END IF;

    IF v_slack_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_slack_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'DIVERGENCIA_SLACK'); END IF;
    IF v_deal_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_deal_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'deal_mismatch'); END IF;
    IF v_proposal.total_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_proposal.total_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'proposal_total_mismatch'); END IF;
    IF v_proposal.approved_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_proposal.approved_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'approved_amount_mismatch'); END IF;
    IF v_items_total IS NOT NULL AND v_items_total > 0 AND v_canonical IS NOT NULL AND abs(v_items_total - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'items_mismatch'); END IF;
    IF v_ledger_effective IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_ledger_effective - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'ledger_effective_mismatch'); END IF;
    IF v_payment_schedule_total IS NOT NULL AND v_payment_schedule_total > 0 AND v_canonical IS NOT NULL AND abs(v_payment_schedule_total - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'schedule_mismatch'); END IF;
    IF v_intent_expected IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_intent_expected - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'payment_intent_mismatch'); END IF;
    IF v_erp_sent_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_erp_sent_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'DIVERGENCIA_ERP'); END IF;
    IF v_snap_ignores_discount THEN
      v_div := array_append(v_div, 'DIVERGENCIA_APPROVAL_SNAPSHOT');
      v_div := array_append(v_div, 'APPROVAL_SNAPSHOT_IGNORES_MANUAL_DISCOUNT');
    ELSIF v_snap_amount IS NOT NULL AND v_canonical IS NOT NULL AND abs(v_snap_amount - v_canonical) > 0.01 THEN
      v_div := array_append(v_div, 'DIVERGENCIA_APPROVAL_SNAPSHOT');
    END IF;

    IF v_canonical_source IN ('indeterminate','manual_review') OR v_snap_ignores_discount THEN
      v_audit_status := 'needs_review'; v_action := 'manual_review';
      v_review_count := v_review_count + 1;
    ELSIF v_max_delta <= 0.01 AND array_length(v_div,1) IS NULL THEN
      v_audit_status := 'ok'; v_action := 'none'; v_ok := v_ok + 1;
    ELSE
      v_audit_status := 'divergent'; v_action := 'apply_safe'; v_div_count := v_div_count + 1;
    END IF;

    -- Escopo (com detecção forte de clone operacional)
    v_winning := (v_proposal.rank_for_opp = 1 AND v_proposal.opp_max_score >= 100);

    IF v_proposal.is_operational_clone_strong OR v_proposal.clone_status = 'clone_error' THEN
      v_scope_status := 'out_of_scope_clone_error';
      v_select_reason := 'Clone operacional indevido — a proposta válida é a aprovada na oportunidade comercial de origem.';
      v_div := array_append(v_div, 'OPERATIONAL_PROPOSAL_CLONE_SHOULD_NOT_EXIST');
      v_action := 'mark_clone_error_and_link_original';
    ELSIF v_proposal.status = 'draft' THEN
      v_scope_status := 'out_of_scope_draft';
      v_select_reason := 'Proposta em rascunho — não fechou ciclo.';
    ELSIF v_proposal.opp_max_score < 100 THEN
      v_scope_status := 'needs_scope_review';
      v_select_reason := 'Oportunidade sem evidência mínima de fechamento (sem accept/snapshot).';
    ELSIF v_proposal.is_operational_clone THEN
      v_scope_status := 'needs_scope_review';
      v_select_reason := 'Clone operacional: existe outra oportunidade vencedora do mesmo cliente/título.';
    ELSIF NOT v_winning THEN
      IF v_proposal.has_accept THEN
        v_scope_status := 'out_of_scope_non_winning';
        v_select_reason := 'Não é a proposta vencedora do ciclo desta oportunidade.';
      ELSE
        v_scope_status := 'out_of_scope_old_version';
        v_select_reason := 'Versão anterior sem aceite — substituída por proposta mais recente.';
      END IF;
    ELSE
      v_scope_status := 'in_scope';
      v_select_reason := 'Proposta vencedora da oportunidade (rank 1, evidência ≥ snapshot).';
    END IF;

    IF v_scope_status = 'in_scope' THEN
      v_in_scope_count := v_in_scope_count + 1;
      v_in_scope_delta := v_in_scope_delta + COALESCE(v_max_delta,0);
      IF v_canonical IS NOT NULL THEN v_total_approved := v_total_approved + v_canonical; END IF;
    ELSIF v_scope_status = 'needs_scope_review' THEN
      v_scope_review_count := v_scope_review_count + 1;
      v_out_scope_delta := v_out_scope_delta + COALESCE(v_max_delta,0);
    ELSE
      v_out_count := v_out_count + 1;
      v_out_scope_delta := v_out_scope_delta + COALESCE(v_max_delta,0);
    END IF;
    v_total_delta := v_total_delta + COALESCE(v_max_delta,0);

    INSERT INTO public.proposal_financial_audit_items(
      audit_run_id, organization_id, proposal_id, proposal_number, opportunity_id,
      account_name, proposal_status, opportunity_status, approved_at,
      slack_amount, deal_amount, proposal_total_amount,
      ledger_effective_amount, ledger_erp_amount,
      approved_amount, approval_snapshot_amount, payment_schedule_total,
      payment_intent_expected_amount, erp_sent_amount,
      reconstructed_ledger_amount,
      canonical_amount, canonical_source, max_delta, divergence_types,
      recommended_action, audit_status, raw_values,
      is_winning_proposal, is_operational_clone,
      proposal_rank_for_opportunity, proposal_selection_reason,
      audit_scope_status,
      source_proposal_id
    ) VALUES (
      v_run_id, v_org, v_proposal.id, v_proposal.proposal_number, v_proposal.opportunity_id,
      COALESCE(v_proposal.nome_fantasia, v_proposal.razao_social, v_proposal.opp_title),
      v_proposal.status, v_proposal.opp_status, v_approved_at,
      v_slack_amount, v_deal_amount, v_proposal.total_amount,
      v_ledger_effective, v_ledger_erp,
      v_proposal.approved_amount, v_snap_amount, v_payment_schedule_total,
      v_intent_expected, v_erp_sent_amount,
      v_reconstructed,
      v_canonical, v_canonical_source, v_max_delta, v_div,
      v_action, v_audit_status,
      jsonb_build_object(
        'gross_items_amount', v_gross,
        'manual_discount_percent', v_disc_percent,
        'manual_discount_amount', v_disc_amount,
        'net_after_discount_amount', v_expected_net,
        'expected_net_amount_from_discount', v_expected_net,
        'has_manual_discount', v_has_manual_discount,
        'snapshot_ignores_manual_discount', v_snap_ignores_discount,
        'opp_title', v_proposal.opp_title,
        'opp_max_score', v_proposal.opp_max_score,
        'opp_proposal_count', v_proposal.opp_proposal_count,
        'has_accept', v_proposal.has_accept,
        'has_snapshot', v_proposal.has_snapshot,
        'has_approved_amount', v_proposal.has_approved_amount,
        'has_payment_intent', v_proposal.has_payment_intent,
        'has_erp_sync', v_proposal.has_erp_sync,
        'opp_is_won', v_proposal.opp_is_won,
        'opp_source_opp_id', v_proposal.opp_source_opp_id,
        'pipeline_type', v_proposal.pipeline_type,
        'is_operational_clone_strong', v_proposal.is_operational_clone_strong,
        'source_approved_proposal_id', v_proposal.source_approved_proposal_id,
        'erp_payload', v_erp_payload,
        'slack_payload', v_slack_payload,
        'approval_snapshot', v_approval_snapshot
      ),
      v_winning, v_proposal.is_operational_clone,
      v_proposal.rank_for_opp, v_select_reason,
      v_scope_status,
      v_proposal.source_approved_proposal_id
    );
    END;
  END LOOP;

  UPDATE public.proposal_financial_audit_runs
     SET status='completed', completed_at=now(),
         total_proposals=v_total, ok_count=v_ok,
         divergent_count=v_div_count, needs_review_count=v_review_count,
         total_approved_amount=v_total_approved, total_detected_delta=v_total_delta,
         in_scope_count=v_in_scope_count, out_of_scope_count=v_out_count,
         needs_scope_review_count=v_scope_review_count,
         in_scope_delta=v_in_scope_delta, out_of_scope_delta=v_out_scope_delta
   WHERE id=v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id, 'audit_run_id', v_run_id,
    'total', v_total, 'total_proposals', v_total,
    'ok', v_ok, 'ok_count', v_ok,
    'divergent', v_div_count, 'divergent_count', v_div_count,
    'needs_review', v_review_count, 'needs_review_count', v_review_count,
    'in_scope_count', v_in_scope_count,
    'out_of_scope_count', v_out_count,
    'needs_scope_review_count', v_scope_review_count,
    'in_scope_delta', v_in_scope_delta,
    'out_of_scope_delta', v_out_scope_delta,
    'total_approved', v_total_approved,
    'total_detected_delta', v_total_delta,
    'dry_run', p_dry_run
  );
END;
$function$;

-- 6) Dry-run dedicado: detecta clones operacionais (não escreve em proposals)
CREATE OR REPLACE FUNCTION public.dry_run_detect_operational_proposal_clones(
  p_period_start date,
  p_period_end date
) RETURNS TABLE(
  clone_proposal_id uuid,
  clone_proposal_number text,
  original_approved_proposal_id uuid,
  original_proposal_number text,
  source_opportunity_id uuid,
  operational_opportunity_id uuid,
  client text,
  value_clone numeric,
  value_original numeric,
  created_at timestamptz,
  reason_detected text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN RAISE EXCEPTION 'no_organization'; END IF;
  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'owner')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.system_events(organization_id, event_type, payload, created_by)
  VALUES (
    v_org, 'operational_clone_dry_run',
    jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end),
    v_user
  );

  RETURN QUERY
  WITH clones AS (
    SELECT
      p_clone.id        AS clone_proposal_id,
      p_clone.proposal_number AS clone_proposal_number,
      p_clone.created_at,
      p_clone.total_amount AS value_clone,
      o_op.id AS operational_opportunity_id,
      o_op.source_opportunity_id AS source_opportunity_id,
      COALESCE(a.nome_fantasia, a.razao_social, o_op.title) AS client,
      pl.pipeline_type
    FROM public.proposals p_clone
    JOIN public.opportunities o_op ON o_op.id = p_clone.opportunity_id
    LEFT JOIN public.pipelines pl ON pl.id = o_op.pipeline_id
    LEFT JOIN public.accounts a ON a.id = o_op.account_id
    WHERE p_clone.organization_id = v_org
      AND p_clone.deleted_at IS NULL
      AND o_op.source_opportunity_id IS NOT NULL
      AND pl.pipeline_type IN ('onboarding','renewal')
      AND p_clone.created_at::date BETWEEN p_period_start AND p_period_end
  ),
  with_original AS (
    SELECT c.*,
      (SELECT pr_src.id FROM public.proposals pr_src
        WHERE pr_src.opportunity_id = c.source_opportunity_id
          AND pr_src.deleted_at IS NULL
          AND (pr_src.accepted_at IS NOT NULL OR pr_src.status IN ('accepted','approved','won'))
        ORDER BY pr_src.accepted_at DESC NULLS LAST, pr_src.updated_at DESC
        LIMIT 1) AS original_id
    FROM clones c
  )
  SELECT
    w.clone_proposal_id,
    w.clone_proposal_number,
    w.original_id AS original_approved_proposal_id,
    (SELECT proposal_number FROM public.proposals WHERE id = w.original_id) AS original_proposal_number,
    w.source_opportunity_id,
    w.operational_opportunity_id,
    w.client,
    w.value_clone,
    (SELECT total_amount FROM public.proposals WHERE id = w.original_id) AS value_original,
    w.created_at,
    'operational_clone_with_approved_origin'::text AS reason_detected
  FROM with_original w
  WHERE w.original_id IS NOT NULL;
END;
$$;

-- 7) Ação manual segura (marca clone, vincula original, não deleta)
CREATE OR REPLACE FUNCTION public.mark_operational_proposal_clone(
  p_clone_proposal_id uuid,
  p_original_proposal_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_clone record;
  v_original record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN RAISE EXCEPTION 'no_organization'; END IF;
  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'owner')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id, opportunity_id, organization_id, clone_status, superseded_by_proposal_id, proposal_number
    INTO v_clone
    FROM public.proposals WHERE id = p_clone_proposal_id;
  IF v_clone.id IS NULL OR v_clone.organization_id <> v_org THEN
    RAISE EXCEPTION 'clone_not_found_or_other_org'; END IF;

  SELECT id, opportunity_id, organization_id, proposal_number
    INTO v_original
    FROM public.proposals WHERE id = p_original_proposal_id;
  IF v_original.id IS NULL OR v_original.organization_id <> v_org THEN
    RAISE EXCEPTION 'original_not_found_or_other_org'; END IF;

  UPDATE public.proposals
     SET clone_status = 'clone_error',
         superseded_by_proposal_id = p_original_proposal_id,
         updated_at = now()
   WHERE id = p_clone_proposal_id;

  UPDATE public.opportunities
     SET accepted_proposal_id = p_original_proposal_id,
         updated_at = now()
   WHERE id = v_clone.opportunity_id;

  INSERT INTO public.system_events(organization_id, event_type, payload, created_by)
  VALUES (
    v_org, 'operational_proposal_clone_marked',
    jsonb_build_object(
      'clone_proposal_id', p_clone_proposal_id,
      'clone_proposal_number', v_clone.proposal_number,
      'original_proposal_id', p_original_proposal_id,
      'original_proposal_number', v_original.proposal_number,
      'operational_opportunity_id', v_clone.opportunity_id,
      'before', jsonb_build_object(
        'clone_status', v_clone.clone_status,
        'superseded_by_proposal_id', v_clone.superseded_by_proposal_id
      ),
      'after', jsonb_build_object(
        'clone_status', 'clone_error',
        'superseded_by_proposal_id', p_original_proposal_id
      )
    ),
    v_user
  );

  RETURN jsonb_build_object(
    'ok', true,
    'clone_proposal_id', p_clone_proposal_id,
    'original_proposal_id', p_original_proposal_id,
    'operational_opportunity_id', v_clone.opportunity_id
  );
END;
$$;