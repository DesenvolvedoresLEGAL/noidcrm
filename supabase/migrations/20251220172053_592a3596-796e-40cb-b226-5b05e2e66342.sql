-- 1. Tabela de checklist de ativação por organização
CREATE TABLE public.activation_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  items JSONB DEFAULT '{
    "setup_company": true,
    "choose_pipeline": true,
    "invite_member": false,
    "create_opportunity": false,
    "add_product": false,
    "customize_stages": false,
    "set_goal": false,
    "create_proposal": false,
    "visit_insights": false,
    "visit_automation": false
  }'::jsonb,
  progress INTEGER DEFAULT 20,
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- 2. Tabela de primeiro acesso a páginas (para spotlights)
CREATE TABLE public.user_first_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page_key VARCHAR(100) NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, page_key)
);

-- 3. Tabela de tips descartados
CREATE TABLE public.dismissed_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tip_key VARCHAR(100) NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tip_key)
);

-- 4. Artigos de ajuda
CREATE TABLE public.help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  video_url VARCHAR(500),
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activation_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_first_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activation_checklist
CREATE POLICY "Users can view own org checklist"
ON public.activation_checklist FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can update own org checklist"
ON public.activation_checklist FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can insert own org checklist"
ON public.activation_checklist FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- RLS Policies for user_first_visits
CREATE POLICY "Users can view own visits"
ON public.user_first_visits FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own visits"
ON public.user_first_visits FOR INSERT
WITH CHECK (user_id = auth.uid());

-- RLS Policies for dismissed_tips
CREATE POLICY "Users can view own dismissed tips"
ON public.dismissed_tips FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own dismissed tips"
ON public.dismissed_tips FOR INSERT
WITH CHECK (user_id = auth.uid());

-- RLS Policies for help_articles (public read)
CREATE POLICY "Anyone can view active help articles"
ON public.help_articles FOR SELECT
USING (is_active = true);

-- Function to auto-create checklist on org creation
CREATE OR REPLACE FUNCTION public.create_activation_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activation_checklist (organization_id)
  VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to create checklist when org is created
CREATE TRIGGER on_organization_created_activation
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_activation_checklist();

-- Insert default help articles
INSERT INTO public.help_articles (slug, title, content, category, order_index) VALUES
('criar-oportunidade', 'Como criar uma oportunidade', 'Para criar uma nova oportunidade, vá até o Pipeline e clique no botão "+ Nova Oportunidade". Preencha os dados do negócio como nome, valor estimado e data de fechamento prevista.', 'pipeline', 1),
('mover-oportunidade', 'Como mover oportunidades no Pipeline', 'Arraste e solte os cards de oportunidade entre as colunas do Pipeline para atualizar o estágio. Você também pode clicar no card e alterar o estágio manualmente.', 'pipeline', 2),
('convidar-vendedor', 'Como convidar vendedores', 'Acesse Configurações > Pessoas e clique em "Convidar membro". Digite o email do vendedor e selecione a função. O vendedor receberá um convite por email.', 'equipe', 1),
('criar-proposta', 'Como criar uma proposta', 'Na página de Propostas, clique em "Nova Proposta". Selecione a oportunidade relacionada, adicione produtos/serviços e personalize o conteúdo. Você pode visualizar e enviar por email.', 'propostas', 1),
('definir-meta', 'Como definir metas de vendas', 'Em Configurações > Metas, defina as metas mensais para sua equipe e vendedores individuais. O sistema acompanhará automaticamente o progresso.', 'metas', 1),
('usar-forecast', 'Como usar o Forecast', 'O Forecast usa IA para prever suas vendas baseado no histórico e oportunidades atuais. Acesse a página de Forecast para ver projeções otimista, realista e pessimista.', 'forecast', 1),
('insights-ia', 'Como usar os Insights de IA', 'A página de Insights mostra análises automáticas da sua operação. Veja recomendações personalizadas, alertas de risco e coaching para sua equipe.', 'insights', 1),
('automacoes', 'Como configurar automações', 'Em Automações, crie regras para automatizar tarefas repetitivas como follow-ups, notificações e atribuição de leads. Configure gatilhos e ações personalizadas.', 'automacao', 1);

-- Update function for updated_at
CREATE OR REPLACE FUNCTION public.update_activation_checklist_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_activation_checklist_timestamp
  BEFORE UPDATE ON public.activation_checklist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_activation_checklist_updated_at();