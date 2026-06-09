
-- 1) Soft-merge enriched_contact_profiles attached to poisoned prospects
UPDATE public.enriched_contact_profiles ecp
SET is_merged = true, updated_at = now()
FROM public.prospects p
WHERE ecp.prospect_id = p.id
  AND ecp.is_merged = false
  AND p.normalized_domain IN (
    'jusbrasil.com.br','linkedin.com','facebook.com','instagram.com',
    'econodata.com.br','cnpj.biz','cnpj.info','cnpjs.rocks','cnpjbiz.com',
    'consultasocio.com','empresaqualifica.com.br','casadosdados.com.br',
    'apontador.com.br','econoinfo.com.br','crunchbase.com',
    'twitter.com','x.com','youtube.com','tiktok.com','pinterest.com'
  );

-- 2) Null-out poisoned domains and flag prospects for manual review
UPDATE public.prospects
SET normalized_domain = NULL, website = NULL,
    enrichment_status = 'pending', review_needed = true,
    recommended_next_action = 'verify_domain',
    decision_maker_found = false, apollo_enriched_at = NULL,
    updated_at = now()
WHERE normalized_domain IN (
  'jusbrasil.com.br','linkedin.com','facebook.com','instagram.com',
  'econodata.com.br','cnpj.biz','cnpj.info','cnpjs.rocks','cnpjbiz.com',
  'consultasocio.com','empresaqualifica.com.br','casadosdados.com.br',
  'apontador.com.br','econoinfo.com.br','crunchbase.com',
  'twitter.com','x.com','youtube.com','tiktok.com','pinterest.com'
);

-- 3) Dedupe live rows by apollo_person_id within each workspace.
--    Keep the most recent (highest confidence_score, then newest created_at) as active;
--    soft-merge the rest into it.
WITH ranked AS (
  SELECT id, workspace_id, apollo_person_id, created_at, confidence_score,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, apollo_person_id
           ORDER BY COALESCE(confidence_score, 0) DESC, created_at DESC, id
         ) AS rn,
         FIRST_VALUE(id) OVER (
           PARTITION BY workspace_id, apollo_person_id
           ORDER BY COALESCE(confidence_score, 0) DESC, created_at DESC, id
         ) AS keeper_id
  FROM public.enriched_contact_profiles
  WHERE is_merged = false AND apollo_person_id IS NOT NULL
)
UPDATE public.enriched_contact_profiles ecp
SET is_merged = true,
    merged_into = ranked.keeper_id,
    updated_at = now()
FROM ranked
WHERE ecp.id = ranked.id AND ranked.rn > 1;

-- 4) Dedupe live rows by linkedin_url within each workspace.
WITH ranked AS (
  SELECT id, workspace_id, lower(linkedin_url) AS lk, created_at, confidence_score,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, lower(linkedin_url)
           ORDER BY COALESCE(confidence_score, 0) DESC, created_at DESC, id
         ) AS rn,
         FIRST_VALUE(id) OVER (
           PARTITION BY workspace_id, lower(linkedin_url)
           ORDER BY COALESCE(confidence_score, 0) DESC, created_at DESC, id
         ) AS keeper_id
  FROM public.enriched_contact_profiles
  WHERE is_merged = false AND linkedin_url IS NOT NULL
)
UPDATE public.enriched_contact_profiles ecp
SET is_merged = true,
    merged_into = COALESCE(ecp.merged_into, ranked.keeper_id),
    updated_at = now()
FROM ranked
WHERE ecp.id = ranked.id AND ranked.rn > 1;

-- 5) Cross-prospect dedupe guards (org-scoped). Live rows only.
CREATE UNIQUE INDEX IF NOT EXISTS enriched_contact_profiles_apollo_person_id_org_unique
  ON public.enriched_contact_profiles (workspace_id, apollo_person_id)
  WHERE apollo_person_id IS NOT NULL AND is_merged = false;

CREATE UNIQUE INDEX IF NOT EXISTS enriched_contact_profiles_linkedin_url_org_unique
  ON public.enriched_contact_profiles (workspace_id, lower(linkedin_url))
  WHERE linkedin_url IS NOT NULL AND is_merged = false;
