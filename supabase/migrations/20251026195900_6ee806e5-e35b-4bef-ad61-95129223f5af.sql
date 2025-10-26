-- ============================================
-- NOID ROLEPLAY MODULE - FULL DATABASE SCHEMA (FIXED)
-- ============================================

-- Enum for roles
CREATE TYPE seller_role_type AS ENUM ('Closer', 'SDR', 'Farmer');
CREATE TYPE accelerator_tier_type AS ENUM ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND');
CREATE TYPE roleplay_sender_type AS ENUM ('seller', 'ai_client');
CREATE TYPE tone_style_type AS ENUM ('técnico', 'apressado', 'cético', 'indeciso', 'agressivo', 'metódico');
CREATE TYPE decision_role_type AS ENUM ('Decisor', 'Influenciador', 'Usuário-Chave');
CREATE TYPE client_type AS ENUM ('Organizador', 'Expositor', 'Agência', 'Empresa Contratante');
CREATE TYPE archetype_level_type AS ENUM ('Entrada', 'Intermediário', 'Avançado', 'Enterprise');
CREATE TYPE video_level_type AS ENUM ('Básico', 'Intermediário', 'Avançado');
CREATE TYPE video_source_type AS ENUM ('Interno', 'YouTube', 'Vimeo', 'Loom');

-- ============================================
-- SELLERS TABLE
-- ============================================
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  squad TEXT,
  role seller_role_type DEFAULT 'SDR',
  hire_date DATE DEFAULT CURRENT_DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- ============================================
-- SELLER STATS TABLE
-- ============================================
CREATE TABLE public.seller_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  roleplays_done INTEGER DEFAULT 0,
  avg_score NUMERIC(4,2) DEFAULT 0,
  min_score NUMERIC(4,2),
  max_score NUMERIC(4,2),
  attendance_pct NUMERIC(5,2) DEFAULT 0,
  messages_avg_per_roleplay NUMERIC(10,2) DEFAULT 0,
  meetings_unlocked INTEGER DEFAULT 0,
  accelerator_tier accelerator_tier_type DEFAULT 'NONE',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seller_id, period)
);

-- ============================================
-- ICP PROFILES TABLE
-- ============================================
CREATE TABLE public.icp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segment TEXT,
  company_size TEXT,
  revenue_band TEXT,
  tech_maturity INTEGER CHECK (tech_maturity >= 1 AND tech_maturity <= 5),
  pain_points JSONB DEFAULT '[]'::jsonb,
  buying_triggers JSONB DEFAULT '[]'::jsonb,
  competing_alternatives JSONB DEFAULT '[]'::jsonb,
  success_criteria JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CLIENT ARCHETYPES TABLE
-- ============================================
CREATE TABLE public.client_archetypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type client_type,
  level archetype_level_type,
  decision_role decision_role_type,
  objection_set JSONB DEFAULT '[]'::jsonb,
  tone_style tone_style_type,
  min_message_exchanges INTEGER DEFAULT 50,
  complexity_score INTEGER CHECK (complexity_score >= 1 AND complexity_score <= 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- EVALUATION RUBRICS TABLE
-- ============================================
CREATE TABLE public.evaluation_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  passing_score NUMERIC(4,2) DEFAULT 8.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SIMULATED CLIENTS TABLE
-- ============================================
CREATE TABLE public.simulated_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  icp_id UUID REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  archetype_id UUID REFERENCES public.client_archetypes(id) ON DELETE SET NULL,
  fake_name TEXT NOT NULL,
  fake_company TEXT NOT NULL,
  fake_cnpj TEXT NOT NULL,
  fake_role TEXT NOT NULL,
  tone_style tone_style_type,
  decision_role decision_role_type,
  objection_pattern JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROLEPLAY SESSIONS TABLE
-- ============================================
CREATE TABLE public.roleplay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  simulated_client_id UUID REFERENCES public.simulated_clients(id) ON DELETE SET NULL,
  icp_id UUID REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  archetype_id UUID REFERENCES public.client_archetypes(id) ON DELETE SET NULL,
  rubric_id UUID REFERENCES public.evaluation_rubrics(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  time_spent_sec INTEGER DEFAULT 0,
  exchanges_count INTEGER DEFAULT 0,
  score_overall NUMERIC(4,2),
  scores_json JSONB DEFAULT '{}'::jsonb,
  passed BOOLEAN DEFAULT false,
  meeting_unlocked BOOLEAN DEFAULT false,
  coach_notes TEXT,
  linked_opportunity_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROLEPLAY MESSAGES TABLE
-- ============================================
CREATE TABLE public.roleplay_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.roleplay_sessions(id) ON DELETE CASCADE,
  sender roleplay_sender_type NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PERFORMANCE INSIGHTS TABLE
-- ============================================
CREATE TABLE public.performance_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.roleplay_sessions(id) ON DELETE SET NULL,
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  predicted_loss_reason TEXT,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  next_roleplay_suggestion TEXT,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- VIDEO LIBRARY TABLE
-- ============================================
CREATE TABLE public.video_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  language TEXT DEFAULT 'pt-BR',
  source video_source_type DEFAULT 'YouTube',
  level video_level_type DEFAULT 'Básico',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- VIDEO RECOMMENDATIONS TABLE
-- ============================================
CREATE TABLE public.video_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.roleplay_sessions(id) ON DELETE SET NULL,
  video_ids JSONB DEFAULT '[]'::jsonb,
  reasoning TEXT,
  watched BOOLEAN DEFAULT false,
  recommended_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ATTENDANCE TABLE (FIXED: renamed window to training_window)
-- ============================================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  present BOOLEAN DEFAULT false,
  training_window TEXT DEFAULT '09:00–09:30 BRT',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seller_id, date)
);

-- ============================================
-- ACCELERATOR POLICIES TABLE
-- ============================================
CREATE TABLE public.accelerator_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier accelerator_tier_type NOT NULL,
  min_attendance_pct NUMERIC(5,2) NOT NULL,
  min_avg_score NUMERIC(4,2) NOT NULL,
  multiplier NUMERIC(4,2) NOT NULL,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_sessions_seller ON public.roleplay_sessions(seller_id, started_at DESC);
CREATE INDEX idx_sessions_org ON public.roleplay_sessions(organization_id, started_at DESC);
CREATE INDEX idx_messages_session ON public.roleplay_messages(session_id, timestamp);
CREATE INDEX idx_attendance_seller_date ON public.attendance(seller_id, date);
CREATE INDEX idx_video_recs_seller ON public.video_recommendations(seller_id, recommended_at DESC);
CREATE INDEX idx_seller_stats_seller ON public.seller_stats(seller_id, period DESC);
CREATE INDEX idx_insights_seller ON public.performance_insights(seller_id, created_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Sellers
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sellers in their org"
  ON public.sellers FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Users can update their own seller profile"
  ON public.sellers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can insert sellers"
  ON public.sellers FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_admin(organization_id));

-- Seller Stats
ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stats in their org"
  ON public.seller_stats FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "System can manage stats"
  ON public.seller_stats FOR ALL
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

-- ICP Profiles
ALTER TABLE public.icp_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ICPs in their org"
  ON public.icp_profiles FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Admins can manage ICPs"
  ON public.icp_profiles FOR ALL
  TO authenticated
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

-- Client Archetypes
ALTER TABLE public.client_archetypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view archetypes in their org"
  ON public.client_archetypes FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Admins can manage archetypes"
  ON public.client_archetypes FOR ALL
  TO authenticated
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

-- Evaluation Rubrics
ALTER TABLE public.evaluation_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rubrics in their org"
  ON public.evaluation_rubrics FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Admins can manage rubrics"
  ON public.evaluation_rubrics FOR ALL
  TO authenticated
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

-- Simulated Clients
ALTER TABLE public.simulated_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clients in their org"
  ON public.simulated_clients FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Users can create clients in their org"
  ON public.simulated_clients FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

-- Roleplay Sessions
ALTER TABLE public.roleplay_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own sessions"
  ON public.roleplay_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers
      WHERE sellers.id = roleplay_sessions.seller_id
      AND sellers.user_id = auth.uid()
    )
    OR user_is_org_admin(organization_id)
  );

CREATE POLICY "Sellers can create their own sessions"
  ON public.roleplay_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sellers
      WHERE sellers.id = seller_id
      AND sellers.user_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update their own sessions"
  ON public.roleplay_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers
      WHERE sellers.id = roleplay_sessions.seller_id
      AND sellers.user_id = auth.uid()
    )
    OR user_is_org_admin(organization_id)
  );

-- Roleplay Messages
ALTER TABLE public.roleplay_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their sessions"
  ON public.roleplay_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roleplay_sessions rs
      JOIN public.sellers s ON s.id = rs.seller_id
      WHERE rs.id = roleplay_messages.session_id
      AND (s.user_id = auth.uid() OR user_is_org_admin(rs.organization_id))
    )
  );

CREATE POLICY "Users can insert messages in their sessions"
  ON public.roleplay_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roleplay_sessions rs
      JOIN public.sellers s ON s.id = rs.seller_id
      WHERE rs.id = session_id
      AND s.user_id = auth.uid()
    )
  );

-- Performance Insights
ALTER TABLE public.performance_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own insights"
  ON public.performance_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers
      WHERE sellers.id = performance_insights.seller_id
      AND sellers.user_id = auth.uid()
    )
    OR user_is_org_admin(organization_id)
  );

CREATE POLICY "System can create insights"
  ON public.performance_insights FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

-- Video Library
ALTER TABLE public.video_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view videos in their org"
  ON public.video_library FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Admins can manage videos"
  ON public.video_library FOR ALL
  TO authenticated
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

-- Video Recommendations
ALTER TABLE public.video_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own recommendations"
  ON public.video_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers
      WHERE sellers.id = video_recommendations.seller_id
      AND sellers.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create recommendations"
  ON public.video_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Sellers can update their recommendations"
  ON public.video_recommendations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers
      WHERE sellers.id = video_recommendations.seller_id
      AND sellers.user_id = auth.uid()
    )
  );

-- Attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own attendance"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers
      WHERE sellers.id = attendance.seller_id
      AND sellers.user_id = auth.uid()
    )
    OR user_is_org_admin(organization_id)
  );

CREATE POLICY "System can manage attendance"
  ON public.attendance FOR ALL
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

-- Accelerator Policies
ALTER TABLE public.accelerator_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view policies in their org"
  ON public.accelerator_policies FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Admins can manage policies"
  ON public.accelerator_policies FOR ALL
  TO authenticated
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-record attendance when session starts during training window
CREATE OR REPLACE FUNCTION auto_record_attendance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.started_at IS NOT NULL THEN
    IF EXTRACT(HOUR FROM NEW.started_at AT TIME ZONE 'America/Sao_Paulo') = 9 
       AND EXTRACT(MINUTE FROM NEW.started_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 0 AND 30 THEN
      INSERT INTO public.attendance (seller_id, date, present, organization_id)
      VALUES (NEW.seller_id, (NEW.started_at AT TIME ZONE 'America/Sao_Paulo')::date, true, NEW.organization_id)
      ON CONFLICT (seller_id, date) DO UPDATE SET present = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_attendance
AFTER INSERT OR UPDATE OF started_at ON public.roleplay_sessions
FOR EACH ROW EXECUTE FUNCTION auto_record_attendance();

-- Check meeting unlock conditions
CREATE OR REPLACE FUNCTION check_meeting_unlock()
RETURNS TRIGGER AS $$
DECLARE
  v_attendance BOOLEAN;
BEGIN
  IF NEW.score_overall >= 8.0 AND NEW.passed = true AND NEW.finished_at IS NOT NULL THEN
    SELECT present INTO v_attendance
    FROM public.attendance
    WHERE seller_id = NEW.seller_id 
    AND date = (NEW.finished_at AT TIME ZONE 'America/Sao_Paulo')::date;
    
    IF v_attendance = true THEN
      NEW.meeting_unlocked := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_meeting_unlock
BEFORE UPDATE OF score_overall ON public.roleplay_sessions
FOR EACH ROW EXECUTE FUNCTION check_meeting_unlock();

-- ============================================
-- SEED DATA
-- ============================================

-- ICPs
INSERT INTO public.icp_profiles (organization_id, name, segment, company_size, pain_points, buying_triggers)
SELECT 
  o.id,
  'Organizador de Congressos',
  'Eventos',
  'Médio-Grande',
  '["Baixa visibilidade dos expositores", "Gestão manual de leads", "Falta de analytics"]'::jsonb,
  '["Evento próximo", "Crescimento de expositores", "Pressão por ROI"]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.icp_profiles WHERE name = 'Organizador de Congressos')
LIMIT 1;

INSERT INTO public.icp_profiles (organization_id, name, segment, company_size, pain_points, buying_triggers)
SELECT 
  o.id,
  'Expositor B2B',
  'Expositores',
  'PME-Médio',
  '["Alto custo de estande", "Poucos leads qualificados", "Falta de follow-up pós-evento"]'::jsonb,
  '["Participação confirmada em feira", "Orçamento aprovado", "Necessidade de destaque"]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.icp_profiles WHERE name = 'Expositor B2B')
LIMIT 1;

INSERT INTO public.icp_profiles (organization_id, name, segment, company_size, pain_points, buying_triggers)
SELECT 
  o.id,
  'Agência de Marketing de Eventos',
  'Agências',
  'PME',
  '["Processos manuais", "Dificuldade em mensurar resultados", "Escalabilidade limitada"]'::jsonb,
  '["Novo cliente corporativo", "Evento de grande porte", "Pressão por eficiência"]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.icp_profiles WHERE name = 'Agência de Marketing de Eventos')
LIMIT 1;

-- Client Archetypes
INSERT INTO public.client_archetypes (organization_id, name, type, level, tone_style, decision_role, objection_set, min_message_exchanges, complexity_score)
SELECT 
  o.id,
  'CEO Apressado',
  'Organizador'::client_type,
  'Avançado'::archetype_level_type,
  'apressado'::tone_style_type,
  'Decisor'::decision_role_type,
  '["Não tenho tempo", "Preciso ver ROI imediato", "Já tentamos isso antes"]'::jsonb,
  50,
  4
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.client_archetypes WHERE name = 'CEO Apressado')
LIMIT 1;

INSERT INTO public.client_archetypes (organization_id, name, type, level, tone_style, decision_role, objection_set, min_message_exchanges, complexity_score)
SELECT 
  o.id,
  'Diretor Técnico Cético',
  'Expositor'::client_type,
  'Intermediário'::archetype_level_type,
  'técnico'::tone_style_type,
  'Influenciador'::decision_role_type,
  '["E a integração com nossos sistemas?", "Quem faz o suporte?", "E se não funcionar?"]'::jsonb,
  50,
  4
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.client_archetypes WHERE name = 'Diretor Técnico Cético')
LIMIT 1;

INSERT INTO public.client_archetypes (organization_id, name, type, level, tone_style, decision_role, objection_set, min_message_exchanges, complexity_score)
SELECT 
  o.id,
  'Comprador Indeciso',
  'Agência'::client_type,
  'Entrada'::archetype_level_type,
  'indeciso'::tone_style_type,
  'Decisor'::decision_role_type,
  '["Preciso consultar a diretoria", "Vou avaliar outras opções", "Não sei se é o momento"]'::jsonb,
  50,
  2
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.client_archetypes WHERE name = 'Comprador Indeciso')
LIMIT 1;

-- Evaluation Rubrics
INSERT INTO public.evaluation_rubrics (organization_id, name, dimensions, passing_score)
SELECT 
  o.id,
  'SPIN + Fechamento',
  '[
    {"key":"Discovery", "weight":0.25, "criteria":"Fez perguntas de Situação, Problema, Implicação e Necessidade"},
    {"key":"ObjectionHandling", "weight":0.20, "criteria":"Respondeu objeções com empatia e evidências"},
    {"key":"ValueArticulation", "weight":0.20, "criteria":"Apresentou valor claro e ROI tangível"},
    {"key":"NextStep", "weight":0.25, "criteria":"Definiu próximo passo concreto (demo, proposta, reunião)"},
    {"key":"ProfessionalTone", "weight":0.10, "criteria":"Manteve tom profissional e empático"}
  ]'::jsonb,
  8.0
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.evaluation_rubrics WHERE name = 'SPIN + Fechamento')
LIMIT 1;

-- Video Library
INSERT INTO public.video_library (organization_id, title, url, duration_sec, tags, level)
SELECT 
  o.id,
  'SPIN Selling - Perguntas de Situação',
  'https://youtube.com/watch?v=example1',
  180,
  '["Discovery", "SPIN"]'::jsonb,
  'Básico'::video_level_type
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.video_library WHERE title = 'SPIN Selling - Perguntas de Situação')
LIMIT 1;

INSERT INTO public.video_library (organization_id, title, url, duration_sec, tags, level)
SELECT 
  o.id,
  'Como Lidar com Objeção de Preço',
  'https://youtube.com/watch?v=example2',
  240,
  '["ObjectionHandling", "Preço"]'::jsonb,
  'Intermediário'::video_level_type
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.video_library WHERE title = 'Como Lidar com Objeção de Preço')
LIMIT 1;

INSERT INTO public.video_library (organization_id, title, url, duration_sec, tags, level)
SELECT 
  o.id,
  'ROI: Apresentando Valor Tangível',
  'https://youtube.com/watch?v=example3',
  300,
  '["ValueArticulation", "ROI"]'::jsonb,
  'Intermediário'::video_level_type
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.video_library WHERE title = 'ROI: Apresentando Valor Tangível')
LIMIT 1;

-- Accelerator Policies
INSERT INTO public.accelerator_policies (organization_id, name, tier, min_attendance_pct, min_avg_score, multiplier)
SELECT 
  o.id,
  'Acelerador Bronze',
  'BRONZE'::accelerator_tier_type,
  80,
  8.0,
  1.05
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.accelerator_policies WHERE tier = 'BRONZE')
LIMIT 1;

INSERT INTO public.accelerator_policies (organization_id, name, tier, min_attendance_pct, min_avg_score, multiplier)
SELECT 
  o.id,
  'Acelerador Silver',
  'SILVER'::accelerator_tier_type,
  90,
  8.5,
  1.10
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.accelerator_policies WHERE tier = 'SILVER')
LIMIT 1;

INSERT INTO public.accelerator_policies (organization_id, name, tier, min_attendance_pct, min_avg_score, multiplier)
SELECT 
  o.id,
  'Acelerador Gold',
  'GOLD'::accelerator_tier_type,
  100,
  9.0,
  1.20
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.accelerator_policies WHERE tier = 'GOLD')
LIMIT 1;

INSERT INTO public.accelerator_policies (organization_id, name, tier, min_attendance_pct, min_avg_score, multiplier)
SELECT 
  o.id,
  'Acelerador Diamond',
  'DIAMOND'::accelerator_tier_type,
  100,
  9.5,
  1.35
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.accelerator_policies WHERE tier = 'DIAMOND')
LIMIT 1;