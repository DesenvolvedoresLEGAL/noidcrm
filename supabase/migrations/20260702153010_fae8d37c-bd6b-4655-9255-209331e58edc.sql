
-- KAI.15.1 — Apollo Phone Quality Guard: schema
ALTER TABLE public.enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS phone_source_type text;

ALTER TABLE public.apollo_reveal_audit
  ADD COLUMN IF NOT EXISTS phone_source_type text;

-- Backfill: contatos com telefone revelado onde >=2 contatos do mesmo prospect
-- compartilham o mesmo telefone são muito provavelmente telefones da empresa
-- gravados incorretamente. Limpar e marcar como not_found com motivo auditável.
WITH duplicates AS (
  SELECT prospect_id, phone
  FROM public.enriched_contact_profiles
  WHERE phone IS NOT NULL
    AND phone_revealed = true
    AND COALESCE(is_merged, false) = false
    AND prospect_id IS NOT NULL
  GROUP BY prospect_id, phone
  HAVING count(*) > 1
),
affected AS (
  SELECT e.id, e.workspace_id, e.prospect_id, e.phone
  FROM public.enriched_contact_profiles e
  JOIN duplicates d
    ON d.prospect_id = e.prospect_id
   AND d.phone = e.phone
  WHERE e.phone_revealed = true
)
UPDATE public.enriched_contact_profiles e
SET phone = NULL,
    phone_revealed = false,
    phone_reveal_status = 'not_found',
    phone_source_type = 'company_main',
    phone_revealed_at = NULL,
    preferred_channel = CASE
      WHEN COALESCE(e.email_revealed, false) THEN 'email'
      WHEN e.linkedin_url IS NOT NULL THEN 'linkedin'
      ELSE 'unknown'
    END
FROM affected a
WHERE e.id = a.id;

-- Registrar backfill em audit para observabilidade
INSERT INTO public.apollo_reveal_audit
  (organization_id, prospect_id, contact_id, requested_data_type, status, reason,
   phone_before, phone_after, phone_source_type, source, raw_response)
SELECT
  COALESCE(p.organization_id, e.workspace_id),
  e.prospect_id,
  e.id,
  'phone',
  'not_found',
  'suspected_company_phone_backfill_cleanup',
  a.phone,
  NULL,
  'company_main',
  'system',
  jsonb_build_object('backfill', true, 'reason', 'suspected_company_phone_backfill_cleanup')
FROM public.enriched_contact_profiles e
JOIN (
  SELECT prospect_id, phone
  FROM public.enriched_contact_profiles
  WHERE phone IS NOT NULL AND phone_revealed = true AND COALESCE(is_merged, false) = false
  GROUP BY prospect_id, phone
  HAVING count(*) > 1
) dups ON dups.prospect_id = e.prospect_id
LEFT JOIN public.prospects p ON p.id = e.prospect_id
JOIN LATERAL (SELECT dups.phone AS phone) a ON true
WHERE e.phone_reveal_status = 'not_found'
  AND e.phone_source_type = 'company_main'
  AND NOT EXISTS (
    SELECT 1 FROM public.apollo_reveal_audit ar
    WHERE ar.contact_id = e.id AND ar.reason = 'suspected_company_phone_backfill_cleanup'
  );
