
-- 1. Schema additions
ALTER TABLE public.enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS email_normalized text,
  ADD COLUMN IF NOT EXISTS is_merged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.enriched_contact_profiles(id) ON DELETE SET NULL;

-- 2. Backfill normalized email
UPDATE public.enriched_contact_profiles
SET email_normalized = lower(trim(email))
WHERE email IS NOT NULL AND email_normalized IS NULL;

-- 3. Pre-cleanup duplicates before creating UNIQUE index (keep highest confidence_score)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY workspace_id, email_normalized
           ORDER BY confidence_score DESC NULLS LAST, created_at ASC
         ) AS rn,
         first_value(id) OVER (
           PARTITION BY workspace_id, email_normalized
           ORDER BY confidence_score DESC NULLS LAST, created_at ASC
         ) AS winner_id
  FROM public.enriched_contact_profiles
  WHERE email_normalized IS NOT NULL AND is_merged = false
)
UPDATE public.enriched_contact_profiles ecp
SET is_merged = true, merged_into = r.winner_id
FROM ranked r
WHERE ecp.id = r.id AND r.rn > 1;

-- 4. Drop old per-prospect index, create org-wide dedupe + single-primary
DROP INDEX IF EXISTS public.uniq_ectp_prospect_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_contact_email_org
  ON public.enriched_contact_profiles (workspace_id, email_normalized)
  WHERE email IS NOT NULL AND is_merged = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_contact
  ON public.enriched_contact_profiles (prospect_id)
  WHERE is_primary = true AND is_merged = false;

CREATE INDEX IF NOT EXISTS idx_ectp_prospect_active
  ON public.enriched_contact_profiles (prospect_id)
  WHERE is_merged = false;

-- 5. Trigger to auto-normalize email
CREATE OR REPLACE FUNCTION public.fn_normalize_contact_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email_normalized := lower(trim(NEW.email));
  ELSE
    NEW.email_normalized := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_contact_email ON public.enriched_contact_profiles;
CREATE TRIGGER trg_normalize_contact_email
  BEFORE INSERT OR UPDATE OF email ON public.enriched_contact_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_contact_email();

-- 6. RPC: dedupe contacts for a prospect
CREATE OR REPLACE FUNCTION public.dedupe_prospect_contacts(p_prospect_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_count int := 0;
BEGIN
  SELECT organization_id INTO v_org FROM public.prospects WHERE id = p_prospect_id;
  IF v_org IS NULL THEN RETURN 0; END IF;

  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY email_normalized
             ORDER BY confidence_score DESC NULLS LAST, created_at ASC
           ) AS rn,
           first_value(id) OVER (
             PARTITION BY email_normalized
             ORDER BY confidence_score DESC NULLS LAST, created_at ASC
           ) AS winner_id
    FROM public.enriched_contact_profiles
    WHERE prospect_id = p_prospect_id
      AND email_normalized IS NOT NULL
      AND is_merged = false
  ),
  upd AS (
    UPDATE public.enriched_contact_profiles ecp
    SET is_merged = true, merged_into = r.winner_id, is_primary = false
    FROM ranked r
    WHERE ecp.id = r.id AND r.rn > 1
    RETURNING ecp.id
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    INSERT INTO public.system_events (organization_id, event_type, payload, source)
    VALUES (v_org, 'lead.deduped',
            jsonb_build_object('prospect_id', p_prospect_id, 'deduped_count', v_count),
            'apollo_enrichment');
  END IF;

  RETURN v_count;
END;
$$;

-- 7. RPC: resolve primary contact (auto-pick best)
CREATE OR REPLACE FUNCTION public.resolve_primary_contact(p_prospect_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner uuid;
BEGIN
  SELECT id INTO v_winner
  FROM public.enriched_contact_profiles
  WHERE prospect_id = p_prospect_id
    AND is_merged = false
  ORDER BY
    confidence_score DESC NULLS LAST,
    CASE seniority
      WHEN 'c_level' THEN 5
      WHEN 'vp' THEN 4
      WHEN 'director' THEN 3
      WHEN 'manager' THEN 2
      ELSE 1
    END DESC,
    created_at ASC
  LIMIT 1;

  IF v_winner IS NULL THEN RETURN NULL; END IF;

  UPDATE public.enriched_contact_profiles
  SET is_primary = false
  WHERE prospect_id = p_prospect_id AND id <> v_winner AND is_primary = true;

  UPDATE public.enriched_contact_profiles
  SET is_primary = true
  WHERE id = v_winner AND is_primary = false;

  RETURN v_winner;
END;
$$;

-- 8. RPC: manual override of primary
CREATE OR REPLACE FUNCTION public.resolve_primary_contact_manual(p_prospect_id uuid, p_contact_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user_org uuid;
  v_exists boolean;
BEGIN
  SELECT workspace_id INTO v_org
  FROM public.enriched_contact_profiles
  WHERE id = p_contact_id AND prospect_id = p_prospect_id AND is_merged = false;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Contact not found or merged';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = v_org
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Not authorized for this organization';
  END IF;

  UPDATE public.enriched_contact_profiles
  SET is_primary = false
  WHERE prospect_id = p_prospect_id AND id <> p_contact_id;

  UPDATE public.enriched_contact_profiles
  SET is_primary = true
  WHERE id = p_contact_id;

  RETURN p_contact_id;
END;
$$;
