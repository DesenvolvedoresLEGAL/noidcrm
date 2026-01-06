-- MIGRAÇÃO 5 CORRIGIDA: Views restantes

-- =====================================================
-- 5.1 RECRIAR stage_conversion_metrics com campos corretos
-- =====================================================
DROP VIEW IF EXISTS stage_conversion_metrics;
CREATE VIEW stage_conversion_metrics WITH (security_invoker = true) AS
SELECT 
    s.id AS stage_id,
    s.name AS stage_name,
    s.order_index,
    s.pipeline_id,
    p.name AS pipeline_name,
    p.pipeline_type,
    p.organization_id,
    count(o.id) AS total_opportunities,
    count(o.id) AS opportunities_count,
    count(CASE WHEN (o.status = 'won') THEN 1 ELSE NULL END) AS won_count,
    count(CASE WHEN (o.status = 'lost') THEN 1 ELSE NULL END) AS lost_count,
    COALESCE(sum(o.valor_previsto), 0) AS total_value,
    COALESCE(sum(o.valor_previsto), 0) AS stage_value,
    COALESCE(avg(EXTRACT(day FROM (now() - o.created_at))), 0) AS avg_days_in_stage,
    NULL::numeric AS conversion_rate_to_next
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
LEFT JOIN opportunities o ON o.stage_id = s.id
GROUP BY s.id, s.name, s.order_index, s.pipeline_id, p.name, p.pipeline_type, p.organization_id;

-- =====================================================
-- 5.2 RECRIAR v_mrr_by_account COM SECURITY INVOKER
-- =====================================================
DROP VIEW IF EXISTS v_mrr_by_account;
CREATE VIEW v_mrr_by_account WITH (security_invoker = true) AS
WITH sales_pipelines AS (
    SELECT pipelines.id, pipelines.organization_id
    FROM pipelines
    WHERE (pipelines.pipeline_type = 'sales'::text)
), won_sales_opportunities AS (
    SELECT o.id, o.account_id, o.organization_id
    FROM (opportunities o
        JOIN sales_pipelines sp ON ((o.pipeline_id = sp.id)))
    WHERE ((o.status = 'won'::text) AND (o.account_id IS NOT NULL))
), accepted_proposals AS (
    SELECT p.id, p.opportunity_id, p.organization_id
    FROM (proposals p
        JOIN won_sales_opportunities wso ON ((p.opportunity_id = wso.id)))
    WHERE (p.status = 'accepted'::text)
), recurring_terms AS (
    SELECT ap.opportunity_id, ap.organization_id,
        COALESCE(sum(ppt.monthly_value), (0)::numeric) AS mrr_value
    FROM (accepted_proposals ap
        JOIN proposal_payment_terms ppt ON ((ppt.proposal_id = ap.id)))
    WHERE (ppt.payment_type = ANY (ARRAY['recurring'::text, 'monthly'::text, 'subscription'::text]))
    GROUP BY ap.opportunity_id, ap.organization_id
), mrr_with_account AS (
    SELECT wso.account_id, wso.organization_id, rt.mrr_value
    FROM (recurring_terms rt
        JOIN won_sales_opportunities wso ON ((rt.opportunity_id = wso.id)))
)
SELECT account_id, organization_id, max(mrr_value) AS mrr_value
FROM mrr_with_account
GROUP BY account_id, organization_id;

-- =====================================================
-- 5.3 RECRIAR unified_timeline COM SECURITY INVOKER
-- =====================================================
DROP VIEW IF EXISTS unified_timeline;
CREATE VIEW unified_timeline WITH (security_invoker = true) AS
SELECT 'activity'::text AS type,
    a.id,
    COALESCE(a.completed_at, a.scheduled_date, a.created_at) AS "timestamp",
    a.title,
    a.type AS activity_type,
    a.owner_user_id,
    a.opportunity_id,
    a.account_id,
    a.contact_id,
    a.organization_id,
    a.deleted_at,
    jsonb_build_object('status', a.status, 'description', a.description, 'duration_minutes', a.duration_minutes, 'is_automated', a.is_automated, 'ai_generated', a.ai_generated, 'sentiment', a.sentiment, 'scheduled_date', a.scheduled_date, 'completed_at', a.completed_at) AS metadata
FROM activities a
WHERE (a.opportunity_id IS NOT NULL)
UNION ALL
SELECT 'note'::text AS type,
    n.id,
    n.created_at AS "timestamp",
    'Nota adicionada'::text AS title,
    'note'::text AS activity_type,
    n.created_by AS owner_user_id,
    n.opportunity_id,
    NULL::uuid AS account_id,
    NULL::uuid AS contact_id,
    n.organization_id,
    NULL::timestamp with time zone AS deleted_at,
    jsonb_build_object('content', n.content) AS metadata
FROM opportunity_notes n
UNION ALL
SELECT 'email'::text AS type,
    e.id,
    e.sent_at AS "timestamp",
    e.subject AS title,
    'email'::text AS activity_type,
    e.sent_by AS owner_user_id,
    e.opportunity_id,
    NULL::uuid AS account_id,
    NULL::uuid AS contact_id,
    e.organization_id,
    NULL::timestamp with time zone AS deleted_at,
    jsonb_build_object('to_emails', e.to_emails, 'from_email', e.from_email, 'body', e.body, 'opened_at', e.opened_at, 'clicked_at', e.clicked_at) AS metadata
FROM opportunity_emails e
UNION ALL
SELECT 'audit'::text AS type,
    al.id,
    al.created_at AS "timestamp",
    al.action AS title,
    al.action AS activity_type,
    al.actor_user_id AS owner_user_id,
    al.entity_id AS opportunity_id,
    NULL::uuid AS account_id,
    NULL::uuid AS contact_id,
    al.organization_id,
    NULL::timestamp with time zone AS deleted_at,
    jsonb_build_object('entity_type', al.entity_type, 'field_name', al.field_name, 'old_value', al.old_value, 'new_value', al.new_value, 'metadata', al.metadata, 'trace_id', al.trace_id) AS metadata
FROM audit_log al
WHERE (al.entity_type = 'opportunity'::text)
UNION ALL
SELECT 'proposal'::text AS type,
    p.id,
    COALESCE(p.sent_at, p.created_at) AS "timestamp",
    p.title,
    CASE
        WHEN (p.accepted_at IS NOT NULL) THEN 'accepted'::text
        WHEN (p.viewed_at IS NOT NULL) THEN 'viewed'::text
        WHEN (p.sent_at IS NOT NULL) THEN 'sent'::text
        ELSE 'draft'::text
    END AS activity_type,
    NULL::uuid AS owner_user_id,
    p.opportunity_id,
    NULL::uuid AS account_id,
    NULL::uuid AS contact_id,
    p.organization_id,
    p.deleted_at,
    jsonb_build_object('status', p.status, 'value', p.value, 'expires_at', p.expires_at, 'sent_at', p.sent_at, 'viewed_at', p.viewed_at, 'accepted_at', p.accepted_at, 'declined_at', p.declined_at, 'client_name', p.client_name) AS metadata
FROM proposals p
WHERE (p.opportunity_id IS NOT NULL)
UNION ALL
SELECT 'file'::text AS type,
    f.id,
    f.created_at AS "timestamp",
    f.file_name AS title,
    'upload'::text AS activity_type,
    f.uploaded_by AS owner_user_id,
    f.opportunity_id,
    NULL::uuid AS account_id,
    NULL::uuid AS contact_id,
    f.organization_id,
    NULL::timestamp with time zone AS deleted_at,
    jsonb_build_object('file_size', f.file_size, 'file_type', f.file_type, 'storage_path', f.storage_path) AS metadata
FROM opportunity_files f
UNION ALL
SELECT 'automation'::text AS type,
    we.id,
    COALESCE(we.completed_at, we.started_at, we.created_at) AS "timestamp",
    COALESCE(wr.name, 'Automação executada'::text) AS title,
    (we.trigger_type)::text AS activity_type,
    NULL::uuid AS owner_user_id,
    we.opportunity_id,
    NULL::uuid AS account_id,
    NULL::uuid AS contact_id,
    we.organization_id,
    NULL::timestamp with time zone AS deleted_at,
    jsonb_build_object('workflow_rule_id', we.workflow_rule_id, 'status', we.status, 'trigger_type', we.trigger_type, 'actions_executed', we.actions_executed, 'error_message', we.error_message, 'started_at', we.started_at, 'completed_at', we.completed_at) AS metadata
FROM (workflow_executions we
    LEFT JOIN workflow_rules wr ON ((wr.id = we.workflow_rule_id)))
WHERE (we.opportunity_id IS NOT NULL)
UNION ALL
SELECT te.type,
    te.id,
    te."timestamp",
    te.title,
    te.activity_type,
    te.actor_user_id AS owner_user_id,
    te.opportunity_id,
    te.account_id,
    te.contact_id,
    te.organization_id,
    NULL::timestamp with time zone AS deleted_at,
    te.metadata
FROM timeline_events te
WHERE (te.opportunity_id IS NOT NULL);