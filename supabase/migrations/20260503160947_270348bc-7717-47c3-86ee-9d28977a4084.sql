
-- ============================================================================
-- HOTFIX SCORING 1.4.2 — RPCs para a aba Revenue Hygiene (NRHS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_nrhs_analytics(
  p_org_id uuid,
  p_owner_id uuid DEFAULT NULL,
  p_only_privileged boolean DEFAULT true,
  p_caller_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := COALESCE(auth.uid(), p_caller_user_id);
  v_is_member boolean;
  v_effective_owner uuid;
  v_total integer := 0;
  v_avg numeric := 0;
  v_elite int := 0;
  v_healthy int := 0;
  v_risk int := 0;
  v_critical int := 0;
  v_insalubrious int := 0;
  v_value_at_risk numeric := 0;
  v_total_value numeric := 0;
  v_distribution jsonb;
  v_pillars jsonb;
  v_deals jsonb;
  v_owners jsonb;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id is required';
  END IF;

  -- Membership check (caller must belong to the organization).
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = v_caller
      AND om.status = 'active'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Access denied for organization %', p_org_id USING ERRCODE = '42501';
  END IF;

  -- Non-privileged callers only see their own deals.
  IF p_only_privileged THEN
    v_effective_owner := p_owner_id;
  ELSE
    v_effective_owner := COALESCE(p_owner_id, v_caller);
  END IF;

  -- Materialized base set (limit 500, same as previous client query).
  CREATE TEMP TABLE IF NOT EXISTS _nrhs_base ON COMMIT DROP AS SELECT NULL::uuid AS id WHERE false;
  TRUNCATE _nrhs_base;
  DROP TABLE _nrhs_base;

  WITH base AS (
    SELECT
      o.id,
      o.title,
      COALESCE(o.value, 0)::numeric AS value,
      o.stage_id,
      o.owner_user_id,
      o.opportunity_score,
      o.nrhs_score,
      o.nrhs_tier,
      o.nrhs_status,
      o.nrhs_data_integrity_score,
      o.nrhs_cadence_score,
      o.nrhs_stakeholders_score,
      o.nrhs_win_loss_score,
      o.nrhs_process_adherence_score,
      o.nrhs_evidence_score,
      o.nrhs_issues_count,
      o.nrhs_blockers,
      o.nrhs_last_calculated_at,
      o.created_at,
      COALESCE(NULLIF(a.nome_fantasia, ''), NULLIF(a.razao_social, ''), 'Sem empresa') AS account_name,
      COALESCE(s.name, 'Sem estágio') AS stage_name,
      CASE
        WHEN o.owner_user_id IS NULL THEN 'Sem responsável'
        ELSE COALESCE(NULLIF(p.full_name, ''), 'Usuário ' || substring(o.owner_user_id::text, 1, 8))
      END AS owner_name
    FROM public.opportunities o
    LEFT JOIN public.accounts a
      ON a.id = o.account_id
     AND a.organization_id = o.organization_id
    LEFT JOIN public.stages s
      ON s.id = o.stage_id
     AND s.organization_id = o.organization_id
    LEFT JOIN public.profiles p
      ON p.user_id = o.owner_user_id
     AND p.organization_id = o.organization_id
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND COALESCE(o.status, 'open') NOT IN ('won','lost','disqualified')
      AND (v_effective_owner IS NULL OR o.owner_user_id = v_effective_owner)
    ORDER BY o.nrhs_score ASC NULLS FIRST
    LIMIT 500
  )
  SELECT
    count(*)::int,
    COALESCE(round(avg(COALESCE(nrhs_score, 0)))::int, 0),
    count(*) FILTER (WHERE COALESCE(nrhs_score, 0) >= 90)::int,
    count(*) FILTER (WHERE COALESCE(nrhs_score, 0) >= 75 AND COALESCE(nrhs_score, 0) < 90)::int,
    count(*) FILTER (WHERE COALESCE(nrhs_score, 0) >= 60 AND COALESCE(nrhs_score, 0) < 75)::int,
    count(*) FILTER (WHERE COALESCE(nrhs_score, 0) >= 40 AND COALESCE(nrhs_score, 0) < 60)::int,
    count(*) FILTER (WHERE COALESCE(nrhs_score, 0) < 40)::int,
    COALESCE(sum(value) FILTER (WHERE COALESCE(nrhs_score, 0) < 60), 0)::numeric,
    COALESCE(sum(value), 0)::numeric,
    COALESCE(jsonb_agg(jsonb_build_object(
      'tier', t.tier,
      'count', t.count,
      'value', t.value
    ) ORDER BY array_position(ARRAY['elite','healthy','risk','critical','insalubrious']::text[], t.tier)), '[]'::jsonb),
    jsonb_build_object(
      'integrity', COALESCE(round(avg(nrhs_data_integrity_score) / NULLIF(25.0, 0) * 100)::int, 0),
      'cadence', COALESCE(round(avg(nrhs_cadence_score) / NULLIF(20.0, 0) * 100)::int, 0),
      'stakeholders', COALESCE(round(avg(nrhs_stakeholders_score) / NULLIF(20.0, 0) * 100)::int, 0),
      'winloss', COALESCE(round(avg(nrhs_win_loss_score) / NULLIF(15.0, 0) * 100)::int, 0),
      'adherence', COALESCE(round(avg(nrhs_process_adherence_score) / NULLIF(10.0, 0) * 100)::int, 0),
      'evidence', COALESCE(round(avg(nrhs_evidence_score) / NULLIF(10.0, 0) * 100)::int, 0)
    ),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'title', title,
      'account_name', account_name,
      'owner_user_id', owner_user_id,
      'owner_name', owner_name,
      'value', value,
      'stage_id', stage_id,
      'stage_name', stage_name,
      'opportunity_score', opportunity_score,
      'nrhs_score', nrhs_score,
      'nrhs_tier', nrhs_tier,
      'nrhs_status', nrhs_status,
      'nrhs_issues_count', COALESCE(nrhs_issues_count, 0),
      'nrhs_blockers', COALESCE(nrhs_blockers, '[]'::jsonb),
      'pillars', jsonb_build_object(
        'integrity', nrhs_data_integrity_score,
        'cadence', nrhs_cadence_score,
        'stakeholders', nrhs_stakeholders_score,
        'winloss', nrhs_win_loss_score,
        'adherence', nrhs_process_adherence_score,
        'evidence', nrhs_evidence_score
      ),
      'last_reviewed_at', nrhs_last_calculated_at,
      'created_at', created_at
    ) ORDER BY COALESCE(nrhs_score, 0) ASC), '[]'::jsonb)
  INTO
    v_total, v_avg, v_elite, v_healthy, v_risk, v_critical, v_insalubrious,
    v_value_at_risk, v_total_value, v_distribution, v_pillars, v_deals
  FROM base
  LEFT JOIN LATERAL (
    SELECT tier, count(*)::int AS count, COALESCE(sum(value), 0)::numeric AS value
    FROM (
      SELECT
        CASE
          WHEN COALESCE(b2.nrhs_score, 0) >= 90 THEN 'elite'
          WHEN COALESCE(b2.nrhs_score, 0) >= 75 THEN 'healthy'
          WHEN COALESCE(b2.nrhs_score, 0) >= 60 THEN 'risk'
          WHEN COALESCE(b2.nrhs_score, 0) >= 40 THEN 'critical'
          ELSE 'insalubrious'
        END AS tier,
        b2.value
      FROM base b2
    ) sub
    GROUP BY tier
  ) t ON true;

  -- Owner ranking (separate aggregation for clarity).
  WITH base2 AS (
    SELECT
      o.owner_user_id,
      COALESCE(o.value, 0)::numeric AS value,
      COALESCE(o.nrhs_score, 0)::int AS score,
      CASE
        WHEN o.owner_user_id IS NULL THEN 'Sem responsável'
        ELSE COALESCE(NULLIF(p.full_name, ''), 'Usuário ' || substring(o.owner_user_id::text, 1, 8))
      END AS owner_name
    FROM public.opportunities o
    LEFT JOIN public.profiles p
      ON p.user_id = o.owner_user_id
     AND p.organization_id = o.organization_id
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND COALESCE(o.status, 'open') NOT IN ('won','lost','disqualified')
      AND (v_effective_owner IS NULL OR o.owner_user_id = v_effective_owner)
    LIMIT 500
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', owner_user_id,
    'user_name', owner_name,
    'avatar_url', NULL,
    'deal_count', deal_count,
    'average_nrhs', average_nrhs,
    'healthy_percent', healthy_percent,
    'insalubrious_percent', insalubrious_percent,
    'value_at_risk', value_at_risk,
    'evolution_7d', NULL
  ) ORDER BY average_nrhs DESC NULLS LAST), '[]'::jsonb)
  INTO v_owners
  FROM (
    SELECT
      owner_user_id,
      max(owner_name) AS owner_name,
      count(*)::int AS deal_count,
      round(avg(score))::int AS average_nrhs,
      CASE WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE score >= 75)::numeric / count(*) * 100)::int ELSE 0 END AS healthy_percent,
      CASE WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE score < 40)::numeric / count(*) * 100)::int ELSE 0 END AS insalubrious_percent,
      COALESCE(sum(value) FILTER (WHERE score < 60), 0)::numeric AS value_at_risk
    FROM base2
    GROUP BY owner_user_id
  ) agg;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'total', v_total,
      'nrhs_avg', v_avg,
      'elite_count', v_elite,
      'healthy_count', v_healthy,
      'risk_count', v_risk,
      'critical_count', v_critical,
      'insalubrious_count', v_insalubrious,
      'value_at_risk', v_value_at_risk,
      'total_value', v_total_value,
      'healthy_pct', CASE WHEN v_total > 0 THEN round(v_healthy::numeric / v_total * 100)::int ELSE 0 END,
      'risk_pct', CASE WHEN v_total > 0 THEN round(v_risk::numeric / v_total * 100)::int ELSE 0 END,
      'critical_pct', CASE WHEN v_total > 0 THEN round(v_critical::numeric / v_total * 100)::int ELSE 0 END,
      'insalubrious_pct', CASE WHEN v_total > 0 THEN round(v_insalubrious::numeric / v_total * 100)::int ELSE 0 END
    ),
    'distribution', COALESCE(v_distribution, '[]'::jsonb),
    'pillars', COALESCE(v_pillars, '{}'::jsonb),
    'deals', COALESCE(v_deals, '[]'::jsonb),
    'owners', COALESCE(v_owners, '[]'::jsonb),
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_nrhs_analytics(uuid, uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nrhs_analytics(uuid, uuid, boolean, uuid) TO authenticated;

-- ============================================================================
-- enqueue_nrhs_recalc_for_filters
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_nrhs_recalc_for_filters(
  p_org_id uuid,
  p_owner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_member boolean;
  v_enqueued int := 0;
  v_skipped int := 0;
  r record;
  v_existing uuid;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id is required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = v_caller
      AND om.status = 'active'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Access denied for organization %', p_org_id USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT o.id, o.organization_id, o.account_id
    FROM public.opportunities o
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND COALESCE(o.status, 'open') NOT IN ('won','lost','disqualified')
      AND (p_owner_id IS NULL OR o.owner_user_id = p_owner_id)
    LIMIT 500
  LOOP
    v_existing := NULL;
    SELECT q.id INTO v_existing
    FROM public.nrhs_recalc_queue q
    WHERE q.opportunity_id = r.id
      AND q.status IN ('pending','processing')
      AND q.created_at > now() - interval '2 minutes'
    LIMIT 1;

    IF v_existing IS NULL THEN
      INSERT INTO public.nrhs_recalc_queue
        (organization_id, opportunity_id, account_id, trigger_source, trigger_action)
      VALUES (r.organization_id, r.id, r.account_id, 'manual_dashboard', 'recalculate');
      v_enqueued := v_enqueued + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('enqueued', v_enqueued, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_nrhs_recalc_for_filters(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_nrhs_recalc_for_filters(uuid, uuid) TO authenticated;
