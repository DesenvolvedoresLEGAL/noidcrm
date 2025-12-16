-- =============================================
-- FORECAST EXPLICÁVEL COM AUTO-REMEDIAÇÃO
-- =============================================

-- 1. Tabela de previsões para medir accuracy
CREATE TABLE public.forecast_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  
  -- Tipo de previsão
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('win_probability', 'close_date', 'value', 'health')),
  prediction_source TEXT NOT NULL CHECK (prediction_source IN ('ai_model', 'human', 'algorithmic')),
  model_version TEXT,
  
  -- Valores previstos
  predicted_value NUMERIC NOT NULL,
  confidence_level NUMERIC CHECK (confidence_level >= 0 AND confidence_level <= 1),
  confidence_interval_low NUMERIC,
  confidence_interval_high NUMERIC,
  
  -- Evidências explícitas (JSON array)
  evidence_factors JSONB NOT NULL DEFAULT '[]',
  
  -- Outcome (preenchido quando deal fecha)
  actual_value NUMERIC,
  was_accurate BOOLEAN,
  error_value NUMERIC,
  error_percentage NUMERIC,
  
  -- Contexto (TEXT para pipeline_id e stage_id conforme schema existente)
  pipeline_id TEXT,
  stage_id TEXT,
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  outcome_recorded_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de drivers explícitos do Health Score
CREATE TABLE public.health_score_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  
  -- Driver info
  driver_name TEXT NOT NULL,
  driver_category TEXT NOT NULL CHECK (driver_category IN ('engagement', 'velocity', 'relationship', 'behavior')),
  driver_source TEXT NOT NULL CHECK (driver_source IN ('graph', 'memory', 'behavior', 'activity', 'history')),
  
  -- Impact
  current_value NUMERIC NOT NULL,
  benchmark_value NUMERIC,
  impact_score NUMERIC NOT NULL CHECK (impact_score >= -100 AND impact_score <= 100),
  impact_direction TEXT NOT NULL CHECK (impact_direction IN ('positive', 'negative', 'neutral')),
  
  -- Evidence
  evidence_description TEXT NOT NULL,
  evidence_data JSONB,
  source_entity_type TEXT,
  source_entity_id UUID,
  
  -- Remediation link
  suggested_playbook_id UUID REFERENCES public.ai_playbooks(id),
  remediation_priority TEXT CHECK (remediation_priority IN ('critical', 'high', 'medium', 'low')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de triggers de auto-remediação
CREATE TABLE public.auto_remediation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Trigger config
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Conditions (JSON)
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  
  -- Action
  action_type TEXT NOT NULL CHECK (action_type IN ('execute_playbook', 'create_activity', 'notify', 'escalate')),
  playbook_id UUID REFERENCES public.ai_playbooks(id),
  action_config JSONB DEFAULT '{}',
  
  -- Cooldown
  cooldown_hours INTEGER DEFAULT 24,
  max_triggers_per_deal INTEGER DEFAULT 3,
  
  -- Stats
  trigger_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de execuções de auto-remediação
CREATE TABLE public.auto_remediation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_id UUID REFERENCES public.auto_remediation_triggers(id),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  
  -- Context at trigger
  health_score_at_trigger INTEGER,
  drivers_at_trigger JSONB,
  
  -- Execution
  playbook_id UUID REFERENCES public.ai_playbooks(id),
  playbook_execution_id UUID REFERENCES public.playbook_executions(id),
  status TEXT DEFAULT 'triggered' CHECK (status IN ('triggered', 'executing', 'completed', 'failed', 'skipped')),
  
  -- Outcome
  health_score_after INTEGER,
  outcome_status TEXT CHECK (outcome_status IN ('improved', 'unchanged', 'worsened', 'deal_won', 'deal_lost')),
  outcome_recorded_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.forecast_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_score_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_remediation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_remediation_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "forecast_predictions_select" ON public.forecast_predictions FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "forecast_predictions_insert" ON public.forecast_predictions FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "forecast_predictions_update" ON public.forecast_predictions FOR UPDATE
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "health_score_drivers_select" ON public.health_score_drivers FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "health_score_drivers_all" ON public.health_score_drivers FOR ALL
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "auto_remediation_triggers_admin" ON public.auto_remediation_triggers FOR ALL
  USING (organization_id = public.get_user_organization_id() AND public.is_admin_or_owner(auth.uid()));

CREATE POLICY "auto_remediation_triggers_select" ON public.auto_remediation_triggers FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "auto_remediation_executions_select" ON public.auto_remediation_executions FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "auto_remediation_executions_insert" ON public.auto_remediation_executions FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "auto_remediation_executions_update" ON public.auto_remediation_executions FOR UPDATE
  USING (organization_id = public.get_user_organization_id());

-- Indexes
CREATE INDEX idx_forecast_predictions_org ON public.forecast_predictions(organization_id);
CREATE INDEX idx_forecast_predictions_opp ON public.forecast_predictions(opportunity_id);
CREATE INDEX idx_forecast_predictions_type ON public.forecast_predictions(prediction_type, prediction_source);
CREATE INDEX idx_health_score_drivers_opp ON public.health_score_drivers(opportunity_id);
CREATE INDEX idx_health_score_drivers_category ON public.health_score_drivers(driver_category);
CREATE INDEX idx_auto_remediation_triggers_org ON public.auto_remediation_triggers(organization_id, is_active);
CREATE INDEX idx_auto_remediation_executions_opp ON public.auto_remediation_executions(opportunity_id);

-- VIEW para métricas de accuracy
CREATE OR REPLACE VIEW public.forecast_accuracy_metrics AS
SELECT 
  organization_id,
  prediction_type,
  prediction_source,
  COUNT(*) as total_predictions,
  COUNT(actual_value) as predictions_with_outcome,
  AVG(ABS(error_value)) as mean_absolute_error,
  AVG(ABS(error_percentage)) as mean_percentage_error,
  STDDEV(error_value) as error_std_dev,
  AVG(CASE WHEN confidence_level >= 0.8 THEN ABS(error_value) END) as mae_high_confidence,
  AVG(CASE WHEN confidence_level < 0.5 THEN ABS(error_value) END) as mae_low_confidence,
  COUNT(CASE WHEN prediction_source = 'ai_model' AND was_accurate THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(CASE WHEN prediction_source = 'ai_model' AND actual_value IS NOT NULL THEN 1 END), 0) * 100 as ai_accuracy_rate,
  COUNT(CASE WHEN prediction_source = 'human' AND was_accurate THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(CASE WHEN prediction_source = 'human' AND actual_value IS NOT NULL THEN 1 END), 0) * 100 as human_accuracy_rate,
  AVG(CASE WHEN predicted_at >= NOW() - INTERVAL '30 days' THEN ABS(error_value) END) as recent_mae
FROM public.forecast_predictions
GROUP BY organization_id, prediction_type, prediction_source;

-- Function para registrar outcome de forecast
CREATE OR REPLACE FUNCTION public.record_forecast_outcome()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('won', 'lost') AND OLD.status NOT IN ('won', 'lost') THEN
    UPDATE public.forecast_predictions
    SET 
      actual_value = CASE 
        WHEN prediction_type = 'win_probability' THEN 
          CASE WHEN NEW.status = 'won' THEN 100 ELSE 0 END
        WHEN prediction_type = 'value' THEN NEW.valor_previsto
        ELSE actual_value
      END,
      error_value = CASE 
        WHEN prediction_type = 'win_probability' THEN 
          predicted_value - (CASE WHEN NEW.status = 'won' THEN 100 ELSE 0 END)
        WHEN prediction_type = 'value' THEN 
          predicted_value - NEW.valor_previsto
        ELSE error_value
      END,
      error_percentage = CASE 
        WHEN prediction_type = 'win_probability' THEN 
          ABS(predicted_value - (CASE WHEN NEW.status = 'won' THEN 100 ELSE 0 END))
        WHEN prediction_type = 'value' AND NEW.valor_previsto > 0 THEN 
          ABS((predicted_value - NEW.valor_previsto) / NEW.valor_previsto * 100)
        ELSE error_percentage
      END,
      was_accurate = CASE 
        WHEN prediction_type = 'win_probability' THEN 
          (predicted_value >= 50 AND NEW.status = 'won') OR (predicted_value < 50 AND NEW.status = 'lost')
        WHEN prediction_type = 'value' AND NEW.valor_previsto > 0 THEN 
          ABS((predicted_value - NEW.valor_previsto) / NEW.valor_previsto * 100) <= 10
        ELSE was_accurate
      END,
      outcome_recorded_at = NOW()
    WHERE opportunity_id = NEW.id AND actual_value IS NULL;
    
    UPDATE public.auto_remediation_executions
    SET 
      outcome_status = CASE WHEN NEW.status = 'won' THEN 'deal_won' ELSE 'deal_lost' END,
      outcome_recorded_at = NOW()
    WHERE opportunity_id = NEW.id AND outcome_status IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_record_forecast_outcome
  AFTER UPDATE OF status ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.record_forecast_outcome();

CREATE TRIGGER update_health_score_drivers_updated_at
  BEFORE UPDATE ON public.health_score_drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_auto_remediation_triggers_updated_at
  BEFORE UPDATE ON public.auto_remediation_triggers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();