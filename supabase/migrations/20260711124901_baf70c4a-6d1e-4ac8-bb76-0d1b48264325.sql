
ALTER VIEW public.commercial_won_revenue_view SET (security_invoker = on);
ALTER VIEW public.commercial_won_revenue_historical_view SET (security_invoker = on);
ALTER VIEW public.commission_eligibility_view SET (security_invoker = on);
ALTER VIEW public.unified_timeline SET (security_invoker = on);
ALTER VIEW public.v_opportunity_accepted_proposal_v2 SET (security_invoker = on);
ALTER VIEW public.v_proposals_normalized_v2 SET (security_invoker = on);
ALTER VIEW public.v_unified_won_revenue_v2 SET (security_invoker = on);
ALTER VIEW public.kairos_apollo_performance_summary SET (security_invoker = on);
ALTER VIEW public.kairos_gtm_performance_summary SET (security_invoker = on);
ALTER VIEW public.kairos_revenue_attribution_summary SET (security_invoker = on);
