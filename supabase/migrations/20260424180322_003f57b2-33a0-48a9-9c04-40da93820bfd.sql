
-- 1) Add enrichment columns to prospects
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS cnae_code TEXT,
  ADD COLUMN IF NOT EXISTS cnae_desc TEXT,
  ADD COLUMN IF NOT EXISTS porte TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cidade_enriched TEXT,
  ADD COLUMN IF NOT EXISTS uf_enriched TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS identity_enriched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_prospects_cnpj ON public.prospects(organization_id, cnpj) WHERE cnpj IS NOT NULL;

-- 2) RPC: import prospect to pipeline (qualification by default)
CREATE OR REPLACE FUNCTION public.import_prospect_to_pipeline(
  p_prospect_id UUID,
  p_target_pipeline_type TEXT DEFAULT 'qualification'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prospect RECORD;
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_pipeline_id TEXT;
  v_stage_id TEXT;
  v_account_id UUID;
  v_account_created BOOLEAN := FALSE;
  v_contact_id UUID;
  v_opportunity_id UUID;
  v_priority_score INTEGER;
  v_emails JSONB;
  v_telefones JSONB;
  v_signals JSONB;
  v_reasoning JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load prospect
  SELECT * INTO v_prospect FROM prospects WHERE id = p_prospect_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prospect not found: %', p_prospect_id;
  END IF;

  v_org_id := v_prospect.organization_id;

  -- Validate user belongs to this org
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_user_id AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to organization';
  END IF;

  -- Resolve pipeline (prefer is_primary among target type, fallback to first)
  SELECT id INTO v_pipeline_id
  FROM pipelines
  WHERE organization_id = v_org_id
    AND pipeline_type = p_target_pipeline_type
  ORDER BY is_primary DESC NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'No pipeline of type % found for org', p_target_pipeline_type;
  END IF;

  -- Resolve first stage
  SELECT id INTO v_stage_id
  FROM stages
  WHERE pipeline_id = v_pipeline_id
  ORDER BY order_index ASC
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'No stages found for pipeline %', v_pipeline_id;
  END IF;

  -- Score
  SELECT priority_score INTO v_priority_score
  FROM prospect_scores
  WHERE prospect_id = p_prospect_id
  ORDER BY created_at DESC
  LIMIT 1;
  v_priority_score := COALESCE(v_priority_score, 50);

  -- Dedup by CNPJ first, then by matched_account_id, then by domain
  IF v_prospect.cnpj IS NOT NULL THEN
    SELECT id INTO v_account_id
    FROM accounts
    WHERE organization_id = v_org_id
      AND cnpj = v_prospect.cnpj
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_account_id IS NULL AND v_prospect.matched_account_id IS NOT NULL THEN
    SELECT id INTO v_account_id
    FROM accounts
    WHERE id = v_prospect.matched_account_id AND deleted_at IS NULL;
  END IF;

  IF v_account_id IS NULL AND v_prospect.normalized_domain IS NOT NULL THEN
    SELECT id INTO v_account_id
    FROM accounts
    WHERE organization_id = v_org_id
      AND website ILIKE '%' || v_prospect.normalized_domain || '%'
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  -- Create account if no match
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (
      organization_id, razao_social, nome_fantasia, cnpj, website,
      cidade, uf, cep, segmento, cnae, porte,
      origem_principal, tipo_pessoa, created_by
    ) VALUES (
      v_org_id,
      COALESCE(v_prospect.razao_social, v_prospect.company_name),
      COALESCE(v_prospect.nome_fantasia, v_prospect.company_name),
      v_prospect.cnpj,
      CASE
        WHEN v_prospect.normalized_domain IS NOT NULL THEN 'https://' || v_prospect.normalized_domain
        ELSE v_prospect.website
      END,
      COALESCE(v_prospect.cidade_enriched, v_prospect.city),
      COALESCE(v_prospect.uf_enriched, v_prospect.state),
      v_prospect.cep,
      COALESCE(v_prospect.cnae_desc, v_prospect.industry),
      v_prospect.cnae_code,
      v_prospect.porte,
      'lead_sourcing',
      'PJ'::tipo_pessoa_type,
      v_user_id
    )
    RETURNING id INTO v_account_id;
    v_account_created := TRUE;
  END IF;

  -- Create contact if we have email/phone
  IF v_prospect.email_public IS NOT NULL OR v_prospect.phone_public IS NOT NULL THEN
    v_emails := CASE
      WHEN v_prospect.email_public IS NOT NULL
      THEN jsonb_build_array(jsonb_build_object('value', v_prospect.email_public, 'type', 'work', 'is_primary', true))
      ELSE '[]'::jsonb
    END;
    v_telefones := CASE
      WHEN v_prospect.phone_public IS NOT NULL
      THEN jsonb_build_array(jsonb_build_object('value', v_prospect.phone_public, 'type', 'mobile', 'is_primary', true))
      ELSE '[]'::jsonb
    END;

    INSERT INTO contacts (
      organization_id, account_id, nome, primeiro_nome, emails, telefones
    ) VALUES (
      v_org_id, v_account_id,
      COALESCE(v_prospect.nome_fantasia, v_prospect.company_name),
      COALESCE(v_prospect.nome_fantasia, v_prospect.company_name),
      v_emails, v_telefones
    )
    RETURNING id INTO v_contact_id;
  END IF;

  -- Build signals/source metadata
  SELECT reasoning INTO v_reasoning
  FROM prospect_scores
  WHERE prospect_id = p_prospect_id
  ORDER BY created_at DESC LIMIT 1;
  v_signals := COALESCE(v_reasoning->'signals', '[]'::jsonb);

  -- Create opportunity in target pipeline/stage
  INSERT INTO opportunities (
    organization_id, account_id, contact_id, owner_user_id,
    pipeline_id, stage_id, title, origem, status, temperatura,
    priority_score, prospect_id, source_metadata, created_by
  ) VALUES (
    v_org_id, v_account_id, v_contact_id, v_user_id,
    v_pipeline_id, v_stage_id,
    UPPER(COALESCE(v_prospect.nome_fantasia, v_prospect.company_name)),
    'lead_sourcing', 'new', 'warm',
    v_priority_score, p_prospect_id,
    jsonb_build_object(
      'source', 'lead_sourcing',
      'prospect_id', p_prospect_id,
      'priority_score', v_priority_score,
      'signals', v_signals,
      'cnpj', v_prospect.cnpj,
      'normalized_domain', v_prospect.normalized_domain,
      'imported_via', 'import_prospect_to_pipeline'
    ),
    v_user_id
  )
  RETURNING id INTO v_opportunity_id;

  -- Mark prospect as imported
  UPDATE prospects
  SET approval_status = 'imported',
      status = 'converted',
      approved_by = v_user_id,
      approved_at = now(),
      matched_account_id = v_account_id
  WHERE id = p_prospect_id;

  RETURN jsonb_build_object(
    'account_id', v_account_id,
    'account_created', v_account_created,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id,
    'pipeline_id', v_pipeline_id,
    'stage_id', v_stage_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_prospect_to_pipeline(UUID, TEXT) TO authenticated;
