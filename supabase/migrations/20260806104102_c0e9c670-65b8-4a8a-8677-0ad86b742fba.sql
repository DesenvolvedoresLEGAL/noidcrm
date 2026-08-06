DO $mig$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_finalize_apollo_reveal'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'fn_finalize_apollo_reveal not found';
  END IF;

  IF position('''phone_only_web''' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      '''failed'', ''pending_provider'')',
      '''failed'', ''pending_provider'', ''phone_only_web'')'
    );
    EXECUTE v_def;
  END IF;
END
$mig$;