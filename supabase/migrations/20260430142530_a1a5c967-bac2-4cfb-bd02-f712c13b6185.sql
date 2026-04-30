
-- =========================================================
-- 1) NEW RPC: sync_enriched_contacts_to_account
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_enriched_contacts_to_account(
  p_prospect_id uuid,
  p_account_id uuid,
  p_contact_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_prospect_org uuid;
  v_account_org uuid;
  v_ec RECORD;
  v_existing_contact_id uuid;
  v_new_contact_id uuid;
  v_emails jsonb;
  v_telefones jsonb;
  v_existing_phones jsonb;
  v_phone_already boolean;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_primary_contact_id uuid := NULL;
  v_opp_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id INTO v_prospect_org FROM prospects WHERE id = p_prospect_id;
  IF v_prospect_org IS NULL THEN
    RAISE EXCEPTION 'Prospect not found';
  END IF;

  SELECT organization_id INTO v_account_org FROM accounts WHERE id = p_account_id;
  IF v_account_org IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_prospect_org <> v_account_org THEN
    RAISE EXCEPTION 'Prospect and account belong to different organizations';
  END IF;

  v_org_id := v_account_org;

  -- Membership check
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = v_user_id AND organization_id = v_org_id AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = v_user_id AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to organization';
  END IF;

  IF p_contact_ids IS NULL OR array_length(p_contact_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('created', 0, 'updated', 0, 'skipped', 0);
  END IF;

  -- Iterate selected enriched contacts (only active, same org, same prospect)
  FOR v_ec IN
    SELECT *
    FROM enriched_contact_profiles
    WHERE id = ANY(p_contact_ids)
      AND prospect_id = p_prospect_id
      AND workspace_id = v_org_id
      AND is_merged = false
  LOOP
    -- Build emails / phones jsonb
    v_emails := CASE
      WHEN v_ec.email IS NOT NULL AND length(trim(v_ec.email)) > 0
      THEN jsonb_build_array(jsonb_build_object(
        'value', v_ec.email,
        'type', 'work',
        'is_primary', true,
        'status', COALESCE(v_ec.email_status, 'unknown')
      ))
      ELSE '[]'::jsonb
    END;

    v_telefones := CASE
      WHEN v_ec.phone IS NOT NULL AND length(trim(v_ec.phone)) > 0
      THEN jsonb_build_array(jsonb_build_object(
        'value', v_ec.phone,
        'type', 'mobile',
        'is_primary', true
      ))
      ELSE '[]'::jsonb
    END;

    -- Try to find an existing contact in the SAME account with the same email
    v_existing_contact_id := NULL;
    IF v_ec.email IS NOT NULL THEN
      SELECT c.id INTO v_existing_contact_id
      FROM contacts c
      WHERE c.organization_id = v_org_id
        AND c.account_id = p_account_id
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(c.emails, '[]'::jsonb)) e
          WHERE lower(trim(e->>'value')) = lower(trim(v_ec.email))
        )
      LIMIT 1;
    END IF;

    -- Fallback: match by full_name within account when no email
    IF v_existing_contact_id IS NULL AND v_ec.full_name IS NOT NULL THEN
      SELECT c.id INTO v_existing_contact_id
      FROM contacts c
      WHERE c.organization_id = v_org_id
        AND c.account_id = p_account_id
        AND c.deleted_at IS NULL
        AND lower(trim(c.nome)) = lower(trim(v_ec.full_name))
      LIMIT 1;
    END IF;

    IF v_existing_contact_id IS NOT NULL THEN
      -- UPDATE: only fill empty fields, append phone if missing
      SELECT telefones INTO v_existing_phones FROM contacts WHERE id = v_existing_contact_id;
      v_phone_already := false;
      IF v_ec.phone IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(v_existing_phones, '[]'::jsonb)) p
          WHERE regexp_replace(p->>'value', '\D', '', 'g') = regexp_replace(v_ec.phone, '\D', '', 'g')
        ) INTO v_phone_already;
      END IF;

      UPDATE contacts SET
        cargo = COALESCE(NULLIF(cargo, ''), v_ec.role_title),
        departamento = COALESCE(NULLIF(departamento, ''), v_ec.department),
        linkedin = COALESCE(NULLIF(linkedin, ''), v_ec.linkedin_url),
        primeiro_nome = COALESCE(NULLIF(primeiro_nome, ''), v_ec.first_name, primeiro_nome),
        ultimo_nome = COALESCE(NULLIF(ultimo_nome, ''), v_ec.last_name, ultimo_nome),
        emails = CASE
          WHEN v_ec.email IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(emails, '[]'::jsonb)) e
            WHERE lower(trim(e->>'value')) = lower(trim(v_ec.email))
          )
          THEN COALESCE(emails, '[]'::jsonb) || v_emails
          ELSE COALESCE(emails, '[]'::jsonb)
        END,
        telefones = CASE
          WHEN v_ec.phone IS NOT NULL AND NOT v_phone_already
          THEN COALESCE(telefones, '[]'::jsonb) || v_telefones
          ELSE COALESCE(telefones, '[]'::jsonb)
        END,
        updated_at = now()
      WHERE id = v_existing_contact_id;

      v_updated := v_updated + 1;
      IF v_ec.is_primary THEN v_primary_contact_id := v_existing_contact_id; END IF;
    ELSE
      -- INSERT new contact
      IF v_ec.full_name IS NULL AND v_ec.email IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO contacts (
        organization_id, account_id, nome, primeiro_nome, ultimo_nome,
        cargo, departamento, linkedin, emails, telefones
      ) VALUES (
        v_org_id,
        p_account_id,
        COALESCE(v_ec.full_name, trim(concat_ws(' ', v_ec.first_name, v_ec.last_name)), v_ec.email),
        COALESCE(v_ec.first_name, v_ec.full_name, ''),
        COALESCE(v_ec.last_name, ''),
        v_ec.role_title,
        v_ec.department,
        v_ec.linkedin_url,
        v_emails,
        v_telefones
      )
      RETURNING id INTO v_new_contact_id;

      v_created := v_created + 1;
      IF v_ec.is_primary THEN v_primary_contact_id := v_new_contact_id; END IF;
    END IF;

    -- Persist account_id back on enriched profile (handy for later lookups)
    UPDATE enriched_contact_profiles
    SET account_id = p_account_id, updated_at = now()
    WHERE id = v_ec.id AND account_id IS DISTINCT FROM p_account_id;
  END LOOP;

  -- If a primary was synced, point the most recent opportunity of the account to it
  IF v_primary_contact_id IS NOT NULL THEN
    SELECT id INTO v_opp_id
    FROM opportunities
    WHERE account_id = p_account_id
      AND organization_id = v_org_id
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_opp_id IS NOT NULL THEN
      UPDATE opportunities SET contact_id = v_primary_contact_id, updated_at = now()
      WHERE id = v_opp_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped,
    'primary_contact_id', v_primary_contact_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_enriched_contacts_to_account(uuid, uuid, uuid[]) TO authenticated;

-- =========================================================
-- 2) UPDATE import_prospect_to_pipeline to auto-sync enriched contacts
-- =========================================================
CREATE OR REPLACE FUNCTION public.import_prospect_to_pipeline(p_prospect_id uuid, p_target_pipeline_type text DEFAULT 'qualification'::text)
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
  v_signals JSONB := '[]'::jsonb;
  v_reasoning JSONB;
  v_profile RECORD;
  v_brief RECORD;
  v_has_profile BOOLEAN := FALSE;
  v_has_brief BOOLEAN := FALSE;
  v_note_id UUID;
  v_note_md TEXT;
  v_email_subject TEXT;
  v_email_body TEXT;
  v_email_to TEXT;
  v_account_name TEXT;
  v_geographic_presence_text TEXT;
  v_probable_pains_text TEXT;
  v_value_hypotheses_text TEXT;
  v_objection_predictions_text TEXT;
  v_email_payload JSONB := NULL;
  -- new
  v_enriched_ids uuid[];
  v_sync_result jsonb;
  v_synced_primary uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_prospect FROM prospects WHERE id = p_prospect_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prospect not found: %', p_prospect_id;
  END IF;

  v_org_id := v_prospect.organization_id;
  v_account_name := COALESCE(
    v_prospect.nome_fantasia,
    v_prospect.company_name,
    v_prospect.razao_social,
    'PROSPECT ' || upper(left(p_prospect_id::text, 8))
  );

  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = v_user_id AND organization_id = v_org_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = v_user_id AND organization_id = v_org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User does not belong to organization';
  END IF;

  SELECT id INTO v_pipeline_id FROM pipelines
  WHERE organization_id = v_org_id AND pipeline_type = p_target_pipeline_type
  ORDER BY is_primary DESC NULLS LAST, created_at ASC LIMIT 1;
  IF v_pipeline_id IS NULL THEN
    SELECT id INTO v_pipeline_id FROM pipelines
    WHERE organization_id = v_org_id
    ORDER BY is_primary DESC NULLS LAST, created_at ASC LIMIT 1;
  END IF;
  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'No pipeline found for organization';
  END IF;

  SELECT id INTO v_stage_id FROM pipeline_stages
  WHERE pipeline_id = v_pipeline_id
  ORDER BY position ASC NULLS LAST, created_at ASC LIMIT 1;
  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'No stage found for pipeline %', v_pipeline_id;
  END IF;

  -- Reuse matched account if present
  IF v_prospect.matched_account_id IS NOT NULL THEN
    SELECT id INTO v_account_id FROM accounts WHERE id = v_prospect.matched_account_id AND organization_id = v_org_id;
  END IF;

  IF v_account_id IS NULL AND v_prospect.cnpj IS NOT NULL THEN
    SELECT id INTO v_account_id FROM accounts
    WHERE organization_id = v_org_id AND cnpj = v_prospect.cnpj LIMIT 1;
  END IF;

  IF v_account_id IS NULL AND v_prospect.normalized_domain IS NOT NULL THEN
    SELECT id INTO v_account_id FROM accounts
    WHERE organization_id = v_org_id AND website ILIKE '%' || v_prospect.normalized_domain || '%' LIMIT 1;
  END IF;

  IF v_account_id IS NULL THEN
    INSERT INTO accounts (
      organization_id, razao_social, nome_fantasia, cnpj, website,
      cidade, estado, segmento, observacoes, origem_principal
    ) VALUES (
      v_org_id,
      COALESCE(v_prospect.razao_social, v_account_name),
      COALESCE(v_prospect.nome_fantasia, v_account_name),
      v_prospect.cnpj,
      COALESCE(v_prospect.website, 'https://' || v_prospect.normalized_domain),
      v_prospect.city,
      v_prospect.state,
      v_prospect.industry,
      COALESCE(v_prospect.summary, ''),
      COALESCE(v_prospect.source_label, 'lead_sourcing')
    )
    RETURNING id INTO v_account_id;
    v_account_created := TRUE;
  END IF;

  SELECT * INTO v_profile FROM enriched_company_profiles
  WHERE prospect_id = p_prospect_id
  ORDER BY last_enriched_at DESC NULLS LAST, created_at DESC LIMIT 1;
  v_has_profile := FOUND;

  IF v_has_profile AND v_profile.company_summary IS NOT NULL THEN
    UPDATE accounts SET observacoes = COALESCE(NULLIF(observacoes, ''), v_profile.company_summary)
    WHERE id = v_account_id;
  END IF;

  -- ====================================================================
  -- NEW: prefer enriched (Apollo) contacts. Fallback to email_public/phone.
  -- ====================================================================
  SELECT array_agg(id) INTO v_enriched_ids
  FROM enriched_contact_profiles
  WHERE prospect_id = p_prospect_id
    AND workspace_id = v_org_id
    AND is_merged = false
    AND (is_primary = true OR seniority IN ('c_level', 'vp', 'director', 'manager'));

  IF v_enriched_ids IS NOT NULL AND array_length(v_enriched_ids, 1) > 0 THEN
    v_sync_result := public.sync_enriched_contacts_to_account(p_prospect_id, v_account_id, v_enriched_ids);
    v_synced_primary := NULLIF(v_sync_result->>'primary_contact_id', '')::uuid;

    IF v_synced_primary IS NOT NULL THEN
      v_contact_id := v_synced_primary;
    ELSE
      -- pick any contact synced for the account
      SELECT id INTO v_contact_id FROM contacts
      WHERE account_id = v_account_id AND organization_id = v_org_id
        AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1;
    END IF;
  ELSIF v_prospect.email_public IS NOT NULL OR v_prospect.phone_public IS NOT NULL THEN
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
      v_org_id, v_account_id, v_account_name, v_account_name, v_emails, v_telefones
    )
    RETURNING id INTO v_contact_id;
  END IF;

  SELECT * INTO v_brief FROM commercial_briefs
  WHERE prospect_id = p_prospect_id ORDER BY created_at DESC LIMIT 1;
  v_has_brief := FOUND;

  v_priority_score := COALESCE((
    SELECT (icp_fit_score + signal_score + data_quality_score + source_trust_score - penalty_score)
    FROM prospect_scores WHERE prospect_id = p_prospect_id
    ORDER BY created_at DESC LIMIT 1
  ), 0);

  SELECT reasoning INTO v_reasoning FROM prospect_scores
  WHERE prospect_id = p_prospect_id ORDER BY created_at DESC LIMIT 1;
  IF v_reasoning ? 'signals' THEN
    v_signals := v_reasoning->'signals';
  END IF;

  INSERT INTO opportunities (
    organization_id, account_id, contact_id, owner_user_id,
    pipeline_id, stage_id, title, origem, status, temperatura,
    priority_score, prospect_id, source_metadata, created_by
  ) VALUES (
    v_org_id, v_account_id, v_contact_id, v_user_id,
    v_pipeline_id, v_stage_id,
    UPPER(v_account_name),
    COALESCE(v_prospect.source_label, 'lead_sourcing'),
    'open',
    CASE WHEN v_priority_score >= 200 THEN 'hot'
         WHEN v_priority_score >= 100 THEN 'warm'
         ELSE 'cold' END,
    v_priority_score,
    p_prospect_id,
    jsonb_build_object(
      'prospect_id', p_prospect_id,
      'priority_score', v_priority_score,
      'signals', v_signals,
      'cnpj', v_prospect.cnpj,
      'normalized_domain', v_prospect.normalized_domain,
      'imported_via', 'import_prospect_to_pipeline',
      'event_name', v_prospect.event_name,
      'event_url', v_prospect.event_url,
      'booth', v_prospect.booth,
      'company_profile', CASE WHEN v_has_profile THEN jsonb_build_object(
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
      'commercial_brief', CASE WHEN v_has_brief THEN jsonb_build_object(
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

  -- Build email payload (frontend dispatches via SMTP)
  IF v_has_brief AND v_brief.first_touch_message IS NOT NULL AND v_prospect.email_public IS NOT NULL THEN
    v_email_subject := COALESCE(
      v_brief.email_subject,
      'Conversa rápida sobre ' || v_account_name
    );
    v_email_body := v_brief.first_touch_message;
    v_email_to := v_prospect.email_public;

    v_email_payload := jsonb_build_object(
      'subject', v_email_subject,
      'body', v_email_body,
      'to', v_email_to,
      'opportunity_id', v_opportunity_id,
      'account_id', v_account_id,
      'contact_id', v_contact_id,
      'organization_id', v_org_id
    );
  END IF;

  -- Mark prospect as imported
  UPDATE prospects SET
    matched_account_id = v_account_id,
    approval_status = 'imported',
    status = 'converted',
    updated_at = now()
  WHERE id = p_prospect_id;

  RETURN jsonb_build_object(
    'account_id', v_account_id,
    'account_created', v_account_created,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id,
    'pipeline_id', v_pipeline_id,
    'stage_id', v_stage_id,
    'email_payload', v_email_payload
  );
END;
$function$;
