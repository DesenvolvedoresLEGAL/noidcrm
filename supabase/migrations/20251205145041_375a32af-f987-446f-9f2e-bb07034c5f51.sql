
-- ========================================
-- SECURITY FIX: Add search_path to vulnerable functions
-- ========================================

-- Fix calculate_lead_grade function
CREATE OR REPLACE FUNCTION public.calculate_lead_grade(score integer)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN CASE
    WHEN score >= 80 THEN 'A'
    WHEN score >= 60 THEN 'B'
    WHEN score >= 40 THEN 'C'
    WHEN score >= 20 THEN 'D'
    ELSE 'F'
  END;
END;
$function$;

-- Fix update_proposal_layouts_updated_at function
CREATE OR REPLACE FUNCTION public.update_proposal_layouts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ========================================
-- SECURITY FIX: Recreate views with security_invoker = true
-- ========================================

-- 1. Drop and recreate closer_performance
DROP VIEW IF EXISTS public.closer_performance;
CREATE VIEW public.closer_performance WITH (security_invoker = true) AS
SELECT o.owner_user_id AS closer_user_id,
    p.full_name AS closer_name,
    o.organization_id,
    count(*) FILTER (WHERE (o.status = 'won'::text)) AS deals_won,
    count(*) FILTER (WHERE (o.status = 'lost'::text)) AS deals_lost,
    count(*) FILTER (WHERE ((o.status IS NULL) OR (o.status = 'open'::text))) AS deals_active,
    COALESCE(sum(o.valor_previsto) FILTER (WHERE (o.status = 'won'::text)), (0)::numeric) AS revenue_closed,
    COALESCE(sum(o.valor_previsto) FILTER (WHERE ((o.status IS NULL) OR (o.status = 'open'::text))), (0)::numeric) AS pipeline_value,
    COALESCE(avg(o.valor_previsto) FILTER (WHERE (o.status = 'won'::text)), (0)::numeric) AS avg_deal_size,
    CASE
        WHEN (count(*) FILTER (WHERE (o.status = ANY (ARRAY['won'::text, 'lost'::text]))) > 0) THEN round((((count(*) FILTER (WHERE (o.status = 'won'::text)))::numeric / (count(*) FILTER (WHERE (o.status = ANY (ARRAY['won'::text, 'lost'::text]))))::numeric) * (100)::numeric), 1)
        ELSE (0)::numeric
    END AS win_rate,
    COALESCE(avg((EXTRACT(epoch FROM (
        CASE
            WHEN (o.status = 'won'::text) THEN o.updated_at
            ELSE NULL::timestamp with time zone
        END - o.created_at)) / (86400)::numeric)) FILTER (WHERE (o.status = 'won'::text)), (0)::numeric) AS avg_sales_cycle_days
FROM ((opportunities o
  JOIN pipelines pl ON ((o.pipeline_id = pl.id)))
  LEFT JOIN profiles p ON ((o.owner_user_id = p.user_id)))
WHERE (pl.pipeline_type = 'sales'::text)
GROUP BY o.owner_user_id, p.full_name, o.organization_id;

-- 2. Drop and recreate handoff_metrics
DROP VIEW IF EXISTS public.handoff_metrics;
CREATE VIEW public.handoff_metrics WITH (security_invoker = true) AS
SELECT o.qualified_by_user_id AS sdr_user_id,
    sdr_profile.full_name AS sdr_name,
    o.owner_user_id AS closer_user_id,
    closer_profile.full_name AS closer_name,
    o.organization_id,
    count(*) AS total_handoffs,
    count(*) FILTER (WHERE (o.status = 'won'::text)) AS won_after_handoff,
    count(*) FILTER (WHERE (o.status = 'lost'::text)) AS lost_after_handoff,
    count(*) FILTER (WHERE ((o.status IS NULL) OR (o.status = 'open'::text))) AS active_after_handoff,
    COALESCE(sum(o.valor_previsto) FILTER (WHERE (o.status = 'won'::text)), (0)::numeric) AS revenue_from_handoffs,
    CASE
        WHEN (count(*) FILTER (WHERE (o.status = ANY (ARRAY['won'::text, 'lost'::text]))) > 0) THEN round((((count(*) FILTER (WHERE (o.status = 'won'::text)))::numeric / (count(*) FILTER (WHERE (o.status = ANY (ARRAY['won'::text, 'lost'::text]))))::numeric) * (100)::numeric), 1)
        ELSE (0)::numeric
    END AS handoff_win_rate,
    COALESCE(avg((EXTRACT(epoch FROM (o.qualified_at - o.created_at)) / (3600)::numeric)), (0)::numeric) AS avg_qualification_hours
FROM (((opportunities o
  JOIN pipelines p ON ((o.pipeline_id = p.id)))
  LEFT JOIN profiles sdr_profile ON ((o.qualified_by_user_id = sdr_profile.user_id)))
  LEFT JOIN profiles closer_profile ON ((o.owner_user_id = closer_profile.user_id)))
WHERE ((o.source_opportunity_id IS NOT NULL) AND (o.qualified_by_user_id IS NOT NULL) AND (p.pipeline_type = 'sales'::text))
GROUP BY o.qualified_by_user_id, sdr_profile.full_name, o.owner_user_id, closer_profile.full_name, o.organization_id;

-- 3. Drop and recreate pipeline_health
DROP VIEW IF EXISTS public.pipeline_health;
CREATE VIEW public.pipeline_health WITH (security_invoker = true) AS
SELECT p.id AS pipeline_id,
    p.name AS pipeline_name,
    s.id AS stage_id,
    s.name AS stage_name,
    s.order_index,
    s.probability,
    o.organization_id,
    count(DISTINCT o.id) AS deal_count,
    COALESCE(sum(o.valor_previsto), (0)::numeric) AS total_value,
    COALESCE(sum(((o.valor_previsto * (s.probability)::numeric) / 100.0)), (0)::numeric) AS weighted_value,
    COALESCE(avg(EXTRACT(day FROM (now() - o.created_at))), (0)::numeric) AS avg_age_days,
    count(DISTINCT CASE WHEN (o.days_since_contact > 30) THEN o.id ELSE NULL::uuid END) AS stale_deals,
    count(DISTINCT CASE WHEN (o.status = 'won'::text) THEN o.id ELSE NULL::uuid END) AS won_deals,
    count(DISTINCT CASE WHEN (o.status = 'lost'::text) THEN o.id ELSE NULL::uuid END) AS lost_deals
FROM ((pipelines p
  CROSS JOIN stages s)
  LEFT JOIN opportunities o ON (((o.pipeline_id = p.id) AND (o.stage_id = s.id))))
WHERE (p.id = s.pipeline_id)
GROUP BY p.id, p.name, s.id, s.name, s.order_index, s.probability, o.organization_id;

-- 4. Drop and recreate pipeline_metrics
DROP VIEW IF EXISTS public.pipeline_metrics;
CREATE VIEW public.pipeline_metrics WITH (security_invoker = true) AS
SELECT p.id AS pipeline_id,
    p.name AS pipeline_name,
    p.pipeline_type,
    p.organization_id,
    count(o.id) AS total_opportunities,
    count(CASE WHEN (o.status = 'won'::text) THEN 1 ELSE NULL::integer END) AS won_count,
    count(CASE WHEN (o.status = 'lost'::text) THEN 1 ELSE NULL::integer END) AS lost_count,
    count(CASE WHEN ((o.status IS NULL) OR (o.status <> ALL (ARRAY['won'::text, 'lost'::text]))) THEN 1 ELSE NULL::integer END) AS active_count,
    COALESCE(sum(o.valor_previsto), (0)::numeric) AS total_value,
    COALESCE(sum(CASE WHEN (o.status = 'won'::text) THEN o.valor_previsto ELSE (0)::numeric END), (0)::numeric) AS won_value,
    COALESCE(avg(CASE WHEN (o.status = 'won'::text) THEN o.valor_previsto ELSE NULL::numeric END), (0)::numeric) AS avg_won_value,
    round(CASE WHEN (count(CASE WHEN (o.status = ANY (ARRAY['won'::text, 'lost'::text])) THEN 1 ELSE NULL::integer END) > 0) 
          THEN (((count(CASE WHEN (o.status = 'won'::text) THEN 1 ELSE NULL::integer END))::numeric / (count(CASE WHEN (o.status = ANY (ARRAY['won'::text, 'lost'::text])) THEN 1 ELSE NULL::integer END))::numeric) * (100)::numeric)
          ELSE (0)::numeric END, 2) AS win_rate
FROM (pipelines p
  LEFT JOIN opportunities o ON ((o.pipeline_id = p.id)))
GROUP BY p.id, p.name, p.pipeline_type, p.organization_id;

-- 5. Drop and recreate sdr_performance
DROP VIEW IF EXISTS public.sdr_performance;
CREATE VIEW public.sdr_performance WITH (security_invoker = true) AS
SELECT o.qualified_by_user_id AS sdr_user_id,
    pr.full_name AS sdr_name,
    o.organization_id,
    count(DISTINCT o.id) AS total_sqls_generated,
    count(DISTINCT CASE WHEN (o.status = 'won'::text) THEN o.id ELSE NULL::uuid END) AS deals_won,
    count(DISTINCT CASE WHEN (o.status = 'lost'::text) THEN o.id ELSE NULL::uuid END) AS deals_lost,
    COALESCE(sum(CASE WHEN (o.status = 'won'::text) THEN o.valor_previsto ELSE (0)::numeric END), (0)::numeric) AS revenue_attributed,
    round(CASE WHEN (count(DISTINCT CASE WHEN (o.status = ANY (ARRAY['won'::text, 'lost'::text])) THEN o.id ELSE NULL::uuid END) > 0) 
          THEN (((count(DISTINCT CASE WHEN (o.status = 'won'::text) THEN o.id ELSE NULL::uuid END))::numeric / (count(DISTINCT CASE WHEN (o.status = ANY (ARRAY['won'::text, 'lost'::text])) THEN o.id ELSE NULL::uuid END))::numeric) * (100)::numeric)
          ELSE (0)::numeric END, 2) AS conversion_rate,
    (avg((EXTRACT(epoch FROM (o.qualified_at - source.created_at)) / (3600)::numeric)))::numeric(10,2) AS avg_qualification_hours
FROM ((opportunities o
  LEFT JOIN profiles pr ON ((pr.user_id = o.qualified_by_user_id)))
  LEFT JOIN opportunities source ON ((source.id = o.source_opportunity_id)))
WHERE (o.qualified_by_user_id IS NOT NULL)
GROUP BY o.qualified_by_user_id, pr.full_name, o.organization_id;

-- 6. Drop and recreate stage_conversion_metrics
DROP VIEW IF EXISTS public.stage_conversion_metrics;
CREATE VIEW public.stage_conversion_metrics WITH (security_invoker = true) AS
WITH stage_counts AS (
    SELECT p.id AS pipeline_id,
        p.name AS pipeline_name,
        p.pipeline_type,
        p.organization_id,
        s.id AS stage_id,
        s.name AS stage_name,
        s.order_index,
        count(DISTINCT o.id) AS opportunities_count,
        COALESCE(sum(o.valor_previsto), (0)::numeric) AS stage_value
    FROM ((pipelines p
      JOIN stages s ON ((s.pipeline_id = p.id)))
      LEFT JOIN opportunities o ON (((o.stage_id = s.id) AND (o.status IS NULL))))
    GROUP BY p.id, p.name, p.pipeline_type, p.organization_id, s.id, s.name, s.order_index
), stage_with_next AS (
    SELECT stage_counts.pipeline_id,
        stage_counts.pipeline_name,
        stage_counts.pipeline_type,
        stage_counts.organization_id,
        stage_counts.stage_id,
        stage_counts.stage_name,
        stage_counts.order_index,
        stage_counts.opportunities_count,
        stage_counts.stage_value,
        lead(stage_counts.opportunities_count) OVER (PARTITION BY stage_counts.pipeline_id ORDER BY stage_counts.order_index DESC) AS next_stage_count
    FROM stage_counts
)
SELECT pipeline_id,
    pipeline_name,
    pipeline_type,
    organization_id,
    stage_id,
    stage_name,
    order_index,
    opportunities_count,
    stage_value,
    CASE WHEN ((opportunities_count > 0) AND (next_stage_count IS NOT NULL)) THEN round((((next_stage_count)::numeric / (opportunities_count)::numeric) * (100)::numeric), 1) ELSE NULL::numeric END AS conversion_rate_to_next
FROM stage_with_next
ORDER BY pipeline_id, order_index;

-- 7. Drop and recreate unified_timeline
DROP VIEW IF EXISTS public.unified_timeline;
CREATE VIEW public.unified_timeline WITH (security_invoker = true) AS
SELECT 'activity'::text AS type,
    a.id,
    a.scheduled_date AS "timestamp",
    a.title,
    a.type AS activity_type,
    a.owner_user_id,
    a.opportunity_id,
    a.account_id,
    a.contact_id,
    a.organization_id,
    NULL::text AS metadata_type,
    jsonb_build_object('status', a.status, 'description', a.description) AS metadata
FROM activities a
UNION ALL
SELECT 'note'::text AS type,
    n.id,
    n.created_at AS "timestamp",
    'Nota adicionada'::text AS title,
    'note'::text AS activity_type,
    NULL::uuid AS owner_user_id,
    n.opportunity_id,
    NULL::uuid AS account_id,
    NULL::uuid AS contact_id,
    n.organization_id,
    NULL::text AS metadata_type,
    jsonb_build_object('content', n.content) AS metadata
FROM opportunity_notes n
UNION ALL
SELECT 'email'::text AS type,
    e.id,
    e.sent_at AS "timestamp",
    e.subject AS title,
    'email'::text AS activity_type,
    NULL::uuid AS owner_user_id,
    e.opportunity_id,
    NULL::uuid AS account_id,
    NULL::uuid AS contact_id,
    e.organization_id,
    NULL::text AS metadata_type,
    jsonb_build_object('sent_at', e.sent_at) AS metadata
FROM opportunity_emails e
UNION ALL
SELECT 'audit'::text AS type,
    al.id,
    al.created_at AS "timestamp",
    al.action AS title,
    'audit'::text AS activity_type,
    al.actor_user_id AS owner_user_id,
    CASE WHEN (al.entity_type = 'opportunity'::text) THEN al.entity_id ELSE NULL::uuid END AS opportunity_id,
    CASE WHEN (al.entity_type = 'account'::text) THEN al.entity_id ELSE NULL::uuid END AS account_id,
    CASE WHEN (al.entity_type = 'contact'::text) THEN al.entity_id ELSE NULL::uuid END AS contact_id,
    al.organization_id,
    al.entity_type AS metadata_type,
    jsonb_build_object('field_name', al.field_name, 'action', al.action) AS metadata
FROM audit_log al;
