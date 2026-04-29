REVOKE EXECUTE ON FUNCTION public.enqueue_opportunity_indicators_recalc(uuid, uuid, uuid, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_enqueue_indicators_from_opportunity() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_enqueue_indicators_from_activity() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_enqueue_indicators_from_proposal() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_enqueue_indicators_from_opp_email() FROM anon, authenticated, public;