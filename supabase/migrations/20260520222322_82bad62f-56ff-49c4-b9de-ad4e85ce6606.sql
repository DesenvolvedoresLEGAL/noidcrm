-- Permitir status 'pending_provider' em payment_intents
ALTER TABLE public.proposal_payment_intents
  DROP CONSTRAINT IF EXISTS proposal_payment_intents_status_check;

ALTER TABLE public.proposal_payment_intents
  ADD CONSTRAINT proposal_payment_intents_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'pending_provider'::text,
    'paid_exact'::text,
    'paid_partial'::text,
    'paid_over'::text,
    'expired'::text,
    'cancelled'::text,
    'complementary_pending'::text,
    'complementary_paid'::text,
    'manual_review'::text
  ]));

-- Permitir status 'pending_provider' nos logs de sync
ALTER TABLE public.proposal_erp_sync_logs
  DROP CONSTRAINT IF EXISTS proposal_erp_sync_logs_status_check;

ALTER TABLE public.proposal_erp_sync_logs
  ADD CONSTRAINT proposal_erp_sync_logs_status_check
  CHECK (status = ANY (ARRAY[
    'success'::text,
    'error'::text,
    'blocked'::text,
    'mock'::text,
    'pending_provider'::text
  ]));