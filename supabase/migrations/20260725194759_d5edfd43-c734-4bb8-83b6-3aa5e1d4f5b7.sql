-- VERT-01.4B1: Migrate public.client_archetypes.type from enum client_type to text.
-- Runtime remains Events-constrained. Enum public.client_type is intentionally retained
-- for rollback safety. No CASCADE, no DROP, no policy/RLS changes.

DO $$
DECLARE
  v_udt text;
  v_rogue integer;
BEGIN
  SELECT udt_name INTO v_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'client_archetypes'
    AND column_name = 'type';
  IF v_udt IS DISTINCT FROM 'client_type' THEN
    RAISE EXCEPTION
      'VERT-01.4B1 aborted: client_archetypes.type is not client_type (got %)',
      v_udt;
  END IF;

  SELECT count(*) INTO v_rogue
  FROM public.client_archetypes
  WHERE type IS NOT NULL
    AND type::text NOT IN (
      'Organizador',
      'Expositor',
      'Agência',
      'Empresa Contratante'
    );
  IF v_rogue > 0 THEN
    RAISE EXCEPTION
      'VERT-01.4B1 aborted: % rows with unexpected type values',
      v_rogue;
  END IF;
END $$;

ALTER TABLE public.client_archetypes
  ALTER COLUMN type TYPE text
  USING type::text;

DO $$
DECLARE
  v_udt text;
BEGIN
  SELECT udt_name INTO v_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'client_archetypes'
    AND column_name = 'type';
  IF v_udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION
      'VERT-01.4B1 aborted: post-condition failed (udt=%)',
      v_udt;
  END IF;
END $$;