-- =============================================================================
-- FIX SECURITY LINTER WARNINGS
-- =============================================================================

-- Fix SECURITY DEFINER views - recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.proposal_items_public;
CREATE VIEW public.proposal_items_public 
WITH (security_invoker = true)
AS
SELECT 
  pi.id,
  pi.proposal_id,
  pi.product_id,
  pi.name,
  pi.description,
  pi.quantity,
  pi.unit_price,
  pi.discount_percent,
  pi.total,
  pi.order_index,
  pi.created_at
FROM public.proposal_items pi
INNER JOIN public.proposals p ON pi.proposal_id = p.id
WHERE 
  p.public_token IS NOT NULL
  AND (
    (p.status NOT IN ('accepted', 'rejected') AND p.created_at > NOW() - INTERVAL '30 days')
    OR
    (p.status IN ('accepted', 'rejected') AND p.updated_at > NOW() - INTERVAL '90 days')
  );

GRANT SELECT ON public.proposal_items_public TO anon;
GRANT SELECT ON public.proposal_items_public TO authenticated;

DROP VIEW IF EXISTS public.proposal_payment_terms_public;
CREATE VIEW public.proposal_payment_terms_public
WITH (security_invoker = true)
AS
SELECT 
  ppt.id,
  ppt.proposal_id,
  ppt.payment_type,
  ppt.payment_method,
  ppt.installments,
  ppt.first_installment_date,
  ppt.installment_interval_days,
  ppt.due_day,
  ppt.first_payment_date,
  ppt.contract_start_date,
  ppt.contract_duration_months,
  ppt.billing_day,
  ppt.auto_renewal,
  ppt.created_at
FROM public.proposal_payment_terms ppt
INNER JOIN public.proposals p ON ppt.proposal_id = p.id
WHERE 
  p.public_token IS NOT NULL
  AND (
    (p.status NOT IN ('accepted', 'rejected') AND p.created_at > NOW() - INTERVAL '30 days')
    OR
    (p.status IN ('accepted', 'rejected') AND p.updated_at > NOW() - INTERVAL '90 days')
  );

GRANT SELECT ON public.proposal_payment_terms_public TO anon;
GRANT SELECT ON public.proposal_payment_terms_public TO authenticated;

-- Fix overly permissive INSERT policy - require valid proposal_id
DROP POLICY IF EXISTS "Anyone can insert view logs" ON public.proposal_view_logs;
CREATE POLICY "Anyone can insert view logs for valid proposals"
ON public.proposal_view_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_id
    AND p.public_token IS NOT NULL
    AND (
      (p.status NOT IN ('accepted', 'rejected') AND p.created_at > NOW() - INTERVAL '30 days')
      OR
      (p.status IN ('accepted', 'rejected') AND p.updated_at > NOW() - INTERVAL '90 days')
    )
  )
);