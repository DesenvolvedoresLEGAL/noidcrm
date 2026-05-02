-- Sprint F2.9.1: hotfix Forecast V2
-- Replace inexistent column accounts.legal_name with COALESCE(nome_fantasia, razao_social)
-- in calculate_forecast_audit_v2 (used directly + indirectly by create_forecast_daily_snapshot_v2)
DO $$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'calculate_forecast_audit_v2'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE NOTICE 'calculate_forecast_audit_v2 not found, skipping';
    RETURN;
  END IF;

  v_new := replace(v_def, 'a.legal_name AS company_name',
                          'COALESCE(a.nome_fantasia, a.razao_social) AS company_name');

  IF v_new = v_def THEN
    RAISE NOTICE 'No legal_name reference found in calculate_forecast_audit_v2 (already patched)';
  ELSE
    EXECUTE v_new;
    RAISE NOTICE 'calculate_forecast_audit_v2 patched successfully';
  END IF;
END
$$;