CREATE OR REPLACE FUNCTION public.prune_log_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sec integer := 0;
  v_nrhs integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.security_audit_log
    WHERE ctid IN (
      SELECT ctid FROM public.security_audit_log
      WHERE (
        (COALESCE(severity,'info') IN ('low','info','debug','warning') AND created_at < now() - interval '30 days')
        OR created_at < now() - interval '365 days'
      )
      LIMIT 500000
    )
    RETURNING 1
  ) SELECT count(*) INTO v_sec FROM del;

  WITH del2 AS (
    DELETE FROM public.nrhs_learning_signals
    WHERE ctid IN (
      SELECT ctid FROM public.nrhs_learning_signals
      WHERE created_at < now() - interval '180 days'
      LIMIT 200000
    )
    RETURNING 1
  ) SELECT count(*) INTO v_nrhs FROM del2;

  RETURN jsonb_build_object('security_audit_log', v_sec, 'nrhs_learning_signals', v_nrhs);
END;
$$;

REVOKE ALL ON FUNCTION public.prune_log_tables() FROM PUBLIC, anon, authenticated;