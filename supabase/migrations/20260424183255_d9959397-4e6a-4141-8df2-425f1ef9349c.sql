-- 1) Add email_subject to commercial_briefs
ALTER TABLE public.commercial_briefs
  ADD COLUMN IF NOT EXISTS email_subject TEXT;

-- 2) Extend import_prospect_to_pipeline to:
--    - hydrate account.descricao (if column exists, ignore otherwise)
--    - persist commercial intelligence into opportunities.source_metadata
--    - create initial opportunity_note with structured markdown brief
--    - create draft email activity (status=pending) in the opportunity timeline
CREATE OR REPLACE FUNCTION public.import_prospect_to_pipeline(
  p_prospect_id uuid,
  p_target_pipeline_type text DEFAULT 'qualification'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_profile RECORD;
  v_brief RECORD;
  v_note_id UUID;
  v_activity_id UUID;
  v_note_md TEXT;
  v_email_subject TEXT;
  v_email_body TEXT;
  v_email_to TEXT[];
  v_account_name TEXT;
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

  v_account_name := COALESCE(v_prospect.nome_fantasia, v_prospect.company_name, v_prospect.razao_social);

  -- Hydrate account.observacoes with company_summary if empty
  SELECT * INTO v_profile
  FROM enriched_company_profiles
  WHERE prospect_id = p_prospect_id
  ORDER BY last_enriched_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_profile.company_summary IS NOT NULL THEN
    UPDATE accounts
    SET observacoes = COALESCE(NULLIF(observacoes, ''), v_profile.company_summary)
    WHERE id = v_account_id;
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
      v_account_name,
      v_account_name,
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

  -- Load latest commercial brief
  SELECT * INTO v_brief
  FROM commercial_briefs
  WHERE prospect_id = p_prospect_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create opportunity in target pipeline/stage with rich source_metadata
  INSERT INTO opportunities (
    organization_id, account_id, contact_id, owner_user_id,
    pipeline_id, stage_id, title, origem, status, temperatura,
    priority_score, prospect_id, source_metadata, created_by
  ) VALUES (
    v_org_id, v_account_id, v_contact_id, v_user_id,
    v_pipeline_id, v_stage_id,
    UPPER(v_account_name),
    'lead_sourcing', 'new', 'warm',
    v_priority_score, p_prospect_id,
    jsonb_build_object(
      'source', 'lead_sourcing',
      'prospect_id', p_prospect_id,
      'priority_score', v_priority_score,
      'signals', v_signals,
      'cnpj', v_prospect.cnpj,
      'normalized_domain', v_prospect.normalized_domain,
      'imported_via', 'import_prospect_to_pipeline',
      'event_name', v_prospect.event_name,
      'event_url', v_prospect.event_url,
      'booth', v_prospect.booth,
      'company_profile', CASE WHEN v_profile.id IS NOT NULL THEN jsonb_build_object(
        'company_summary', v_profile.company_summary,
        'business_model', v_profile.business_model,
        'market_type', v_profile.market_type,
        'company_size_estimate', v_profile.company_size_estimate,
        'geographic_presence', to_jsonb(v_profile.geographic_presence),
        'products_services', to_jsonb(v_profile.products_services),
        'industries_detected', to_jsonb(v_profile.industries_detected),
        'tech_signals', to_jsonb(v_profile.tech_signals),
        'growth_signals', to_jsonb(v_profile.growth_signals),
        'commercial_pains', to_jsonb(v_profile.commercial_pains),
        'strategic_notes', v_profile.strategic_notes,
        'confidence', v_profile.confidence
      ) ELSE NULL END,
      'commercial_brief', CASE WHEN v_brief.id IS NOT NULL THEN jsonb_build_object(
        'executive_summary', v_brief.executive_summary,
        'why_now', v_brief.why_now,
        'probable_pains', to_jsonb(v_brief.probable_pains),
        'value_hypotheses', to_jsonb(v_brief.value_hypotheses),
        'recommended_pitch_angle', v_brief.recommended_pitch_angle,
        'recommended_channel', v_brief.recommended_channel,
        'first_touch_message', v_brief.first_touch_message,
        'email_subject', v_brief.email_subject,
        'objection_predictions', to_jsonb(v_brief.objection_predictions),
        'confidence', v_brief.confidence
      ) ELSE NULL END
    ),
    v_user_id
  )
  RETURNING id INTO v_opportunity_id;

  -- Build markdown note from brief + profile + signals
  v_note_md := '# 🎯 Brief Comercial — ' || v_account_name || E'\n\n';

  IF v_prospect.event_name IS NOT NULL THEN
    v_note_md := v_note_md || '**📍 Evento de origem:** ' || v_prospect.event_name;
    IF v_prospect.booth IS NOT NULL THEN
      v_note_md := v_note_md || ' (stand ' || v_prospect.booth || ')';
    END IF;
    v_note_md := v_note_md || E'\n\n';
  END IF;

  IF v_brief.executive_summary IS NOT NULL THEN
    v_note_md := v_note_md || '## Resumo executivo' || E'\n' || v_brief.executive_summary || E'\n\n';
  END IF;

  IF v_brief.why_now IS NOT NULL THEN
    v_note_md := v_note_md || '## Por que agora' || E'\n' || v_brief.why_now || E'\n\n';
  END IF;

  IF v_profile.id IS NOT NULL THEN
    v_note_md := v_note_md || '## Perfil da empresa' || E'\n';
    IF v_profile.business_model IS NOT NULL THEN
      v_note_md := v_note_md || '- **Modelo:** ' || v_profile.business_model || E'\n';
    END IF;
    IF v_profile.market_type IS NOT NULL THEN
      v_note_md := v_note_md || '- **Mercado:** ' || v_profile.market_type || E'\n';
    END IF;
    IF v_profile.company_size_estimate IS NOT NULL THEN
      v_note_md := v_note_md || '- **Porte estimado:** ' || v_profile.company_size_estimate || E'\n';
    END IF;
    IF v_profile.geographic_presence IS NOT NULL AND array_length(v_profile.geographic_presence, 1) > 0 THEN
      v_note_md := v_note_md || '- **Presença geográfica:** ' || array_to_string(v_profile.geographic_presence, ', ') || E'\n';
    END IF;
    v_note_md := v_note_md || E'\n';
  END IF;

  IF v_brief.probable_pains IS NOT NULL AND array_length(v_brief.probable_pains, 1) > 0 THEN
    v_note_md := v_note_md || '## Dores prováveis' || E'\n';
    v_note_md := v_note_md || '- ' || array_to_string(v_brief.probable_pains, E'\n- ') || E'\n\n';
  END IF;

  IF v_brief.value_hypotheses IS NOT NULL AND array_length(v_brief.value_hypotheses, 1) > 0 THEN
    v_note_md := v_note_md || '## Hipóteses de valor' || E'\n';
    v_note_md := v_note_md || '- ' || array_to_string(v_brief.value_hypotheses, E'\n- ') || E'\n\n';
  END IF;

  IF v_brief.recommended_pitch_angle IS NOT NULL THEN
    v_note_md := v_note_md || '## Ângulo de abordagem recomendado' || E'\n' || v_brief.recommended_pitch_angle || E'\n\n';
  END IF;

  IF v_brief.objection_predictions IS NOT NULL AND array_length(v_brief.objection_predictions, 1) > 0 THEN
    v_note_md := v_note_md || '## Objeções previstas' || E'\n';
    v_note_md := v_note_md || '- ' || array_to_string(v_brief.objection_predictions, E'\n- ') || E'\n\n';
  END IF;

  IF jsonb_array_length(v_signals) > 0 THEN
    v_note_md := v_note_md || '## Sinais detectados' || E'\n';
    v_note_md := v_note_md || '```json' || E'\n' || jsonb_pretty(v_signals) || E'\n```' || E'\n';
  END IF;

  -- Insert note
  INSERT INTO opportunity_notes (opportunity_id, organization_id, created_by, content)
  VALUES (v_opportunity_id, v_org_id, v_user_id, v_note_md)
  RETURNING id INTO v_note_id;

  -- Build draft email activity (status=pending) if we have a first_touch_message
  IF v_brief.first_touch_message IS NOT NULL THEN
    v_email_subject := COALESCE(
      v_brief.email_subject,
      'Conexão NOID × ' || v_account_name ||
        CASE WHEN v_prospect.event_name IS NOT NULL THEN ' — ' || v_prospect.event_name ELSE '' END
    );

    v_email_body := v_brief.first_touch_message;

    v_email_to := CASE
      WHEN v_prospect.email_public IS NOT NULL THEN ARRAY[v_prospect.email_public]
      ELSE NULL
    END;

    INSERT INTO activities (
      organization_id, opportunity_id, account_id, contact_id, owner_user_id,
      type, status, title, description,
      email_subject, email_body, email_to, email_sent,
      ai_generated, is_automated
    ) VALUES (
      v_org_id, v_opportunity_id, v_account_id, v_contact_id, v_user_id,
      'email', 'pending',
      'Rascunho: e-mail inicial para ' || v_account_name,
      v_brief.first_touch_message,
      v_email_subject, v_email_body, v_email_to, FALSE,
      TRUE, FALSE
    )
    RETURNING id INTO v_activity_id;
  END IF;

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
    'stage_id', v_stage_id,
    'note_id', v_note_id,
    'activity_id', v_activity_id
  );
END;
$function$;