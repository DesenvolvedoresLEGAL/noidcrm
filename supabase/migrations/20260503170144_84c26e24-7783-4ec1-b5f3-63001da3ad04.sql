
-- ============================================================
-- Sprint NRHS 1.5 — get_nrhs_analytics com joins seguros + escopo comercial
-- Travas mantidas: sem CREATE TEMP TABLE, sem alias 'value' em CTE,
-- sem nested select PostgREST, assinatura preservada.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_nrhs_analytics(uuid, uuid, boolean, uuid);

CREATE OR REPLACE FUNCTION public.get_nrhs_analytics(
  p_org_id uuid,
  p_owner_id uuid DEFAULT NULL,
  p_only_privileged boolean DEFAULT true,
  p_caller_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller uuid := COALESCE(auth.uid(), p_caller_user_id);
  v_is_member boolean;
  v_effective_owner uuid;
  v_result jsonb;
  v_empty jsonb := jsonb_build_object(
    'summary', jsonb_build_object(
      'total', 0, 'nrhs_avg', 0,
      'elite_count', 0, 'healthy_count', 0, 'risk_count', 0,
      'critical_count', 0, 'insalubrious_count', 0,
      'value_at_risk', 0, 'total_value', 0
    ),
    'distribution', '[]'::jsonb,
    'pillars', jsonb_build_object(
      'integrity', 0, 'cadence', 0, 'stakeholders', 0,
      'winloss', 0, 'adherence', 0, 'evidence', 0
    ),
    'deals', '[]'::jsonb,
    'owners', '[]'::jsonb,
    'filters', jsonb_build_object(
      'pipeline_options', '[]'::jsonb,
      'owner_options', '[]'::jsonb,
      'stage_options', '[]'::jsonb,
      'applied_scope', 'commercial',
      'included_pipeline_types', jsonb_build_array('sales','qualification'),
      'excluded_pipeline_types', jsonb_build_array('onboarding','renewal')
    ),
    'generated_at', now()
  );
BEGIN
  IF p_org_id IS NULL THEN
    RETURN v_empty;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = v_caller
      AND om.status = 'active'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN v_empty;
  END IF;

  IF p_only_privileged THEN
    v_effective_owner := p_owner_id;
  ELSE
    v_effective_owner := COALESCE(p_owner_id, v_caller);
  END IF;

  WITH base AS (
    SELECT
      o.id,
      o.title,
      o.account_id,
      o.owner_user_id,
      o.stage_id,
      o.pipeline_id,
      COALESCE(o.valor_previsto, 0)::numeric AS deal_amount,
      COALESCE(o.nrhs_score, 0)::int        AS nrhs_score_v,
      o.nrhs_status,
      o.nrhs_issues_count,
      o.nrhs_blockers,
      o.nrhs_data_integrity_score,
      o.nrhs_cadence_score,
      o.nrhs_stakeholders_score,
      o.nrhs_win_loss_score,
      o.nrhs_process_adherence_score,
      o.nrhs_evidence_score,
      o.nrhs_last_calculated_at,
      o.created_at,
      COALESCE(NULLIF(a.nome_fantasia,''), NULLIF(a.razao_social,''), 'Conta sem nome') AS account_name,
      COALESCE(NULLIF(s.name,''), 'Estágio não informado') AS stage_name,
      COALESCE(NULLIF(p.name,''), 'Pipeline não informado') AS pipeline_name,
      p.pipeline_type AS pipeline_type,
      COALESCE(NULLIF(u.full_name,''), NULLIF(u.email,''), 'Sem responsável') AS owner_name,
      (u.user_id IS NULL AND o.owner_user_id IS NOT NULL) AS is_inactive_owner,
      CASE
        WHEN COALESCE(o.nrhs_score, 0) >= 90 THEN 'elite'
        WHEN COALESCE(o.nrhs_score, 0) >= 75 THEN 'healthy'
        WHEN COALESCE(o.nrhs_score, 0) >= 50 THEN 'risk'
        WHEN COALESCE(o.nrhs_score, 0) >= 25 THEN 'critical'
        ELSE 'insalubrious'
      END AS tier_bucket
    FROM public.opportunities o
    LEFT JOIN public.accounts a
      ON a.id = o.account_id
     AND a.organization_id = o.organization_id
    LEFT JOIN public.pipelines p
      ON p.id = o.pipeline_id
     AND p.organization_id = o.organization_id
    LEFT JOIN public.stages s
      ON s.id = o.stage_id
     AND s.organization_id = o.organization_id
    LEFT JOIN public.crm_active_users_view u
      ON u.user_id = o.owner_user_id
     AND u.tenant_id = o.organization_id
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND COALESCE(o.status, 'open') NOT IN ('won','lost','disqualified')
      AND COALESCE(p.pipeline_type, 'sales') IN ('sales','qualification')
      AND (v_effective_owner IS NULL OR o.owner_user_id = v_effective_owner)
  ),
  totals AS (
    SELECT
      COUNT(*)                                                         AS total,
      COALESCE(ROUND(AVG(NULLIF(nrhs_score_v, 0))), 0)::int            AS nrhs_avg_v,
      COALESCE(SUM(deal_amount), 0)::numeric                           AS total_amount,
      COALESCE(SUM(deal_amount) FILTER (
        WHERE tier_bucket IN ('risk','critical','insalubrious')
      ), 0)::numeric                                                   AS value_at_risk_amount,
      COUNT(*) FILTER (WHERE tier_bucket = 'elite')                    AS elite_count,
      COUNT(*) FILTER (WHERE tier_bucket = 'healthy')                  AS healthy_count,
      COUNT(*) FILTER (WHERE tier_bucket = 'risk')                     AS risk_count,
      COUNT(*) FILTER (WHERE tier_bucket = 'critical')                 AS critical_count,
      COUNT(*) FILTER (WHERE tier_bucket = 'insalubrious')             AS insalubrious_count,
      COALESCE(ROUND(AVG(nrhs_data_integrity_score)), 0)::int          AS pillar_integrity,
      COALESCE(ROUND(AVG(nrhs_cadence_score)), 0)::int                 AS pillar_cadence,
      COALESCE(ROUND(AVG(nrhs_stakeholders_score)), 0)::int            AS pillar_stakeholders,
      COALESCE(ROUND(AVG(nrhs_win_loss_score)), 0)::int                AS pillar_winloss,
      COALESCE(ROUND(AVG(nrhs_process_adherence_score)), 0)::int       AS pillar_adherence,
      COALESCE(ROUND(AVG(nrhs_evidence_score)), 0)::int                AS pillar_evidence
    FROM base
  ),
  dist AS (
    SELECT
      tier_bucket AS tier,
      COUNT(*)::int AS tier_count,
      COALESCE(SUM(deal_amount), 0)::numeric AS tier_amount
    FROM base
    GROUP BY tier_bucket
  ),
  owners_agg AS (
    SELECT
      owner_user_id AS user_id,
      MAX(owner_name) AS user_name,
      bool_or(is_inactive_owner) AS is_inactive,
      COUNT(*)::int AS deal_count,
      COALESCE(ROUND(AVG(NULLIF(nrhs_score_v, 0))), 0)::int AS average_nrhs,
      COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE tier_bucket IN ('elite','healthy')) / NULLIF(COUNT(*),0)), 0)::int AS healthy_percent,
      COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE tier_bucket = 'insalubrious') / NULLIF(COUNT(*),0)), 0)::int AS insalubrious_percent,
      COALESCE(SUM(deal_amount) FILTER (
        WHERE tier_bucket IN ('risk','critical','insalubrious')
      ), 0)::numeric AS owner_value_at_risk
    FROM base
    WHERE owner_user_id IS NOT NULL
    GROUP BY owner_user_id
  ),
  pipeline_options AS (
    SELECT DISTINCT ON (p.id) p.id, p.name, p.pipeline_type
    FROM public.pipelines p
    WHERE p.organization_id = p_org_id
    ORDER BY p.id, p.name
  ),
  stage_options AS (
    SELECT DISTINCT s.id, s.name, s.pipeline_id
    FROM base b
    JOIN public.stages s ON s.id = b.stage_id
    WHERE s.organization_id = p_org_id
  ),
  owner_options AS (
    SELECT DISTINCT ON (b.owner_user_id)
      b.owner_user_id AS user_id,
      b.owner_name AS full_name,
      b.is_inactive_owner AS is_inactive
    FROM base b
    WHERE b.owner_user_id IS NOT NULL
    ORDER BY b.owner_user_id, b.owner_name
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total',               (SELECT total FROM totals),
      'nrhs_avg',            (SELECT nrhs_avg_v FROM totals),
      'elite_count',         (SELECT elite_count FROM totals),
      'healthy_count',       (SELECT healthy_count FROM totals),
      'risk_count',          (SELECT risk_count FROM totals),
      'critical_count',      (SELECT critical_count FROM totals),
      'insalubrious_count',  (SELECT insalubrious_count FROM totals),
      'value_at_risk',       (SELECT value_at_risk_amount FROM totals),
      'total_value',         (SELECT total_amount FROM totals)
    ),
    'distribution', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tier',  d.tier,
        'count', d.tier_count,
        'value', d.tier_amount
      ))
      FROM dist d
    ), '[]'::jsonb),
    'pillars', jsonb_build_object(
      'integrity',    (SELECT pillar_integrity FROM totals),
      'cadence',      (SELECT pillar_cadence FROM totals),
      'stakeholders', (SELECT pillar_stakeholders FROM totals),
      'winloss',      (SELECT pillar_winloss FROM totals),
      'adherence',    (SELECT pillar_adherence FROM totals),
      'evidence',     (SELECT pillar_evidence FROM totals)
    ),
    'deals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',                 b.id,
        'title',              b.title,
        'account_id',         b.account_id,
        'account_name',       b.account_name,
        'owner_user_id',      b.owner_user_id,
        'owner_name',         b.owner_name,
        'is_inactive_owner',  b.is_inactive_owner,
        'stage_id',           b.stage_id,
        'stage_name',         b.stage_name,
        'pipeline_id',        b.pipeline_id,
        'pipeline_name',      b.pipeline_name,
        'pipeline_type',      b.pipeline_type,
        'value',              b.deal_amount,
        'opportunity_score',  NULL,
        'nrhs_score',         b.nrhs_score_v,
        'nrhs_tier',          b.tier_bucket,
        'nrhs_status',        b.nrhs_status,
        'nrhs_issues_count',  b.nrhs_issues_count,
        'nrhs_blockers',      COALESCE(b.nrhs_blockers, '[]'::jsonb),
        'pillars', jsonb_build_object(
          'integrity',    b.nrhs_data_integrity_score,
          'cadence',      b.nrhs_cadence_score,
          'stakeholders', b.nrhs_stakeholders_score,
          'winloss',      b.nrhs_win_loss_score,
          'adherence',    b.nrhs_process_adherence_score,
          'evidence',     b.nrhs_evidence_score
        ),
        'last_reviewed_at',   b.nrhs_last_calculated_at,
        'created_at',         b.created_at
      ) ORDER BY b.nrhs_score_v ASC, b.deal_amount DESC)
      FROM base b
    ), '[]'::jsonb),
    'owners', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',              o.user_id,
        'user_name',            o.user_name,
        'is_inactive',          o.is_inactive,
        'avatar_url',           NULL,
        'deal_count',           o.deal_count,
        'average_nrhs',         o.average_nrhs,
        'healthy_percent',      o.healthy_percent,
        'insalubrious_percent', o.insalubrious_percent,
        'value_at_risk',        o.owner_value_at_risk,
        'evolution_7d',         NULL
      ) ORDER BY o.average_nrhs DESC)
      FROM owners_agg o
    ), '[]'::jsonb),
    'filters', jsonb_build_object(
      'pipeline_options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', po.id, 'name', po.name, 'pipeline_type', po.pipeline_type
        ) ORDER BY po.name)
        FROM pipeline_options po
      ), '[]'::jsonb),
      'owner_options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'user_id', oo.user_id, 'full_name', oo.full_name, 'is_inactive', oo.is_inactive
        ) ORDER BY oo.full_name)
        FROM owner_options oo
      ), '[]'::jsonb),
      'stage_options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', so.id, 'name', so.name, 'pipeline_id', so.pipeline_id
        ) ORDER BY so.name)
        FROM stage_options so
      ), '[]'::jsonb),
      'applied_scope', 'commercial',
      'included_pipeline_types', jsonb_build_array('sales','qualification'),
      'excluded_pipeline_types', jsonb_build_array('onboarding','renewal')
    ),
    'generated_at', now()
  ) INTO v_result;

  RETURN COALESCE(v_result, v_empty);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_nrhs_analytics(uuid, uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nrhs_analytics(uuid, uuid, boolean, uuid) TO authenticated;

-- ============================================================
-- enqueue_nrhs_recalc_for_filters: restringir a escopo comercial
-- ============================================================

CREATE OR REPLACE FUNCTION public.enqueue_nrhs_recalc_for_filters(
  p_org_id uuid,
  p_owner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    LEFT JOIN public.pipelines p
      ON p.id = o.pipeline_id
     AND p.organization_id = o.organization_id
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND COALESCE(o.status, 'open') NOT IN ('won','lost','disqualified')
      AND COALESCE(p.pipeline_type, 'sales') IN ('sales','qualification')
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
$function$;
