-- Tabela de missões disponíveis
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
  category TEXT NOT NULL CHECK (category IN ('roleplay', 'crm', 'engagement')),
  target_type TEXT NOT NULL,
  target_value INTEGER NOT NULL DEFAULT 1,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  icon TEXT NOT NULL DEFAULT 'target',
  is_active BOOLEAN DEFAULT true,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de progresso do vendedor nas missões
CREATE TABLE public.seller_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  current_progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seller_id, mission_id, period_start)
);

-- Habilitar RLS
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_missions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para missions
CREATE POLICY "Users can view active missions" ON public.missions
  FOR SELECT USING (is_active = true AND (organization_id IS NULL OR organization_id = get_user_organization_id()));

CREATE POLICY "Admins can manage missions" ON public.missions
  FOR ALL USING (user_is_org_admin(organization_id));

-- Políticas RLS para seller_missions
CREATE POLICY "Sellers can view their own missions" ON public.seller_missions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sellers WHERE sellers.id = seller_missions.seller_id AND sellers.user_id = auth.uid())
    OR user_is_org_admin(get_user_organization_id())
  );

CREATE POLICY "System can insert seller missions" ON public.seller_missions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update seller missions" ON public.seller_missions
  FOR UPDATE USING (true);

-- Índices para performance
CREATE INDEX idx_seller_missions_seller_period ON public.seller_missions(seller_id, period_start);
CREATE INDEX idx_seller_missions_mission_id ON public.seller_missions(mission_id);
CREATE INDEX idx_missions_type_active ON public.missions(type, is_active);

-- Inserir missões diárias pré-definidas
INSERT INTO public.missions (code, name, description, type, category, target_type, target_value, xp_reward, icon) VALUES
('daily_login', 'Login do Dia', 'Faça login no sistema', 'daily', 'engagement', 'login', 1, 5, 'log-in'),
('daily_roleplay', 'Treino Diário', 'Complete 1 roleplay de treinamento', 'daily', 'roleplay', 'roleplay_complete', 1, 25, 'message-square'),
('daily_pass', 'Aprovação Diária', 'Seja aprovado em 1 roleplay', 'daily', 'roleplay', 'roleplay_pass', 1, 35, 'check-circle'),
('daily_activity', 'Atividade do Dia', 'Crie uma atividade no CRM', 'daily', 'crm', 'activity_create', 1, 15, 'calendar-plus'),
('daily_proposal', 'Proposta do Dia', 'Crie ou envie uma proposta', 'daily', 'crm', 'proposal_create', 1, 20, 'file-text');

-- Inserir missões semanais pré-definidas
INSERT INTO public.missions (code, name, description, type, category, target_type, target_value, xp_reward, icon) VALUES
('weekly_roleplay_5', 'Maratonista', 'Complete 5 roleplays na semana', 'weekly', 'roleplay', 'roleplay_complete', 5, 100, 'trophy'),
('weekly_pass_3', 'Mestre Aprovado', 'Seja aprovado em 3 roleplays', 'weekly', 'roleplay', 'roleplay_pass', 3, 120, 'award'),
('weekly_activities_10', 'Agenda Cheia', 'Crie 10 atividades na semana', 'weekly', 'crm', 'activity_create', 10, 80, 'calendar-check'),
('weekly_high_score', 'Alta Performance', 'Tenha média 8.0+ nos roleplays', 'weekly', 'roleplay', 'roleplay_avg_score', 80, 150, 'trending-up'),
('weekly_login_streak', 'Semana Completa', 'Faça login em 5 dias diferentes', 'weekly', 'engagement', 'login_days', 5, 75, 'flame');