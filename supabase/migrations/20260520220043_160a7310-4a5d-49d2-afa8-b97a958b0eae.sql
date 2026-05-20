-- ============================================================
-- PRICE 1.2 — ERP Real, Banco e Baixa Financeira
-- ============================================================

-- 1) Tabela de logs de sincronização com ERP/banco
CREATE TABLE IF NOT EXISTS public.proposal_erp_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL,
  payment_intent_id uuid REFERENCES public.proposal_payment_intents(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'human_erp',
  operation text NOT NULL CHECK (operation IN ('create_charge','sync_status','webhook','cancel_charge','complementary_charge')),
  status text NOT NULL CHECK (status IN ('success','error','blocked','mock')),
  attempt integer NOT NULL DEFAULT 1,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  http_status integer,
  error_code text,
  error_message text,
  latency_ms integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesl_proposal ON public.proposal_erp_sync_logs(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pesl_intent   ON public.proposal_erp_sync_logs(payment_intent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pesl_org      ON public.proposal_erp_sync_logs(organization_id, created_at DESC);

ALTER TABLE public.proposal_erp_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pesl_select_org" ON public.proposal_erp_sync_logs;
CREATE POLICY "pesl_select_org"
  ON public.proposal_erp_sync_logs FOR SELECT
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "pesl_insert_service" ON public.proposal_erp_sync_logs;
CREATE POLICY "pesl_insert_service"
  ON public.proposal_erp_sync_logs FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

-- 2) Atualizar validate_proposal_payment_amount para usar o Ledger (PRICE CORE 2.0)
CREATE OR REPLACE FUNCTION public.validate_proposal_payment_amount(
  p_payment_intent_id uuid,
  p_paid_amount numeric,
  p_paid_at timestamptz DEFAULT now(),
  p_payment_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent record;
  v_proposal record;
  v_due numeric;
  v_diff numeric;
  v_new_status text;
  v_event text;
  v_complementary jsonb := NULL;
  v_complementary_id uuid := NULL;
  v_user uuid := auth.uid();
BEGIN
  SELECT * INTO v_intent FROM public.proposal_payment_intents WHERE id = p_payment_intent_id FOR UPDATE;
  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'Payment intent not found';
  END IF;

  SELECT id, status, approved_amount, pricing_erp_amount, pricing_breakdown_snapshot, approval_snapshot
    INTO v_proposal
  FROM public.proposals
  WHERE id = v_intent.proposal_id;

  -- Valor esperado vem do Ledger / approval freeze, jamais de cálculo isolado.
  IF v_proposal.status = 'accepted' AND v_proposal.approved_amount IS NOT NULL THEN
    v_due := v_proposal.approved_amount;
  ELSE
    v_due := COALESCE(v_proposal.pricing_erp_amount, v_intent.expected_amount, 0);
  END IF;

  IF round(p_paid_amount, 2) = round(v_due, 2) THEN
    v_new_status := 'paid_exact';
    v_event := 'payment_exact';
    v_diff := 0;
  ELSIF p_paid_amount < v_due THEN
    v_new_status := 'paid_partial';
    v_event := 'payment_partial';
    v_diff := v_due - p_paid_amount;
  ELSE
    v_new_status := 'paid_over';
    v_event := 'payment_overpaid';
    v_diff := p_paid_amount - v_due;
  END IF;

  UPDATE public.proposal_payment_intents
     SET paid_amount = p_paid_amount,
         difference_amount = v_diff,
         status = v_new_status,
         paid_at = CASE WHEN v_new_status IN ('paid_exact','paid_partial','paid_over') THEN p_paid_at ELSE paid_at END,
         payment_reference = COALESCE(p_payment_reference, payment_reference),
         updated_by = v_user,
         updated_at = now()
   WHERE id = p_payment_intent_id;

  INSERT INTO public.proposal_payment_events(
    organization_id, proposal_id, payment_intent_id,
    event_type, expected_amount, paid_amount, difference_amount,
    message, metadata, created_by
  ) VALUES (
    v_intent.organization_id, v_intent.proposal_id, p_payment_intent_id,
    v_event, v_due, p_paid_amount, v_diff,
    CASE v_new_status
      WHEN 'paid_exact'   THEN 'Pagamento exato confirmado'
      WHEN 'paid_partial' THEN 'Pagamento parcial recebido — gerando complementar automático'
      WHEN 'paid_over'    THEN 'Pagamento excedente — revisão manual necessária'
    END,
    jsonb_build_object(
      'expected_amount', v_due,
      'paid_amount', p_paid_amount,
      'difference_amount', v_diff,
      'payment_reference', p_payment_reference,
      'pricing_breakdown_snapshot', v_proposal.pricing_breakdown_snapshot,
      'approval_snapshot', v_proposal.approval_snapshot,
      'source', 'validate_proposal_payment_amount'
    ),
    v_user
  );

  -- Pagamento parcial: gerar complementar automaticamente
  IF v_new_status = 'paid_partial' THEN
    BEGIN
      v_complementary := public.create_complementary_payment_intent(p_payment_intent_id);
      IF v_complementary ? 'payment_intent_id' THEN
        v_complementary_id := (v_complementary->>'payment_intent_id')::uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.proposal_payment_events(
        organization_id, proposal_id, payment_intent_id,
        event_type, message, metadata
      ) VALUES (
        v_intent.organization_id, v_intent.proposal_id, p_payment_intent_id,
        'manual_review_required',
        'Falha ao gerar complementar automático — revisão manual',
        jsonb_build_object('error', SQLERRM)
      );
    END;
  END IF;

  -- Pagamento excedente: marcar revisão manual
  IF v_new_status = 'paid_over' THEN
    INSERT INTO public.proposal_payment_events(
      organization_id, proposal_id, payment_intent_id,
      event_type, message, metadata
    ) VALUES (
      v_intent.organization_id, v_intent.proposal_id, p_payment_intent_id,
      'manual_review_required',
      'Pagamento excedente requer revisão manual',
      jsonb_build_object('expected_amount', v_due, 'paid_amount', p_paid_amount, 'over_by', v_diff)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_new_status,
    'expected_amount', v_due,
    'paid_amount', p_paid_amount,
    'difference_amount', v_diff,
    'complementary_payment_intent_id', v_complementary_id,
    'pricing_breakdown_snapshot', v_proposal.pricing_breakdown_snapshot,
    'approval_snapshot', v_proposal.approval_snapshot
  );
END;
$$;