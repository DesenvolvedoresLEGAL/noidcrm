CREATE UNIQUE INDEX IF NOT EXISTS uq_proposal_payment_terms_one_per_type
  ON public.proposal_payment_terms(proposal_id, payment_type);