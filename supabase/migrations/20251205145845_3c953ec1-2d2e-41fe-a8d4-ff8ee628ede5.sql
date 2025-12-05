-- Sprint 1: Ensure security_invoker on all 7 views
ALTER VIEW public.sdr_performance SET (security_invoker = true);
ALTER VIEW public.closer_performance SET (security_invoker = true);
ALTER VIEW public.handoff_metrics SET (security_invoker = true);
ALTER VIEW public.pipeline_health SET (security_invoker = true);
ALTER VIEW public.pipeline_metrics SET (security_invoker = true);
ALTER VIEW public.stage_conversion_metrics SET (security_invoker = true);
ALTER VIEW public.unified_timeline SET (security_invoker = true);

-- Sprint 2: Create public-safe view for proposal items (without sensitive cost data)
CREATE OR REPLACE VIEW public.proposal_items_public AS
SELECT 
  id,
  proposal_id,
  product_id,
  name,
  description,
  quantity,
  unit_price,
  discount_percent,
  total,
  order_index,
  organization_id,
  created_at,
  updated_at
  -- Intentionally omitting: unit_cost, markup_percent, ipi_percent
FROM public.proposal_items;

-- Add comment explaining the view purpose
COMMENT ON VIEW public.proposal_items_public IS 'Public-safe view of proposal items excluding sensitive cost/markup data for client-facing proposal views';

-- Enable security_invoker on the new view
ALTER VIEW public.proposal_items_public SET (security_invoker = true);