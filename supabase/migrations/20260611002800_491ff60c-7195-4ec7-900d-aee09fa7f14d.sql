DROP VIEW IF EXISTS public.v_user_display_resolver_v2 CASCADE;
CREATE VIEW public.v_user_display_resolver_v2
WITH (security_invoker = true) AS
SELECT
  p.user_id,
  p.organization_id,
  CASE
    WHEN om.id IS NULL THEN COALESCE(NULLIF(TRIM(p.full_name), ''), 'Usuário removido') || ' (removido)'
    WHEN om.deleted_at IS NOT NULL THEN COALESCE(NULLIF(TRIM(p.full_name), ''), 'Usuário removido') || ' (removido)'
    WHEN lower(COALESCE(om.status, 'active')) <> 'active'
      THEN COALESCE(NULLIF(TRIM(p.full_name), ''), 'Usuário removido') || ' (inativo)'
    ELSE COALESCE(NULLIF(TRIM(p.full_name), ''), 'Usuário sem nome')
  END AS display_name,
  COALESCE(NULLIF(TRIM(p.full_name), ''), 'Usuário sem nome') AS base_name,
  p.email,
  p.avatar_url,
  CASE
    WHEN om.id IS NULL THEN 'not_member'
    WHEN om.deleted_at IS NOT NULL THEN 'deleted'
    WHEN lower(COALESCE(om.status, 'active')) <> 'active' THEN lower(om.status)
    ELSE 'active'
  END AS user_status,
  (om.id IS NOT NULL AND om.deleted_at IS NULL AND lower(COALESCE(om.status, 'active')) = 'active') AS is_active,
  (om.id IS NULL OR om.deleted_at IS NOT NULL) AS is_deleted,
  'profiles+organization_members'::text AS resolved_from
FROM public.profiles p
LEFT JOIN public.organization_members om
  ON om.user_id = p.user_id AND om.organization_id = p.organization_id;

GRANT SELECT ON public.v_user_display_resolver_v2 TO authenticated;
GRANT SELECT ON public.v_user_display_resolver_v2 TO service_role;

COMMENT ON VIEW public.v_user_display_resolver_v2 IS
'Resolução canônica de nome de usuário. Substitui "Desconhecido". Sprint REL V2.11.';

DROP VIEW IF EXISTS public.v_report_qualification_quality_v2 CASCADE;
CREATE VIEW public.v_report_qualification_quality_v2
WITH (security_invoker = true) AS
WITH q AS (
  SELECT
    o.organization_id,
    o.opportunity_id,
    o.pipeline_id,
    o.pipeline_type,
    o.pipeline_is_primary,
    COALESCE(o.qualified_by_user_id, qh.qualified_by_user_id) AS sdr_user_id,
    COALESCE(o.first_qualification_at, qh.qualification_at) AS qualified_at,
    o.current_owner_user_id AS closer_user_id,
    o.status,
    o.has_any_commercial_proposal,
    o.has_accepted_proposal,
    o.closed_at, o.won_at, o.lost_at,
    o.consolidated_loss_reason_id,
    o.origem
  FROM public.v_reporting_opportunities_v2 o
  LEFT JOIN LATERAL (
    SELECT h.qualified_by_user_id, h.qualification_at
    FROM public.opportunity_qualification_history h
    WHERE h.opportunity_id = o.opportunity_id
    ORDER BY h.qualification_at ASC LIMIT 1
  ) qh ON TRUE
  WHERE COALESCE(o.first_qualification_at, qh.qualification_at) IS NOT NULL
     OR COALESCE(o.qualified_by_user_id, qh.qualified_by_user_id) IS NOT NULL
),
prop AS (
  SELECT pr.opportunity_id, true AS has_proposal,
         MIN(pr.created_at) AS first_proposal_at,
         MAX(pr.status::text) AS any_proposal_status,
         MAX(pr.proposal_number::text) AS sample_proposal_number
  FROM public.proposals pr
  WHERE pr.opportunity_id IS NOT NULL
  GROUP BY pr.opportunity_id
),
revenue AS (
  SELECT COALESCE(cwr.opportunity_id, cwr.operational_opportunity_id) AS opportunity_id,
         SUM(COALESCE(cwr.valid_revenue_amount, 0)) AS valid_revenue_amount,
         bool_or(COALESCE(cwr.is_cancelled_sale, false)) AS has_cancelled_sale
  FROM public.commercial_won_revenue_view cwr
  GROUP BY COALESCE(cwr.opportunity_id, cwr.operational_opportunity_id)
),
opp_meta AS (
  SELECT o.id AS opportunity_id, o.title AS opportunity_title, o.account_id,
         COALESCE(NULLIF(a.nome_fantasia,''), NULLIF(a.razao_social,''), o.title) AS account_name
  FROM public.opportunities o
  LEFT JOIN public.accounts a ON a.id = o.account_id
)
SELECT
  q.organization_id, q.opportunity_id, om.opportunity_title, om.account_id, om.account_name,
  q.pipeline_id, q.pipeline_type, q.pipeline_is_primary,
  q.sdr_user_id, q.qualified_at, q.closer_user_id,
  q.status, q.closed_at, q.won_at, q.lost_at, q.origem,
  COALESCE(p.has_proposal, q.has_any_commercial_proposal, false) AS has_proposal,
  p.first_proposal_at, p.any_proposal_status AS proposal_status,
  p.sample_proposal_number AS proposal_number,
  q.has_accepted_proposal,
  COALESCE(r.valid_revenue_amount, 0) AS valid_revenue_amount,
  COALESCE(r.has_cancelled_sale, false) AS has_cancelled_sale,
  lr.name AS loss_reason_name,
  lr.category AS loss_reason_category,
  CASE WHEN p.first_proposal_at IS NOT NULL AND q.qualified_at IS NOT NULL
       THEN EXTRACT(EPOCH FROM (p.first_proposal_at - q.qualified_at))/3600.0 END AS hours_qualification_to_proposal,
  CASE WHEN q.closed_at IS NOT NULL AND q.qualified_at IS NOT NULL
       THEN EXTRACT(EPOCH FROM (q.closed_at - q.qualified_at))/86400.0 END AS days_qualification_to_close,
  CASE WHEN q.qualified_at IS NOT NULL
       THEN EXTRACT(EPOCH FROM (now() - q.qualified_at))/86400.0 END AS days_since_qualification
FROM q
LEFT JOIN prop p ON p.opportunity_id = q.opportunity_id
LEFT JOIN revenue r ON r.opportunity_id = q.opportunity_id
LEFT JOIN opp_meta om ON om.opportunity_id = q.opportunity_id
LEFT JOIN public.loss_reasons lr ON lr.id = q.consolidated_loss_reason_id;

GRANT SELECT ON public.v_report_qualification_quality_v2 TO authenticated;
GRANT SELECT ON public.v_report_qualification_quality_v2 TO service_role;

COMMENT ON VIEW public.v_report_qualification_quality_v2 IS
'Detalhe por SQL (oportunidade qualificada). Receita usa valid_revenue_amount (líquido). Sprint REL V2.11.';