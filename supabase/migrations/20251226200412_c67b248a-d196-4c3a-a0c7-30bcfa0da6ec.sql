
-- Algorithm versions table for version control
CREATE TABLE public.algorithm_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  algorithm_type TEXT NOT NULL CHECK (algorithm_type IN ('CS', 'BS', 'DS', 'RAS', 'GAMIFICATION', 'XP')),
  version TEXT NOT NULL,
  description TEXT,
  weights JSONB NOT NULL DEFAULT '{}',
  inputs JSONB NOT NULL DEFAULT '[]',
  data_sources JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  deprecated_at TIMESTAMP WITH TIME ZONE,
  deprecated_reason TEXT,
  UNIQUE(organization_id, algorithm_type, version)
);

-- Activity mappings for data migration
CREATE TABLE public.activity_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  legacy_activity_type TEXT NOT NULL,
  legacy_activity_code TEXT,
  new_activity_id UUID REFERENCES public.performance_activities(id),
  mapping_rules JSONB DEFAULT '{}',
  migrated_count INTEGER DEFAULT 0,
  last_migrated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Score calculation history with version tracking
CREATE TABLE public.score_calculation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  seller_id UUID REFERENCES public.sellers(id) NOT NULL,
  score_type TEXT NOT NULL CHECK (score_type IN ('CS', 'BS', 'DS', 'RAS')),
  algorithm_version_id UUID,
  version_number TEXT NOT NULL,
  score_value NUMERIC(5,2) NOT NULL,
  inputs_snapshot JSONB NOT NULL DEFAULT '{}',
  weights_snapshot JSONB NOT NULL DEFAULT '{}',
  breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  period_start DATE,
  period_end DATE,
  is_official BOOLEAN DEFAULT true
);

-- XP conversion history for gamification migration
CREATE TABLE public.xp_conversion_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  seller_id UUID REFERENCES public.sellers(id) NOT NULL,
  legacy_xp INTEGER NOT NULL,
  legacy_level INTEGER,
  converted_xp INTEGER NOT NULL,
  conversion_factor NUMERIC(5,3) DEFAULT 1.0,
  conversion_rules JSONB DEFAULT '{}',
  converted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  converted_by UUID
);

-- Badge preservation history
CREATE TABLE public.badge_preservation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  seller_id UUID REFERENCES public.sellers(id) NOT NULL,
  badge_id UUID REFERENCES public.badges(id) NOT NULL,
  original_earned_at TIMESTAMP WITH TIME ZONE NOT NULL,
  preservation_reason TEXT DEFAULT 'migration',
  legacy_criteria JSONB DEFAULT '{}',
  new_criteria_met BOOLEAN DEFAULT true,
  preserved_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.algorithm_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_calculation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_conversion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_preservation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for algorithm_versions
CREATE POLICY "org_members_view_versions" ON public.algorithm_versions
  FOR SELECT USING (
    organization_id IS NULL 
    OR organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "org_members_manage_versions" ON public.algorithm_versions
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for activity_mappings
CREATE POLICY "org_members_view_mappings" ON public.activity_mappings
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "org_members_manage_mappings" ON public.activity_mappings
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for score_calculation_history
CREATE POLICY "sellers_view_score_history" ON public.score_calculation_history
  FOR SELECT USING (
    seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    OR organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "system_insert_score_history" ON public.score_calculation_history
  FOR INSERT WITH CHECK (true);

-- RLS Policies for xp_conversion_history
CREATE POLICY "sellers_view_xp_history" ON public.xp_conversion_history
  FOR SELECT USING (
    seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    OR organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for badge_preservation_history
CREATE POLICY "sellers_view_badge_history" ON public.badge_preservation_history
  FOR SELECT USING (
    seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    OR organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Performance indexes
CREATE INDEX idx_alg_versions_org_type ON public.algorithm_versions(organization_id, algorithm_type);
CREATE INDEX idx_alg_versions_active ON public.algorithm_versions(is_active) WHERE is_active = true;
CREATE INDEX idx_score_hist_seller ON public.score_calculation_history(seller_id, score_type);
CREATE INDEX idx_score_hist_version ON public.score_calculation_history(algorithm_version_id);
CREATE INDEX idx_activity_map_legacy ON public.activity_mappings(organization_id, legacy_activity_type);
CREATE INDEX idx_xp_conv_seller ON public.xp_conversion_history(seller_id);
CREATE INDEX idx_badge_pres_seller ON public.badge_preservation_history(seller_id);

-- Insert default algorithm versions (v2.0) - global defaults without org
INSERT INTO public.algorithm_versions (algorithm_type, version, description, weights, inputs, data_sources, is_active, is_default)
VALUES 
  ('CS', 'v2.0', 'Capability Score - Avalia habilidades técnicas e conhecimento', 
   '{"roleplay_avg_score": 0.4, "pass_rate": 0.3, "training_completion": 0.2, "certification_count": 0.1}',
   '["roleplay_sessions", "training_progress", "certifications"]',
   '["roleplay_sessions", "seller_training", "seller_certifications"]',
   true, true),
  ('BS', 'v2.0', 'Behavior Score - Avalia comportamento e disciplina',
   '{"crm_update_frequency": 0.25, "sla_compliance": 0.25, "activity_consistency": 0.25, "collaboration_score": 0.25}',
   '["crm_updates", "sla_metrics", "daily_activities", "team_interactions"]',
   '["activities", "opportunities", "activity_logs"]',
   true, true),
  ('DS', 'v2.0', 'Delivery Score - Avalia entregas e resultados',
   '{"quota_attainment": 0.35, "pipeline_health": 0.25, "conversion_rate": 0.2, "forecast_accuracy": 0.2}',
   '["sales_data", "pipeline_metrics", "forecast_data"]',
   '["opportunities", "sales_goals", "ai_forecast_logs"]',
   true, true),
  ('RAS', 'v2.0', 'Role Alignment Score - Avalia fit com o cargo',
   '{"skill_match": 0.3, "performance_trend": 0.25, "peer_comparison": 0.25, "manager_rating": 0.2}',
   '["skills_assessment", "historical_scores", "peer_data", "reviews"]',
   '["seller_skills", "score_calculation_history", "sellers"]',
   true, true),
  ('GAMIFICATION', 'v2.0', 'Sistema de gamificação com XP ponderado',
   '{"badge_xp_multiplier": 1.0, "mission_xp_multiplier": 1.0, "achievement_xp_multiplier": 1.5, "streak_bonus": 0.1}',
   '["badges_earned", "missions_completed", "achievements", "streaks"]',
   '["seller_badges", "seller_missions", "seller_achievements"]',
   true, true),
  ('XP', 'v2.0', 'Cálculo de XP com pesos por atividade',
   '{"roleplay_complete": 50, "roleplay_pass": 100, "mission_daily": 25, "mission_weekly": 100, "badge_earned": 150}',
   '["activities_completed", "milestones"]',
   '["activity_logs", "seller_missions", "seller_badges"]',
   true, true);
