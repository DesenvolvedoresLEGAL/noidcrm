-- =====================================================
-- PLAYBOOK ADAPTIVE SYSTEM WITH ROI & VERSIONING
-- =====================================================

-- 1. EXTEND ai_playbooks TABLE
ALTER TABLE ai_playbooks 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_version_id UUID,
ADD COLUMN IF NOT EXISTS roi_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue_generated NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_cycle_time_days NUMERIC,
ADD COLUMN IF NOT EXISTS auto_disabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS disabled_reason TEXT,
ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS min_sample_size INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS roi_threshold NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS complexity TEXT DEFAULT 'moderate',
ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC DEFAULT 2;

-- 2. CREATE playbook_versions TABLE
CREATE TABLE IF NOT EXISTS playbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES ai_playbooks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_label TEXT,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  trigger_conditions JSONB DEFAULT '{}',
  target_persona TEXT,
  target_stage TEXT,
  success_metrics JSONB,
  executions_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  avg_deal_value NUMERIC DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  avg_cycle_days NUMERIC,
  roi_score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_by UUID,
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playbook_id, version_number)
);

-- 3. EXTEND playbook_executions TABLE
ALTER TABLE playbook_executions
ADD COLUMN IF NOT EXISTS playbook_version_id UUID REFERENCES playbook_versions(id),
ADD COLUMN IF NOT EXISTS version_number INTEGER,
ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS revenue_generated NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_hours NUMERIC,
ADD COLUMN IF NOT EXISTS roi_value NUMERIC,
ADD COLUMN IF NOT EXISTS cycle_time_days NUMERIC,
ADD COLUMN IF NOT EXISTS effectiveness_rating INTEGER,
ADD COLUMN IF NOT EXISTS feedback TEXT,
ADD COLUMN IF NOT EXISTS deal_snapshot JSONB;

-- 4. CREATE playbook_metrics VIEW
CREATE OR REPLACE VIEW playbook_metrics AS
SELECT 
  p.id as playbook_id,
  p.organization_id,
  p.name,
  p.category,
  p.version,
  p.is_active,
  p.auto_disabled,
  p.estimated_hours,
  p.roi_threshold,
  p.min_sample_size,
  COUNT(e.id) as total_executions,
  COUNT(CASE WHEN e.outcome = 'success' THEN 1 END) as successful_executions,
  COUNT(CASE WHEN e.converted THEN 1 END) as converted_deals,
  ROUND(
    COUNT(CASE WHEN e.converted THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(e.id), 0) * 100, 2
  ) as calc_conversion_rate,
  SUM(COALESCE(e.revenue_generated, 0)) as total_revenue,
  SUM(COALESCE(e.cost_hours, 0)) as total_hours,
  ROUND(
    SUM(COALESCE(e.revenue_generated, 0)) / 
    NULLIF(SUM(COALESCE(e.cost_hours, 0)), 0), 2
  ) as roi_per_hour,
  ROUND(AVG(e.cycle_time_days), 1) as avg_cycle_days,
  ROUND(AVG(e.effectiveness_rating), 2) as avg_rating,
  COUNT(CASE WHEN e.started_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_executions,
  COUNT(CASE WHEN e.started_at >= NOW() - INTERVAL '30 days' AND e.converted THEN 1 END) as recent_conversions
FROM ai_playbooks p
LEFT JOIN playbook_executions e ON e.playbook_id = p.id
GROUP BY p.id, p.organization_id, p.name, p.category, p.version, p.is_active, 
         p.auto_disabled, p.estimated_hours, p.roi_threshold, p.min_sample_size;

-- 5. DEPLOY PLAYBOOK VERSION FUNCTION
CREATE OR REPLACE FUNCTION deploy_playbook_version(
  p_playbook_id UUID,
  p_version_label TEXT DEFAULT NULL,
  p_deployed_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_playbook RECORD;
  v_new_version_id UUID;
  v_new_version_number INTEGER;
BEGIN
  SELECT * INTO v_playbook FROM ai_playbooks WHERE id = p_playbook_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Playbook not found';
  END IF;
  
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_new_version_number 
  FROM playbook_versions 
  WHERE playbook_id = p_playbook_id;
  
  INSERT INTO playbook_versions (
    organization_id, playbook_id, version_number, version_label,
    name, description, steps, trigger_conditions,
    target_persona, target_stage, success_metrics,
    deployed_by
  ) VALUES (
    v_playbook.organization_id, p_playbook_id, v_new_version_number, 
    COALESCE(p_version_label, 'v' || v_new_version_number),
    v_playbook.name, v_playbook.description, v_playbook.steps,
    v_playbook.trigger_conditions, v_playbook.target_persona,
    v_playbook.target_stage, v_playbook.success_metrics,
    p_deployed_by
  ) RETURNING id INTO v_new_version_id;
  
  UPDATE ai_playbooks 
  SET version = v_new_version_number,
      current_version_id = v_new_version_id,
      updated_at = NOW()
  WHERE id = p_playbook_id;
  
  RETURN v_new_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. ROLLBACK PLAYBOOK VERSION FUNCTION
CREATE OR REPLACE FUNCTION rollback_playbook_version(
  p_playbook_id UUID,
  p_target_version_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_target_version RECORD;
BEGIN
  SELECT * INTO v_target_version 
  FROM playbook_versions 
  WHERE id = p_target_version_id AND playbook_id = p_playbook_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found';
  END IF;
  
  UPDATE playbook_versions 
  SET status = 'rolled_back',
      rolled_back_at = NOW(),
      rollback_reason = p_reason
  WHERE playbook_id = p_playbook_id 
    AND status = 'active'
    AND id != p_target_version_id;
  
  UPDATE ai_playbooks SET
    name = v_target_version.name,
    description = v_target_version.description,
    steps = v_target_version.steps,
    trigger_conditions = v_target_version.trigger_conditions,
    target_persona = v_target_version.target_persona,
    target_stage = v_target_version.target_stage,
    success_metrics = v_target_version.success_metrics,
    version = v_target_version.version_number,
    current_version_id = v_target_version.id,
    auto_disabled = FALSE,
    disabled_reason = NULL,
    updated_at = NOW()
  WHERE id = p_playbook_id;
  
  UPDATE playbook_versions 
  SET status = 'active' 
  WHERE id = p_target_version_id;
  
  RETURN p_playbook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. CHECK PLAYBOOK PERFORMANCE FUNCTION (for trigger)
CREATE OR REPLACE FUNCTION check_playbook_performance() RETURNS TRIGGER AS $$
DECLARE
  v_playbook RECORD;
  v_metrics RECORD;
  v_roi NUMERIC;
  v_conversion NUMERIC;
BEGIN
  SELECT * INTO v_playbook FROM ai_playbooks WHERE id = NEW.playbook_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN converted THEN 1 END) as converted,
    COALESCE(SUM(revenue_generated), 0) as revenue,
    COALESCE(SUM(cost_hours), 0) as hours
  INTO v_metrics
  FROM playbook_executions 
  WHERE playbook_id = NEW.playbook_id 
    AND started_at >= NOW() - INTERVAL '90 days';
  
  IF v_metrics.total >= v_playbook.min_sample_size THEN
    v_roi := v_metrics.revenue / NULLIF(v_metrics.hours, 0);
    v_conversion := v_metrics.converted::NUMERIC / v_metrics.total;
    
    IF v_roi IS NOT NULL AND v_roi < v_playbook.roi_threshold AND NOT v_playbook.auto_disabled THEN
      UPDATE ai_playbooks SET
        auto_disabled = TRUE,
        is_active = FALSE,
        disabled_reason = format(
          'ROI de %.2f está abaixo do threshold %.2f (baseado em %s execuções)',
          v_roi, v_playbook.roi_threshold, v_metrics.total
        ),
        disabled_at = NOW()
      WHERE id = NEW.playbook_id;
      
      INSERT INTO system_events (
        organization_id, event_type, event_category, entity_type, entity_id,
        actor_type, payload
      ) VALUES (
        v_playbook.organization_id, 'playbook_auto_disabled', 'automation',
        'playbook', NEW.playbook_id, 'system',
        jsonb_build_object(
          'roi', v_roi, 'threshold', v_playbook.roi_threshold,
          'executions', v_metrics.total, 'reason', 'low_roi'
        )
      );
    END IF;
    
    UPDATE ai_playbooks SET
      roi_score = COALESCE(v_roi, 0),
      conversion_rate = COALESCE(v_conversion * 100, 0),
      total_revenue_generated = v_metrics.revenue,
      total_cost_hours = v_metrics.hours,
      usage_count = v_metrics.total
    WHERE id = NEW.playbook_id;
    
    IF v_playbook.current_version_id IS NOT NULL THEN
      UPDATE playbook_versions SET
        executions_count = v_metrics.total,
        success_count = v_metrics.converted,
        conversion_rate = COALESCE(v_conversion * 100, 0),
        total_revenue = v_metrics.revenue,
        roi_score = COALESCE(v_roi, 0)
      WHERE id = v_playbook.current_version_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. CREATE TRIGGER FOR AUTO-PERFORMANCE CHECK
DROP TRIGGER IF EXISTS trigger_check_playbook_performance ON playbook_executions;
CREATE TRIGGER trigger_check_playbook_performance
  AFTER INSERT OR UPDATE ON playbook_executions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION check_playbook_performance();

-- 9. RLS POLICIES FOR playbook_versions
ALTER TABLE playbook_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org playbook_versions"
  ON playbook_versions FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org playbook_versions"
  ON playbook_versions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org playbook_versions"
  ON playbook_versions FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete playbook_versions"
  ON playbook_versions FOR DELETE
  USING (user_is_org_admin(organization_id));

-- 10. INDEX FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_playbook_versions_playbook_id ON playbook_versions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_versions_status ON playbook_versions(status);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_converted ON playbook_executions(converted);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_playbook_version ON playbook_executions(playbook_version_id);
CREATE INDEX IF NOT EXISTS idx_ai_playbooks_category ON ai_playbooks(category);
CREATE INDEX IF NOT EXISTS idx_ai_playbooks_auto_disabled ON ai_playbooks(auto_disabled);