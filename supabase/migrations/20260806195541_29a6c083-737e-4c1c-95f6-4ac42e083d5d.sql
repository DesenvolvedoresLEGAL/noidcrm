
CREATE OR REPLACE FUNCTION public.recompute_primary_contact(p_prospect_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new_primary uuid;
  v_old_primary uuid;
  v_org uuid;
begin
  select organization_id into v_org from public.prospects where id = p_prospect_id;

  select id into v_old_primary from public.enriched_contact_profiles
  where prospect_id = p_prospect_id and is_primary = true limit 1;

  select id into v_new_primary from public.enriched_contact_profiles
  where prospect_id = p_prospect_id
    and coalesce(is_merged, false) = false
  order by
    case phone_match_quality
      when 'person_whatsapp' then 1
      when 'person_mobile' then 2
      when 'person_direct' then 3
      when 'company_reception' then 8
      when 'company_main' then 9
      else 5
    end asc,
    coalesce(phone_confidence, 0) desc,
    coalesce(confidence_score, 0) desc,
    case seniority
      when 'c_level' then 1 when 'vp' then 2 when 'director' then 3
      when 'manager' then 4 else 5
    end asc,
    (linkedin_url is not null) desc,
    created_at asc
  limit 1;

  if v_new_primary is null then return null; end if;

  if v_new_primary <> coalesce(v_old_primary, '00000000-0000-0000-0000-000000000000'::uuid) then
    update public.enriched_contact_profiles set is_primary = false
      where prospect_id = p_prospect_id and id <> v_new_primary and is_primary = true;
    update public.enriched_contact_profiles set is_primary = true
      where id = v_new_primary;
    if v_org is not null then
      begin
        insert into public.revenue_events (organization_id, channel, event_type, source, payload, prospect_id, contact_id)
        values (v_org, 'system', 'primary_contact_recomputed', 'system', jsonb_build_object(
          'prospect_id', p_prospect_id,
          'old_primary', v_old_primary,
          'new_primary', v_new_primary
        ), p_prospect_id, v_new_primary);
      exception when others then
        raise warning 'revenue_events insert failed in recompute_primary_contact: %', sqlerrm;
      end;
    end if;
  end if;

  return v_new_primary;
end;
$function$;

-- KAI.18.16: limpeza conservadora. Nunca marca not_found quando existe payload
-- com telefone já pago ou job assíncrono ainda vivo.
CREATE OR REPLACE FUNCTION public.cleanup_stale_phone_reveal_requests()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
BEGIN
  -- 1) Contatos com payload contendo telefone ficam pendentes de reprocessamento (0 crédito).
  UPDATE public.enrichment_jobs j
  SET reconciliation_required = true,
      next_retry_at = now(),
      skip_reason = 'payload_reprocess_required'
  WHERE j.status IN ('queued','running','pending_provider')
    AND EXISTS (
      SELECT 1 FROM public.apollo_reveal_audit a
      WHERE a.contact_id = (j.request->>'contact_id')::uuid
        AND a.raw_response::text ILIKE '%phone_numbers%'
        AND a.raw_response::text ~ '"(sanitized_number|raw_number)"\s*:\s*"\+?[0-9]'
    );

  WITH stale AS (
    UPDATE public.enriched_contact_profiles c
    SET
      phone_reveal_status = 'not_found',
      phone_revealed = false,
      phone_source_type = COALESCE(phone_source_type, 'unknown'),
      phone_quality_reason = COALESCE(phone_quality_reason, 'resolved_stuck_requested'),
      updated_at = now()
    WHERE c.phone_reveal_status IN ('requested','awaiting','pending')
      AND (c.last_reveal_attempt_at IS NULL OR c.last_reveal_attempt_at < now() - interval '30 minutes')
      -- sem job assíncrono vivo
      AND NOT EXISTS (
        SELECT 1 FROM public.enrichment_jobs j
        WHERE (j.request->>'contact_id')::uuid = c.id
          AND j.status IN ('queued','running','pending_provider')
          AND (j.expires_at IS NULL OR j.expires_at > now())
      )
      -- sem payload pago com telefone
      AND NOT EXISTS (
        SELECT 1 FROM public.apollo_reveal_audit a
        WHERE a.contact_id = c.id
          AND a.raw_response::text ~ '"(sanitized_number|raw_number)"\s*:\s*"\+?[0-9]'
      )
    RETURNING c.id
  )
  SELECT count(*) INTO affected FROM stale;

  UPDATE public.apollo_reveal_audit a
  SET status = 'not_found',
      reason = COALESCE(reason, 'resolved_stuck_requested')
  WHERE a.status IN ('pending','requested','awaiting')
    AND a.created_at < now() - interval '30 minutes'
    AND NOT (a.raw_response::text ~ '"(sanitized_number|raw_number)"\s*:\s*"\+?[0-9]');

  RETURN affected;
END;
$function$;
