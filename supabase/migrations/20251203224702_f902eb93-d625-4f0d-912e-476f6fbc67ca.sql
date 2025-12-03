-- ===========================================
-- GAMIFICATION SYSTEM FOR SALES COACH AI
-- ===========================================

-- 1. Badges table (definitions)
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('training', 'streak', 'performance', 'special')),
  rarity INT NOT NULL DEFAULT 1 CHECK (rarity BETWEEN 1 AND 5),
  criteria JSONB NOT NULL DEFAULT '{}',
  xp_reward INT NOT NULL DEFAULT 50,
  is_active BOOLEAN DEFAULT TRUE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Achievements table (milestones with progress)
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('milestone', 'weekly', 'monthly', 'special')),
  target_value INT NOT NULL,
  xp_reward INT NOT NULL DEFAULT 100,
  icon TEXT NOT NULL DEFAULT 'trophy',
  is_active BOOLEAN DEFAULT TRUE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Seller badges (unlocked badges)
CREATE TABLE public.seller_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  notified BOOLEAN DEFAULT FALSE,
  UNIQUE(seller_id, badge_id)
);

-- 4. Seller achievements (progress tracking)
CREATE TABLE public.seller_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  current_progress INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notified BOOLEAN DEFAULT FALSE,
  UNIQUE(seller_id, achievement_id)
);

-- 5. Add XP columns to sellers table
ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS total_xp INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_level INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_title TEXT DEFAULT 'Iniciante';

-- 6. Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_achievements ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for badges
CREATE POLICY "Users can view badges in their org"
ON public.badges FOR SELECT
USING (organization_id IS NULL OR organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage badges"
ON public.badges FOR ALL
USING (user_is_org_admin(organization_id));

-- 8. RLS Policies for achievements
CREATE POLICY "Users can view achievements in their org"
ON public.achievements FOR SELECT
USING (organization_id IS NULL OR organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage achievements"
ON public.achievements FOR ALL
USING (user_is_org_admin(organization_id));

-- 9. RLS Policies for seller_badges
CREATE POLICY "Sellers can view their own badges"
ON public.seller_badges FOR SELECT
USING (EXISTS (
  SELECT 1 FROM sellers WHERE sellers.id = seller_badges.seller_id AND sellers.user_id = auth.uid()
) OR user_is_org_admin(get_user_organization_id()));

CREATE POLICY "System can insert seller badges"
ON public.seller_badges FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update seller badges"
ON public.seller_badges FOR UPDATE
USING (true);

-- 10. RLS Policies for seller_achievements
CREATE POLICY "Sellers can view their own achievements"
ON public.seller_achievements FOR SELECT
USING (EXISTS (
  SELECT 1 FROM sellers WHERE sellers.id = seller_achievements.seller_id AND sellers.user_id = auth.uid()
) OR user_is_org_admin(get_user_organization_id()));

CREATE POLICY "System can insert seller achievements"
ON public.seller_achievements FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update seller achievements"
ON public.seller_achievements FOR UPDATE
USING (true);

-- 11. Seed Badges (25+ badges)
INSERT INTO public.badges (code, name, description, icon, category, rarity, criteria, xp_reward) VALUES
-- Training badges
('first_step', 'Primeiro Passo', 'Complete seu primeiro treino de roleplay', 'footprints', 'training', 1, '{"type": "sessions_count", "value": 1}', 25),
('dedicated', 'Dedicado', 'Complete 10 treinos de roleplay', 'target', 'training', 1, '{"type": "sessions_count", "value": 10}', 50),
('veteran', 'Veterano', 'Complete 50 treinos de roleplay', 'medal', 'training', 2, '{"type": "sessions_count", "value": 50}', 100),
('centurion', 'Centurião', 'Complete 100 treinos de roleplay', 'shield', 'training', 3, '{"type": "sessions_count", "value": 100}', 200),
('marathon', 'Maratonista', 'Complete 5 treinos em um único dia', 'zap', 'training', 3, '{"type": "daily_sessions", "value": 5}', 150),

-- Streak badges
('flame_lit', 'Chama Acesa', 'Mantenha um streak de 3 dias', 'flame', 'streak', 1, '{"type": "streak_days", "value": 3}', 30),
('eternal_fire', 'Fogo Eterno', 'Mantenha um streak de 7 dias', 'flame-kindling', 'streak', 2, '{"type": "streak_days", "value": 7}', 75),
('invincible', 'Invencível', 'Mantenha um streak de 14 dias', 'crown', 'streak', 3, '{"type": "streak_days", "value": 14}', 150),
('legend', 'Lenda', 'Mantenha um streak de 30 dias', 'sparkles', 'streak', 4, '{"type": "streak_days", "value": 30}', 300),
('immortal', 'Imortal', 'Mantenha um streak de 60 dias', 'star', 'streak', 5, '{"type": "streak_days", "value": 60}', 500),

-- Performance badges
('good_performance', 'Bom Desempenho', 'Alcance média geral ≥ 7.0', 'trending-up', 'performance', 1, '{"type": "avg_score", "value": 7.0}', 40),
('high_performance', 'Alta Performance', 'Alcance média geral ≥ 8.0', 'bar-chart-3', 'performance', 2, '{"type": "avg_score", "value": 8.0}', 80),
('exceptional', 'Excepcional', 'Alcance média geral ≥ 9.0', 'award', 'performance', 3, '{"type": "avg_score", "value": 9.0}', 150),
('perfection', 'Perfeição', 'Alcance nota 10 em um treino', 'gem', 'performance', 4, '{"type": "perfect_score", "value": 1}', 200),
('approver', 'Aprovador', 'Alcance 80% de taxa de aprovação', 'check-circle', 'performance', 1, '{"type": "pass_rate", "value": 80}', 60),
('master', 'Mestre', 'Alcance 95% de taxa de aprovação', 'graduation-cap', 'performance', 3, '{"type": "pass_rate", "value": 95}', 200),

-- Special badges
('early_bird', 'Early Bird', 'Complete um treino antes das 8h', 'sunrise', 'special', 2, '{"type": "early_training", "value": 8}', 50),
('night_owl', 'Night Owl', 'Complete um treino após as 22h', 'moon', 'special', 2, '{"type": "late_training", "value": 22}', 50),
('comeback', 'Comeback', 'Volte a treinar após 7 dias de ausência', 'refresh-cw', 'special', 3, '{"type": "comeback_days", "value": 7}', 100),
('diversity', 'Diversidade', 'Treine com todos os archetypes disponíveis', 'users', 'special', 4, '{"type": "all_archetypes", "value": 1}', 250),
('first_win', 'Primeira Vitória', 'Seja aprovado pela primeira vez', 'trophy', 'special', 1, '{"type": "first_pass", "value": 1}', 50),
('speed_racer', 'Speed Racer', 'Seja aprovado em menos de 5 minutos', 'rocket', 'special', 3, '{"type": "quick_pass", "value": 5}', 100),
('patient', 'Paciente', 'Complete um treino com mais de 20 minutos', 'clock', 'special', 2, '{"type": "long_session", "value": 20}', 75),
('top_3', 'Top 3', 'Fique entre os 3 primeiros do ranking mensal', 'medal', 'special', 4, '{"type": "monthly_rank", "value": 3}', 300),
('champion', 'Campeão', 'Seja o #1 do ranking mensal', 'crown', 'special', 5, '{"type": "monthly_rank", "value": 1}', 500);

-- 12. Seed Achievements
INSERT INTO public.achievements (code, name, description, category, target_value, xp_reward, icon) VALUES
('sessions_25', 'Treinador Dedicado', 'Complete 25 sessões de roleplay', 'milestone', 25, 150, 'dumbbell'),
('sessions_100', 'Mestre do Treino', 'Complete 100 sessões de roleplay', 'milestone', 100, 500, 'trophy'),
('streak_30', 'Consistência Inabalável', 'Mantenha um streak de 30 dias', 'milestone', 30, 400, 'flame'),
('avg_score_85', 'Vendedor de Elite', 'Alcance média geral de 8.5', 'milestone', 85, 300, 'star'),
('weekly_5', 'Semana Produtiva', 'Complete 5 treinos nesta semana', 'weekly', 5, 75, 'calendar'),
('weekly_perfect', 'Semana Perfeita', 'Seja aprovado em todos os treinos da semana', 'weekly', 7, 150, 'check-circle'),
('monthly_20', 'Mês Intenso', 'Complete 20 treinos este mês', 'monthly', 20, 200, 'calendar-days'),
('monthly_champion', 'Campeão do Mês', 'Seja o vendedor com mais XP no mês', 'monthly', 1, 500, 'crown');