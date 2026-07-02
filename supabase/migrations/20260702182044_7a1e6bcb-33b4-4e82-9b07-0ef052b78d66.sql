-- KAI.15.2 — Apollo Phone Quality & Contact Prioritization

-- 1) enriched_contact_profiles: colunas de qualidade de telefone
ALTER TABLE public.enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS phone_source text,
  ADD COLUMN IF NOT EXISTS phone_type text,
  ADD COLUMN IF NOT EXISTS phone_match_quality text,
  ADD COLUMN IF NOT EXISTS phone_confidence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_last_validation_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_validation_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS phone_quality_reason text,
  ADD COLUMN IF NOT EXISTS is_whatsapp_ready boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ectp_phone_quality
  ON public.enriched_contact_profiles (workspace_id, phone_match_quality, phone_confidence)
  WHERE is_merged = false;

-- 2) apollo_reveal_audit: colunas de auditoria de qualidade
ALTER TABLE public.apollo_reveal_audit
  ADD COLUMN IF NOT EXISTS phone_source text,
  ADD COLUMN IF NOT EXISTS phone_type text,
  ADD COLUMN IF NOT EXISTS phone_match_quality text,
  ADD COLUMN IF NOT EXISTS phone_confidence integer,
  ADD COLUMN IF NOT EXISTS is_whatsapp_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_quality_reason text;

-- 3) resolve_primary_contact — nova ordenação por qualidade de telefone
CREATE OR REPLACE FUNCTION public.resolve_primary_contact(p_prospect_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_winner uuid;
BEGIN
  SELECT id INTO v_winner
  FROM public.enriched_contact_profiles
  WHERE prospect_id = p_prospect_id
    AND is_merged = false
  ORDER BY
    -- 1) telefone acionável: whatsapp > mobile > direct > (outros)
    CASE phone_match_quality
      WHEN 'person_whatsapp' THEN 4
      WHEN 'person_mobile'   THEN 3
      WHEN 'person_direct'   THEN 2
      ELSE 0
    END DESC,
    -- 2) confiança do telefone
    COALESCE(phone_confidence, 0) DESC,
    -- 3) contact score
    COALESCE(confidence_score, 0) DESC,
    -- 4) senioridade
    CASE seniority
      WHEN 'c_level'  THEN 5
      WHEN 'vp'       THEN 4
      WHEN 'director' THEN 3
      WHEN 'manager'  THEN 2
      ELSE 1
    END DESC,
    -- 5) tem linkedin
    CASE WHEN linkedin_url IS NOT NULL THEN 1 ELSE 0 END DESC,
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
$function$;

-- 4) mark_contact_phone_invalid — marca telefone como inválido e registra evento
CREATE OR REPLACE FUNCTION public.mark_contact_phone_invalid(
  p_contact_id uuid,
  p_reason text DEFAULT 'user_marked_invalid'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_prospect uuid;
  v_phone text;
BEGIN
  SELECT workspace_id, prospect_id, phone
    INTO v_org, v_prospect, v_phone
  FROM public.enriched_contact_profiles
  WHERE id = p_contact_id;

  IF v_org IS NULL THEN RETURN; END IF;

  -- Autorização: apenas membros da org
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_org AND user_id = auth.uid()
  ) AND NOT public.is_platform_admin_for_rls(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.enriched_contact_profiles
     SET phone_validation_status  = 'invalid',
         phone_revealed           = false,
         is_whatsapp_ready        = false,
         phone_reveal_status      = 'failed',
         phone_quality_reason     = COALESCE(p_reason, 'user_marked_invalid'),
         phone_last_validation_at = now(),
         preferred_channel        = CASE
           WHEN email_revealed THEN 'email'
           WHEN linkedin_url IS NOT NULL THEN 'linkedin'
           ELSE 'unknown'
         END
   WHERE id = p_contact_id;

  INSERT INTO public.system_events (organization_id, event_type, payload)
  VALUES (v_org, 'phone_marked_invalid', jsonb_build_object(
    'contact_id', p_contact_id,
    'prospect_id', v_prospect,
    'phone', v_phone,
    'reason', p_reason,
    'user_id', auth.uid()
  ));

  BEGIN
    INSERT INTO public.revenue_events (organization_id, event_type, payload)
    VALUES (v_org, 'phone_marked_invalid', jsonb_build_object(
      'contact_id', p_contact_id,
      'prospect_id', v_prospect,
      'reason', p_reason
    ));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM public.resolve_primary_contact(v_prospect);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_contact_phone_invalid(uuid, text) TO authenticated;

-- 5) Backfill — telefones compartilhados entre múltiplos contatos da mesma empresa
--    são interpretados como telefone corporativo e rejeitados.
WITH digits AS (
  SELECT
    id,
    workspace_id,
    prospect_id,
    account_id,
    phone,
    regexp_replace(phone, '\D', '', 'g') AS phone_digits
  FROM public.enriched_contact_profiles
  WHERE is_merged = false
    AND phone_revealed = true
    AND phone IS NOT NULL
    AND phone <> ''
),
grouped AS (
  SELECT phone_digits, workspace_id, COALESCE(account_id::text, prospect_id::text) AS bucket, COUNT(*) AS n
  FROM digits
  WHERE length(phone_digits) >= 8
  GROUP BY phone_digits, workspace_id, COALESCE(account_id::text, prospect_id::text)
  HAVING COUNT(*) > 1
)
UPDATE public.enriched_contact_profiles ecp
   SET phone_revealed        = false,
       phone_reveal_status   = 'rejected_company_phone',
       phone_source_type     = 'company_main',
       phone_match_quality   = 'company_main',
       phone_confidence      = 10,
       is_whatsapp_ready     = false,
       phone_validation_status = 'invalid',
       phone_quality_reason  = 'suspected_shared_company_phone',
       phone_last_validation_at = now()
  FROM digits d
  JOIN grouped g
    ON g.phone_digits = d.phone_digits
   AND g.workspace_id = d.workspace_id
   AND g.bucket = COALESCE(d.account_id::text, d.prospect_id::text)
 WHERE ecp.id = d.id;

-- 6) Backfill — telefones únicos já revelados: qualidade desconhecida (não deletar)
UPDATE public.enriched_contact_profiles
   SET phone_source            = COALESCE(phone_source, 'apollo'),
       phone_match_quality     = COALESCE(phone_match_quality, 'unknown'),
       phone_confidence        = GREATEST(COALESCE(phone_confidence, 0), 50),
       phone_validation_status = COALESCE(NULLIF(phone_validation_status, 'unknown'), 'unknown')
 WHERE is_merged = false
   AND phone_revealed = true
   AND phone IS NOT NULL
   AND phone_match_quality IS NULL;

-- 7) Backfill — rejeitados já classificados (KAI.15.1) ganham match_quality/confidence
UPDATE public.enriched_contact_profiles
   SET phone_match_quality   = 'company_main',
       phone_confidence      = 10,
       phone_validation_status = 'invalid',
       is_whatsapp_ready     = false,
       phone_quality_reason  = COALESCE(phone_quality_reason, 'company_phone_rejected')
 WHERE phone_reveal_status = 'rejected_company_phone'
   AND phone_match_quality IS NULL;

-- 8) Recomputar contato principal para prospects impactados
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT prospect_id
    FROM public.enriched_contact_profiles
    WHERE prospect_id IS NOT NULL
      AND (phone_match_quality IS NOT NULL OR is_primary = true)
  LOOP
    PERFORM public.resolve_primary_contact(r.prospect_id);
  END LOOP;
END $$;