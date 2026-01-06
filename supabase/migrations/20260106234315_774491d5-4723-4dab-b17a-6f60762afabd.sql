-- MIGRAÇÃO 4: Views com SECURITY INVOKER e Triggers de Auditoria

-- =====================================================
-- 4.1 RECRIAR VIEWS COM SECURITY INVOKER
-- =====================================================

-- Drop e recriar pipeline_health
DROP VIEW IF EXISTS pipeline_health;
CREATE VIEW pipeline_health WITH (security_invoker = true) AS
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

-- Drop e recriar pipeline_metrics
DROP VIEW IF EXISTS pipeline_metrics;
CREATE VIEW pipeline_metrics WITH (security_invoker = true) AS
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
        THEN (((count(CASE WHEN (o.status = 'won'::text) THEN 1 ELSE NULL::integer END))::numeric / 
            (count(CASE WHEN (o.status = ANY (ARRAY['won'::text, 'lost'::text])) THEN 1 ELSE NULL::integer END))::numeric) * (100)::numeric)
        ELSE (0)::numeric END, 2) AS win_rate
FROM (pipelines p LEFT JOIN opportunities o ON ((o.pipeline_id = p.id)))
GROUP BY p.id, p.name, p.pipeline_type, p.organization_id;

-- Drop e recriar stage_conversion_metrics
DROP VIEW IF EXISTS stage_conversion_metrics;
CREATE VIEW stage_conversion_metrics WITH (security_invoker = true) AS
SELECT s.id AS stage_id,
    s.name AS stage_name,
    s.order_index,
    s.pipeline_id,
    p.name AS pipeline_name,
    p.organization_id,
    count(o.id) AS total_opportunities,
    count(CASE WHEN (o.status = 'won') THEN 1 ELSE NULL END) AS won_count,
    count(CASE WHEN (o.status = 'lost') THEN 1 ELSE NULL END) AS lost_count,
    COALESCE(sum(o.valor_previsto), 0) AS total_value,
    COALESCE(avg(EXTRACT(day FROM (now() - o.created_at))), 0) AS avg_days_in_stage
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
LEFT JOIN opportunities o ON o.stage_id = s.id
GROUP BY s.id, s.name, s.order_index, s.pipeline_id, p.name, p.organization_id;

-- Drop e recriar playbook_metrics
DROP VIEW IF EXISTS playbook_metrics;
CREATE VIEW playbook_metrics WITH (security_invoker = true) AS
SELECT p.id AS playbook_id,
    p.organization_id,
    p.name,
    p.category,
    p.version,
    p.is_active,
    p.auto_disabled,
    p.estimated_hours,
    p.roi_threshold,
    p.min_sample_size,
    count(e.id) AS total_executions,
    count(CASE WHEN (e.outcome = 'success'::text) THEN 1 ELSE NULL::integer END) AS successful_executions,
    count(CASE WHEN e.converted THEN 1 ELSE NULL::integer END) AS converted_deals,
    round((((count(CASE WHEN e.converted THEN 1 ELSE NULL::integer END))::numeric / (NULLIF(count(e.id), 0))::numeric) * (100)::numeric), 2) AS calc_conversion_rate,
    sum(COALESCE(e.revenue_generated, (0)::numeric)) AS total_revenue,
    sum(COALESCE(e.cost_hours, (0)::numeric)) AS total_hours,
    round((sum(COALESCE(e.revenue_generated, (0)::numeric)) / NULLIF(sum(COALESCE(e.cost_hours, (0)::numeric)), (0)::numeric)), 2) AS roi_per_hour,
    round(avg(e.cycle_time_days), 1) AS avg_cycle_days,
    round(avg(e.effectiveness_rating), 2) AS avg_rating,
    count(CASE WHEN (e.started_at >= (now() - '30 days'::interval)) THEN 1 ELSE NULL::integer END) AS recent_executions,
    count(CASE WHEN ((e.started_at >= (now() - '30 days'::interval)) AND e.converted) THEN 1 ELSE NULL::integer END) AS recent_conversions
FROM ai_playbooks p
LEFT JOIN playbook_executions e ON e.playbook_id = p.id
GROUP BY p.id, p.organization_id, p.name, p.category, p.version, p.is_active, p.auto_disabled, p.estimated_hours, p.roi_threshold, p.min_sample_size;

-- =====================================================
-- 4.2 TRIGGER PARA BLOQUEAR NOMES OFENSIVOS
-- =====================================================

CREATE OR REPLACE FUNCTION block_offensive_names()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offensive_words text[] := ARRAY['LOL', 'BASTARD', 'XD', 'CASH', 'FIREWALL', 'ROBLOX', 'BROO', 'FEE', 'COSTUMER'];
  word text;
  name_to_check text;
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    name_to_check := NEW.name;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    name_to_check := NEW.full_name;
  END IF;
  
  IF name_to_check IS NOT NULL THEN
    FOREACH word IN ARRAY offensive_words LOOP
      IF name_to_check ILIKE '%' || word || '%' THEN
        RAISE EXCEPTION 'Nome contem palavra nao permitida: %', word;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar triggers
DROP TRIGGER IF EXISTS trg_block_offensive_org_names ON organizations;
CREATE TRIGGER trg_block_offensive_org_names
BEFORE INSERT OR UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION block_offensive_names();

DROP TRIGGER IF EXISTS trg_block_offensive_profile_names ON profiles;
CREATE TRIGGER trg_block_offensive_profile_names
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION block_offensive_names();

-- =====================================================
-- 4.3 TRIGGER DE AUDITORIA PARA ORGANIZATIONS
-- =====================================================

CREATE OR REPLACE FUNCTION audit_organization_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP,
    'organization',
    COALESCE(NEW.id, OLD.id)::text,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_organizations ON organizations;
CREATE TRIGGER trg_audit_organizations
AFTER INSERT OR UPDATE OR DELETE ON organizations
FOR EACH ROW EXECUTE FUNCTION audit_organization_changes();