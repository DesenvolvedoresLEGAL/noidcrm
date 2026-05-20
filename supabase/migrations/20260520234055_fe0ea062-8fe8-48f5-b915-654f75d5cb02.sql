ALTER TABLE public.proposal_financial_audit_items
  DROP CONSTRAINT IF EXISTS proposal_financial_audit_items_canonical_source_check;
ALTER TABLE public.proposal_financial_audit_items
  ADD CONSTRAINT proposal_financial_audit_items_canonical_source_check
  CHECK (canonical_source IS NULL OR canonical_source = ANY (ARRAY[
    'approval_snapshot','approved_amount','approved_payment_schedule','payment_schedule',
    'pricing_breakdown_snapshot','payment_intent','erp_payload','manual_review',
    'ledger','indeterminate'
  ]));