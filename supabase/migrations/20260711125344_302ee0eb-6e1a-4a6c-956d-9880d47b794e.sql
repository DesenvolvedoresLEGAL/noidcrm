
DO $$
DECLARE
  r record;
  fn_sig text;
  n_total int := 0;
  n_rpc int := 0;
  n_trigger int := 0;
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           (t.typname = 'trigger') AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    fn_sig := format('public.%I(%s)', r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn_sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn_sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn_sig);
    IF NOT r.is_trigger THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn_sig);
      n_rpc := n_rpc + 1;
    ELSE
      n_trigger := n_trigger + 1;
    END IF;
    n_total := n_total + 1;
  END LOOP;

  RAISE NOTICE 'Phase 1.5-A hardened % SECURITY DEFINER functions (rpc=% trigger=%)', n_total, n_rpc, n_trigger;
END $$;

-- Whitelist explícito para fluxos anônimos legítimos (revalidados por token)
GRANT EXECUTE ON FUNCTION public.get_proposal_by_public_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;
