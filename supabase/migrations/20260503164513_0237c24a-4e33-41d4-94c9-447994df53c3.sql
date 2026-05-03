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
SET search_path TO 'public'
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
      'value_at_risk', 0, 'total_value', 0,
      'healthy_pct', 0, 'risk_pct', 0, 'critical_pct', 0, 'insalubrious_pct', 0
    ),
    'distribution', '[]'::jsonb,
    'pillars', jsonb_build_object(
      'integrity', 0, 'cadence', 0, 'stakeholders', 0,
      'winloss', 0, 'adherence', 0, 'evidence', 0
    ),
    'deals', '[]'::jsonb,
    'owners', '[]'::jsonb,
    'insights', '[]'::jsonb,
    'rules', '[]'::jsonb,
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

  WITH fo AS (
    SELECT
      o.id                                              AS opportunity_id,
      o.title                                           AS deal_name,
      o.owner_user_id                                   AS owner_user_id,
      o.stage_id                                        AS stage_id,
      o.account_id                                      AS account_id,
      COALESCE(o.valor_previsto, 0)::numeric            AS deal_amount,
      COALESCE(o.opportunity_score, 0)::int             AS opportunity_score,
      COALESCE(o.nrhs_score, 0)::int                    AS nrhs_score,
      o.nrhs_tier                                       AS nrhs_tier,
      o.nrhs_status                                     AS nrhs_status,
      COALESCE(o.nrhs_issues_count, 0)::int             AS nrhs_issues_count,
      COALESCE(o.nrhs_blockers, '[]'::jsonb)            AS nrhs_blockers,
      COALESCE(o.nrhs_data_integrity_score, 0)::int    AS pillar_integrity,
      COALESCE(o.nrhs_cadence_score, 0)::int           AS pillar_cadence,
      COALESCE(o.nrhs_stakeholders_score, 0)::int      AS pillar_stakeholders,
      COALESCE(o.nrhs_win_loss_score, 0)::int          AS pillar_winloss,
      COALESCE(o.nrhs_process_adherence_score, 0)::int AS pillar_adherence,
      COALESCE(o.nrhs_evidence_score, 0)::int          AS pillar_evidence,
      o.nrhs_last_calculated_at                         AS last_reviewed_at,
      o.created_at                                      AS created_at,
      CASE
        WHEN COALESCE(o.nrhs_score, 0) >= 90 THEN 'elite'
        WHEN COALESCE(o.nrhs_score, 0) >= 75 THEN 'healthy'
        WHEN COALESCE(o.nrhs_score, 0) >= 60 THEN 'risk'
        WHEN COALESCE(o.nrhs_score, 0) >= 40 THEN 'critical'
        ELSE 'insalubrious'
      END                                               AS tier_bucket
    FROM public.opportunities o
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND COALESCE(o.status, 'open') NOT IN ('won','lost','disqualified')
      AND (v_effective_owner IS NULL OR o.owner_user_id = v_effective_owner)
  ),
  summary AS (
    SELECT
      COUNT(*)::int                                                AS total_count,
      COALESCE(ROUND(AVG(fo.nrhs_score))::int, 0)                  AS nrhs_avg,
      COUNT(*) FILTER (WHERE fo.tier_bucket = 'elite')::int        AS elite_count,
      COUNT(*) FILTER (WHERE fo.tier_bucket = 'healthy')::int      AS healthy_count,
      COUNT(*) FILTER (WHERE fo.tier_bucket = 'risk')::int         AS risk_count,
      COUNT(*) FILTER (WHERE fo.tier_bucket = 'critical')::int     AS critical_count,
      COUNT(*) FILTER (WHERE fo.tier_bucket = 'insalubrious')::int AS insalubrious_count,
      COALESCE(SUM(fo.deal_amount), 0)::numeric                    AS total_amount,
      COALESCE(SUM(fo.deal_amount) FILTER (
        WHERE fo.tier_bucket IN ('risk','critical','insalubrious')
      ), 0)::numeric                                               AS value_at_risk_amount
    FROM fo
  ),
  dist AS (
    SELECT
      fo.tier_bucket                            AS tier,
      COUNT(*)::int                             AS tier_count,
      COALESCE(SUM(fo.deal_amount), 0)::numeric AS tier_amount
    FROM fo
    GROUP BY fo.tier_bucket
  ),
  pillars AS (
    SELECT jsonb_build_object(
      'integrity',    COALESCE(ROUND(AVG(fo.pillar_integrity) / 25.0 * 100)::int, 0),
      'cadence',      COALESCE(ROUND(AVG(fo.pillar_cadence) / 20.0 * 100)::int, 0),
      'stakeholders', COALESCE(ROUND(AVG(fo.pillar_stakeholders) / 20.0 * 100)::int, 0),
      'winloss',      COALESCE(ROUND(AVG(fo.pillar_winloss) / 15.0 * 100)::int, 0),
      'adherence',    COALESCE(ROUND(AVG(fo.pillar_adherence) / 10.0 * 100)::int, 0),
      'evidence',     COALESCE(ROUND(AVG(fo.pillar_evidence) / 10.0 * 100)::int, 0)
    ) AS pillars_json
    FROM fo
  ),
  deals AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',                fo.opportunity_id,
      'title',             fo.deal_name,
      'account_name',      CASE WHEN fo.account_id IS NULL THEN 'Conta não vinculada' ELSE 'Conta ' || left(fo.account_id::text, 8) END,
      'owner_user_id',     fo.owner_user_id,
      'owner_name',        CASE WHEN fo.owner_user_id IS NULL THEN 'Sem responsável' ELSE 'Usuário ' || left(fo.owner_user_id::text, 8) END,
      'value',             fo.deal_amount,
      'stage_id',          fo.stage_id,
      'stage_name',        CASE WHEN fo.stage_id IS NULL THEN 'Estágio não informado' ELSE 'Estágio ' || left(fo.stage_id::text, 8) END,
      'opportunity_score', fo.opportunity_score,
      'nrhs_score',        fo.nrhs_score,
      'nrhs_tier',         COALESCE(fo.nrhs_tier, fo.tier_bucket),
      'nrhs_status',       fo.nrhs_status,
      'nrhs_issues_count', fo.nrhs_issues_count,
      'nrhs_blockers',     fo.nrhs_blockers,
      'pillars', jsonb_build_object(
        'integrity',    fo.pillar_integrity,
        'cadence',      fo.pillar_cadence,
        'stakeholders', fo.pillar_stakeholders,
        'winloss',      fo.pillar_winloss,
        'adherence',    fo.pillar_adherence,
        'evidence',     fo.pillar_evidence
      ),
      'last_reviewed_at', fo.last_reviewed_at,
      'created_at',       fo.created_at
    ) ORDER BY fo.nrhs_score ASC), '[]'::jsonb) AS deals_json
    FROM fo
  ),
  owners_agg AS (
    SELECT
      fo.owner_user_id                                  AS owner_user_id,
      COUNT(*)::int                                     AS deal_count,
      ROUND(AVG(fo.nrhs_score))::int                    AS average_nrhs,
      CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE fo.tier_bucket IN ('elite','healthy'))::numeric / COUNT(*) * 100)::int ELSE 0 END AS healthy_percent,
      CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE fo.tier_bucket = 'insalubrious')::numeric / COUNT(*) * 100)::int ELSE 0 END AS insalubrious_percent,
      COALESCE(SUM(fo.deal_amount) FILTER (WHERE fo.tier_bucket IN ('risk','critical','insalubrious')), 0)::numeric AS owner_value_at_risk
    FROM fo
    GROUP BY fo.owner_user_id
  ),
  owners AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id',              oa.owner_user_id,
      'user_name',            CASE WHEN oa.owner_user_id IS NULL THEN 'Sem responsável' ELSE 'Usuário ' || left(oa.owner_user_id::text, 8) END,
      'avatar_url',           NULL,
      'deal_count',           oa.deal_count,
      'average_nrhs',         oa.average_nrhs,
      'healthy_percent',      oa.healthy_percent,
      'insalubrious_percent', oa.insalubrious_percent,
      'value_at_risk',        oa.owner_value_at_risk,
      'evolution_7d',         NULL
    ) ORDER BY oa.average_nrhs DESC NULLS LAST), '[]'::jsonb) AS owners_json
    FROM owners_agg oa
  ),
  distribution AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tier',  d.tier,
      'count', d.tier_count,
      'value', d.tier_amount
    )), '[]'::jsonb) AS distribution_json
    FROM dist d
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total',              s.total_count,
      'nrhs_avg',           s.nrhs_avg,
      'elite_count',        s.elite_count,
      'healthy_count',      s.healthy_count,
      'risk_count',         s.risk_count,
      'critical_count',     s.critical_count,
      'insalubrious_count', s.insalubrious_count,
      'value_at_risk',      s.value_at_risk_amount,
      'total_value',        s.total_amount,
      'healthy_pct',        CASE WHEN s.total_count > 0 THEN ROUND(s.healthy_count::numeric / s.total_count * 100)::int ELSE 0 END,
      'risk_pct',           CASE WHEN s.total_count > 0 THEN ROUND(s.risk_count::numeric / s.total_count * 100)::int ELSE 0 END,
      'critical_pct',       CASE WHEN s.total_count > 0 THEN ROUND(s.critical_count::numeric / s.total_count * 100)::int ELSE 0 END,
      'insalubrious_pct',   CASE WHEN s.total_count > 0 THEN ROUND(s.insalubrious_count::numeric / s.total_count * 100)::int ELSE 0 END
    ),
    'distribution', distribution.distribution_json,
    'pillars',      pillars.pillars_json,
    'deals',        deals.deals_json,
    'owners',       owners.owners_json,
    'insights',     '[]'::jsonb,
    'rules',        '[]'::jsonb,
    'generated_at', now()
  )
  INTO v_result
  FROM summary s, distribution, pillars, deals, owners;

  RETURN COALESCE(v_result, v_empty);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_nrhs_analytics(uuid, uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nrhs_analytics(uuid, uuid, boolean, uuid) TO authenticated;