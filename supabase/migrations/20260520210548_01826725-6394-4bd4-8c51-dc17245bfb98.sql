
REVOKE EXECUTE ON FUNCTION public.recalculate_proposal_pricing_ledger(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_proposal_pricing_ledger(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_manual_discount(uuid, numeric) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_manual_discount(uuid, numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.mark_proposal_pricing_dirty(uuid) FROM anon, PUBLIC;
