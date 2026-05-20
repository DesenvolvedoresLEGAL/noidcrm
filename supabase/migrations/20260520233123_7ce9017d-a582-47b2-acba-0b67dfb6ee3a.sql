
-- =====================================================================
-- PRICE AUDIT MAY 2026 — Auditoria Financeira Retroativa de Propostas
-- =====================================================================

-- 1) Flags em proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS financial_audit_status text,
  ADD COLUMN IF NOT EXISTS financial_audit_last_run_id uuid,
  ADD COLUMN IF NOT EXISTS financial_audit_delta numeric,
  ADD COLUMN IF NOT EXISTS erp_sync_needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_notification_needs_correction boolean NOT NULL DEFAULT false;

-- 2) proposal_financial_audit_runs
CREATE TABLE IF NOT EXISTS public.proposal_financial_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed')),
  dry_run boolean NOT NULL DEFAULT true,
  total_proposals integer NOT NULL DEFAULT 0,
  ok_count integer NOT NULL DEFAULT 0,
  divergent_count integer NOT NULL DEFAULT 0,
  needs_review_count integer NOT NULL DEFAULT 0,
  total_approved_amount numeric NOT NULL DEFAULT 0,
  total_detected_delta numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pfaudit_runs_org_created
  ON public.proposal_financial_audit_runs(organization_id, created_at DESC);

ALTER TABLE public.proposal_financial_audit_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pfaudit_runs_select_admin" ON public.proposal_financial_audit_runs;
CREATE POLICY "pfaudit_runs_select_admin"
  ON public.proposal_financial_audit_runs FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  );

-- 3) proposal_financial_audit_items
CREATE TABLE IF NOT EXISTS public.proposal_financial_audit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  audit_run_id uuid NOT NULL REFERENCES public.proposal_financial_audit_runs(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  proposal_number text,
  opportunity_id uuid,
  account_name text,
  seller_name text,
  proposal_status text,
  opportunity_status text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Valores
  slack_amount numeric,
  deal_amount numeric,
  proposal_total_amount numeric,
  ledger_effective_amount numeric,
  ledger_erp_amount numeric,
  approved_amount numeric,
  approval_snapshot_amount numeric,
  payment_schedule_total numeric,
  payment_intent_expected_amount numeric,
  erp_sent_amount numeric,
  reconstructed_ledger_amount numeric,

  -- Decisão
  canonical_amount numeric,
  canonical_source text
    CHECK (canonical_source IS NULL OR canonical_source IN (
      'approval_snapshot','approved_amount','approved_payment_schedule',
      'pricing_breakdown_snapshot','payment_intent','erp_payload','manual_review'
    )),
  max_delta numeric NOT NULL DEFAULT 0,
  divergence_types text[] NOT NULL DEFAULT '{}',
  recommended_action text,
  audit_status text NOT NULL DEFAULT 'ok'
    CHECK (audit_status IN ('ok','divergent','needs_review','fixed','ignored')),
  notes text,
  raw_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz,
  applied_by uuid,
  applied_mode text
);

CREATE INDEX IF NOT EXISTS idx_pfaudit_items_run ON public.proposal_financial_audit_items(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_pfaudit_items_proposal ON public.proposal_financial_audit_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_pfaudit_items_org_status ON public.proposal_financial_audit_items(organization_id, audit_status);

ALTER TABLE public.proposal_financial_audit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pfaudit_items_select_admin" ON public.proposal_financial_audit_items;
CREATE POLICY "pfaudit_items_select_admin"
  ON public.proposal_financial_audit_items FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  );

-- 4) RPC: run_proposal_financial_audit
CREATE OR REPLACE FUNCTION public.run_proposal_financial_audit(
  p_period_start date,
  p_period_end date,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
  v_run_id uuid;
  v_proposal record;
  v_intent record;
  v_erp record;
  v_slack_amount numeric;
  v_slack_payload jsonb;
  v_deal_amount numeric;
  v_ledger_effective numeric;
  v_ledger_erp numeric;
  v_payment_schedule_total numeric;
  v_approval_snapshot jsonb;
  v_snap_amount numeric;
  v_reconstructed numeric;
  v_max_delta numeric;
  v_canonical numeric;
  v_canonical_source text;
  v_div text[];
  v_audit_status text;
  v_action text;
  v_total integer := 0;
  v_ok integer := 0;
  v_div_count integer := 0;
  v_review_count integer := 0;
  v_total_approved numeric := 0;
  v_total_delta numeric := 0;
  v_amounts numeric[];
  v_a numeric;
  v_b numeric;
  v_i integer;
  v_j integer;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no_organization';
  END IF;
  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'owner')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'invalid_period';
  END IF;

  INSERT INTO public.proposal_financial_audit_runs(
    organization_id, period_start, period_end, status, dry_run, created_by
  ) VALUES (
    v_org, p_period_start, p_period_end, 'running', p_dry_run, v_user
  ) RETURNING id INTO v_run_id;

  FOR v_proposal IN
    SELECT p.*, o.valor_previsto AS opp_value, o.status AS opp_status,
           o.id AS opp_id,
           COALESCE(a.nome_fantasia, a.razao_social, p.client_name) AS account_name,
           pr.full_name AS seller_name
      FROM public.proposals p
      LEFT JOIN public.opportunities o ON o.id = p.opportunity_id
      LEFT JOIN public.accounts a ON a.id = o.account_id
      LEFT JOIN public.profiles pr ON pr.id = o.owner_user_id
     WHERE p.organization_id = v_org
       AND p.deleted_at IS NULL
       AND (
         (p.accepted_at IS NOT NULL AND p.accepted_at::date BETWEEN p_period_start AND p_period_end)
         OR (p.status IN ('accepted','approved','sent_to_erp','won')
             AND COALESCE(p.accepted_at, p.updated_at)::date BETWEEN p_period_start AND p_period_end)
         OR (o.status = 'won' AND o.closed_at::date BETWEEN p_period_start AND p_period_end)
         OR EXISTS (
           SELECT 1 FROM public.proposal_erp_sync_logs l
            WHERE l.proposal_id = p.id
              AND l.created_at::date BETWEEN p_period_start AND p_period_end
         )
       )
  LOOP
    v_total := v_total + 1;

    -- Slack: somente valor estruturado (sem regex em texto livre).
    v_slack_amount := NULL;
    v_slack_payload := NULL;
    SELECT (ndl.provider_response->>'amount')::numeric, ndl.provider_response
      INTO v_slack_amount, v_slack_payload
      FROM public.notification_delivery_logs ndl
      JOIN public.notifications_v2 n ON n.id = ndl.notification_id
     WHERE ndl.channel = 'slack'
       AND (n.payload->>'proposal_id')::uuid = v_proposal.id
       AND (ndl.provider_response ? 'amount')
     ORDER BY ndl.attempted_at DESC
     LIMIT 1;

    -- Deal value
    v_deal_amount := v_proposal.opp_value;

    -- Ledger
    v_ledger_effective := NULLIF(v_proposal.pricing_effective_amount, 0);
    v_ledger_erp := NULLIF(v_proposal.pricing_erp_amount, 0);

    -- Payment schedule total
    SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
      INTO v_payment_schedule_total
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_proposal.approved_payment_schedule) = 'array'
          THEN v_proposal.approved_payment_schedule ELSE '[]'::jsonb END
      ) AS s;
    IF v_payment_schedule_total = 0 THEN v_payment_schedule_total := NULL; END IF;

    -- Approval snapshot
    v_approval_snapshot := v_proposal.approval_snapshot;
    v_snap_amount := COALESCE(
      (v_approval_snapshot->>'amount')::numeric,
      (v_approval_snapshot->>'approved_amount')::numeric,
      (v_approval_snapshot->>'effective_amount')::numeric
    );

    -- Payment intent
    SELECT pi.expected_amount INTO v_intent
      FROM public.proposal_payment_intents pi
     WHERE pi.proposal_id = v_proposal.id
     ORDER BY pi.created_at DESC LIMIT 1;

    -- ERP
    SELECT (request_payload->>'amount')::numeric AS erp_amount, request_payload
      INTO v_erp
      FROM public.proposal_erp_sync_logs
     WHERE proposal_id = v_proposal.id
       AND request_payload ? 'amount'
     ORDER BY created_at DESC LIMIT 1;

    -- Reconstructed (diagnóstico) — apenas quando ledger e approval ausentes
    v_reconstructed := NULL;
    IF v_ledger_effective IS NULL AND v_snap_amount IS NULL THEN
      SELECT COALESCE(SUM(pi.quantity * pi.unit_price * (1 - COALESCE(pi.discount_percent,0)/100.0)), 0)
        INTO v_reconstructed
        FROM public.proposal_items pi
       WHERE pi.proposal_id = v_proposal.id;
      IF v_reconstructed = 0 THEN v_reconstructed := NULL; END IF;
    END IF;

    -- Calcula max_delta entre valores contábeis (Slack excluído)
    v_amounts := ARRAY[
      v_deal_amount, v_ledger_effective, v_ledger_erp,
      v_proposal.approved_amount, v_snap_amount,
      v_payment_schedule_total, v_intent.expected_amount,
      (CASE WHEN v_erp IS NULL THEN NULL ELSE v_erp.erp_amount END)
    ];
    v_max_delta := 0;
    FOR v_i IN 1..array_length(v_amounts,1) LOOP
      FOR v_j IN v_i+1..array_length(v_amounts,1) LOOP
        v_a := v_amounts[v_i]; v_b := v_amounts[v_j];
        IF v_a IS NOT NULL AND v_b IS NOT NULL THEN
          IF abs(v_a - v_b) > v_max_delta THEN v_max_delta := abs(v_a - v_b); END IF;
        END IF;
      END LOOP;
    END LOOP;

    -- Divergence types
    v_div := ARRAY[]::text[];
    IF v_ledger_effective IS NOT NULL AND v_proposal.approved_amount IS NOT NULL
       AND abs(v_ledger_effective - v_proposal.approved_amount) > 0.01 THEN
      v_div := array_append(v_div,'DIVERGENCIA_HEADER');
    END IF;
    IF v_deal_amount IS NOT NULL AND v_proposal.approved_amount IS NOT NULL
       AND abs(v_deal_amount - v_proposal.approved_amount) > 0.01 THEN
      v_div := array_append(v_div,'DIVERGENCIA_DEAL');
    END IF;
    IF v_payment_schedule_total IS NOT NULL AND v_proposal.approved_amount IS NOT NULL
       AND abs(v_payment_schedule_total - v_proposal.approved_amount) > 0.01 THEN
      v_div := array_append(v_div,'DIVERGENCIA_PAYMENT_SCHEDULE');
    END IF;
    IF v_slack_amount IS NOT NULL AND v_proposal.approved_amount IS NOT NULL
       AND abs(v_slack_amount - v_proposal.approved_amount) > 0.01 THEN
      v_div := array_append(v_div,'DIVERGENCIA_SLACK');
    END IF;
    IF v_erp IS NOT NULL AND v_erp.erp_amount IS NOT NULL AND v_proposal.approved_amount IS NOT NULL
       AND abs(v_erp.erp_amount - v_proposal.approved_amount) > 0.01 THEN
      v_div := array_append(v_div,'DIVERGENCIA_ERP');
    END IF;
    IF v_snap_amount IS NOT NULL AND v_proposal.approved_amount IS NOT NULL
       AND abs(v_snap_amount - v_proposal.approved_amount) > 0.01 THEN
      v_div := array_append(v_div,'DIVERGENCIA_APPROVAL_SNAPSHOT');
    END IF;
    IF v_ledger_effective IS NULL THEN
      v_div := array_append(v_div,'SEM_LEDGER');
    END IF;
    IF v_snap_amount IS NULL AND (v_approval_snapshot IS NULL OR v_approval_snapshot = '{}'::jsonb OR NOT (v_approval_snapshot ? 'approved_at')) THEN
      v_div := array_append(v_div,'SEM_APPROVAL_SNAPSHOT');
    END IF;
    IF v_proposal.approved_amount IS NULL AND v_snap_amount IS NULL AND v_ledger_effective IS NULL THEN
      v_div := array_append(v_div,'VALOR_APROVADO_INDETERMINADO');
    END IF;

    -- Canonical: ordem de confiança
    v_canonical := NULL; v_canonical_source := NULL;
    IF v_snap_amount IS NOT NULL THEN
      v_canonical := v_snap_amount; v_canonical_source := 'approval_snapshot';
    ELSIF v_proposal.approved_amount IS NOT NULL THEN
      v_canonical := v_proposal.approved_amount; v_canonical_source := 'approved_amount';
    ELSIF v_payment_schedule_total IS NOT NULL THEN
      v_canonical := v_payment_schedule_total; v_canonical_source := 'approved_payment_schedule';
    ELSIF v_ledger_effective IS NOT NULL THEN
      v_canonical := v_ledger_effective; v_canonical_source := 'pricing_breakdown_snapshot';
    ELSIF v_intent.expected_amount IS NOT NULL THEN
      v_canonical := v_intent.expected_amount; v_canonical_source := 'payment_intent';
    ELSIF v_erp IS NOT NULL AND v_erp.erp_amount IS NOT NULL THEN
      v_canonical := v_erp.erp_amount; v_canonical_source := 'erp_payload';
    ELSE
      v_canonical_source := 'manual_review';
    END IF;

    -- Audit status
    IF v_max_delta <= 0.01
       AND NOT ('SEM_LEDGER' = ANY(v_div))
       AND NOT ('SEM_APPROVAL_SNAPSHOT' = ANY(v_div))
       AND NOT ('VALOR_APROVADO_INDETERMINADO' = ANY(v_div)) THEN
      v_audit_status := 'ok';
      v_ok := v_ok + 1;
    ELSIF v_canonical_source IN ('payment_intent','erp_payload','manual_review') THEN
      v_audit_status := 'needs_review';
      v_review_count := v_review_count + 1;
    ELSE
      v_audit_status := 'divergent';
      v_div_count := v_div_count + 1;
    END IF;

    -- Recommended action
    IF v_audit_status = 'ok' THEN
      v_action := 'none';
    ELSIF v_canonical_source IN ('approval_snapshot','approved_amount','approved_payment_schedule','pricing_breakdown_snapshot') THEN
      v_action := 'apply_safe';
    ELSE
      v_action := 'manual_review';
    END IF;

    IF v_canonical IS NOT NULL THEN
      v_total_approved := v_total_approved + v_canonical;
    END IF;
    v_total_delta := v_total_delta + v_max_delta;

    INSERT INTO public.proposal_financial_audit_items(
      organization_id, audit_run_id, proposal_id, proposal_number, opportunity_id,
      account_name, seller_name, proposal_status, opportunity_status, approved_at,
      slack_amount, deal_amount, proposal_total_amount,
      ledger_effective_amount, ledger_erp_amount, approved_amount,
      approval_snapshot_amount, payment_schedule_total, payment_intent_expected_amount,
      erp_sent_amount, reconstructed_ledger_amount,
      canonical_amount, canonical_source, max_delta, divergence_types,
      recommended_action, audit_status, raw_values
    ) VALUES (
      v_org, v_run_id, v_proposal.id, v_proposal.proposal_number, v_proposal.opportunity_id,
      v_proposal.account_name, v_proposal.seller_name, v_proposal.status, v_proposal.opp_status, v_proposal.accepted_at,
      v_slack_amount, v_deal_amount, v_proposal.total_amount,
      v_ledger_effective, v_ledger_erp, v_proposal.approved_amount,
      v_snap_amount, v_payment_schedule_total,
      (CASE WHEN v_intent IS NULL THEN NULL ELSE v_intent.expected_amount END),
      (CASE WHEN v_erp IS NULL THEN NULL ELSE v_erp.erp_amount END),
      v_reconstructed,
      v_canonical, v_canonical_source, v_max_delta, v_div,
      v_action, v_audit_status,
      jsonb_build_object(
        'raw_slack_payload', v_slack_payload,
        'raw_approval_snapshot', v_approval_snapshot,
        'raw_erp_payload', (CASE WHEN v_erp IS NULL THEN NULL ELSE v_erp.request_payload END),
        'pricing_breakdown_snapshot', v_proposal.pricing_breakdown_snapshot
      )
    );

    IF NOT p_dry_run THEN
      UPDATE public.proposals
         SET financial_audit_status = v_audit_status,
             financial_audit_last_run_id = v_run_id,
             financial_audit_delta = v_max_delta
       WHERE id = v_proposal.id;
    END IF;
  END LOOP;

  UPDATE public.proposal_financial_audit_runs
     SET status = 'completed',
         total_proposals = v_total,
         ok_count = v_ok,
         divergent_count = v_div_count,
         needs_review_count = v_review_count,
         total_approved_amount = v_total_approved,
         total_detected_delta = v_total_delta,
         completed_at = now()
   WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'audit_run_id', v_run_id,
    'total_proposals', v_total,
    'ok_count', v_ok,
    'divergent_count', v_div_count,
    'needs_review_count', v_review_count,
    'total_detected_delta', v_total_delta,
    'dry_run', p_dry_run
  );
END;
$$;

-- 5) RPC: apply_proposal_financial_audit_item
CREATE OR REPLACE FUNCTION public.apply_proposal_financial_audit_item(
  p_audit_item_id uuid,
  p_apply_mode text DEFAULT 'safe'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_org uuid;
  v_item public.proposal_financial_audit_items;
  v_proposal public.proposals;
  v_before jsonb;
  v_after jsonb;
  v_applied text[] := ARRAY[]::text[];
BEGIN
  v_user := auth.uid();
  v_org := public.get_user_organization_id();
  IF v_user IS NULL OR v_org IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'owner')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_item FROM public.proposal_financial_audit_items
   WHERE id = p_audit_item_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;

  -- Modo safe rejeita fontes não confiáveis
  IF p_apply_mode = 'safe'
     AND v_item.canonical_source IN ('erp_payload','payment_intent','manual_review') THEN
    UPDATE public.proposal_financial_audit_items
       SET audit_status = 'needs_review',
           notes = COALESCE(notes,'') || E'\n[auto] safe rejeitado: fonte canônica é evidência (' || v_item.canonical_source || ').',
           updated_at = now()
     WHERE id = p_audit_item_id;
    RETURN jsonb_build_object('status','needs_review','reason','canonical_source_not_trusted','canonical_source', v_item.canonical_source);
  END IF;

  SELECT * INTO v_proposal FROM public.proposals WHERE id = v_item.proposal_id;
  v_before := jsonb_build_object(
    'proposal', jsonb_build_object(
      'approved_amount', v_proposal.approved_amount,
      'total_amount', v_proposal.total_amount,
      'erp_sync_needs_review', v_proposal.erp_sync_needs_review,
      'slack_notification_needs_correction', v_proposal.slack_notification_needs_correction
    ),
    'opportunity_value', v_item.deal_amount
  );

  -- 1) Atualiza valor_previsto da oportunidade se DIVERGENCIA_DEAL
  IF 'DIVERGENCIA_DEAL' = ANY(v_item.divergence_types) AND v_item.canonical_amount IS NOT NULL AND v_item.opportunity_id IS NOT NULL THEN
    UPDATE public.opportunities SET valor_previsto = v_item.canonical_amount, updated_at = now()
     WHERE id = v_item.opportunity_id;
    v_applied := array_append(v_applied,'opportunities.valor_previsto');
  END IF;

  -- 2) Flags de revisão
  IF 'DIVERGENCIA_ERP' = ANY(v_item.divergence_types) THEN
    UPDATE public.proposals SET erp_sync_needs_review = true, updated_at = now() WHERE id = v_proposal.id;
    v_applied := array_append(v_applied,'proposals.erp_sync_needs_review');
  END IF;
  IF 'DIVERGENCIA_SLACK' = ANY(v_item.divergence_types) THEN
    UPDATE public.proposals SET slack_notification_needs_correction = true, updated_at = now() WHERE id = v_proposal.id;
    v_applied := array_append(v_applied,'proposals.slack_notification_needs_correction');
  END IF;

  -- 3) Modo opcional: espelhar total_amount legado (nunca em safe puro)
  IF p_apply_mode = 'mirror_legacy_total' AND v_item.canonical_amount IS NOT NULL THEN
    UPDATE public.proposals SET total_amount = v_item.canonical_amount, updated_at = now() WHERE id = v_proposal.id;
    v_applied := array_append(v_applied,'proposals.total_amount (legacy mirror)');
  END IF;

  -- 4) Flags de auditoria sempre
  UPDATE public.proposals
     SET financial_audit_status = 'fixed',
         financial_audit_last_run_id = v_item.audit_run_id,
         financial_audit_delta = v_item.max_delta,
         updated_at = now()
   WHERE id = v_proposal.id;
  v_applied := array_append(v_applied,'proposals.financial_audit_*');

  SELECT jsonb_build_object(
    'proposal', jsonb_build_object(
      'approved_amount', p.approved_amount,
      'total_amount', p.total_amount,
      'erp_sync_needs_review', p.erp_sync_needs_review,
      'slack_notification_needs_correction', p.slack_notification_needs_correction,
      'financial_audit_status', p.financial_audit_status
    ),
    'opportunity_value', (SELECT valor_previsto FROM public.opportunities WHERE id = v_item.opportunity_id)
  ) INTO v_after FROM public.proposals p WHERE p.id = v_proposal.id;

  UPDATE public.proposal_financial_audit_items
     SET audit_status = 'fixed',
         applied_at = now(),
         applied_by = v_user,
         applied_mode = p_apply_mode,
         raw_values = raw_values || jsonb_build_object('before', v_before, 'after', v_after, 'applied_fields', to_jsonb(v_applied)),
         updated_at = now()
   WHERE id = p_audit_item_id;

  INSERT INTO public.system_events(
    organization_id, actor_type, actor_id, event_type, event_category, action,
    entity_type, entity_id, payload
  ) VALUES (
    v_org, 'user', v_user, 'price_audit.applied', 'audit', 'apply',
    'proposal', v_proposal.id,
    jsonb_build_object(
      'audit_item_id', p_audit_item_id, 'mode', p_apply_mode,
      'before', v_before, 'after', v_after, 'applied_fields', to_jsonb(v_applied)
    )
  );

  RETURN jsonb_build_object('status','fixed','mode',p_apply_mode,'applied_fields',to_jsonb(v_applied),'before',v_before,'after',v_after);
END;
$$;

-- 6) RPCs auxiliares
CREATE OR REPLACE FUNCTION public.ignore_proposal_financial_audit_item(
  p_audit_item_id uuid, p_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_org uuid := public.get_user_organization_id();
BEGIN
  IF v_user IS NULL OR v_org IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'owner')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.proposal_financial_audit_items
     SET audit_status = 'ignored', notes = COALESCE(p_note, notes), updated_at = now()
   WHERE id = p_audit_item_id AND organization_id = v_org;
END;$$;

CREATE OR REPLACE FUNCTION public.mark_proposal_financial_audit_item_review(
  p_audit_item_id uuid, p_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_org uuid := public.get_user_organization_id();
BEGIN
  IF v_user IS NULL OR v_org IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'owner')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.proposal_financial_audit_items
     SET audit_status = 'needs_review', notes = COALESCE(p_note, notes), updated_at = now()
   WHERE id = p_audit_item_id AND organization_id = v_org;
END;$$;

GRANT EXECUTE ON FUNCTION public.run_proposal_financial_audit(date,date,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_proposal_financial_audit_item(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ignore_proposal_financial_audit_item(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_proposal_financial_audit_item_review(uuid,text) TO authenticated;
