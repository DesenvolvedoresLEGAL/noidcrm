-- Criar tabela loss_reasons
CREATE TABLE public.loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  pipeline_ids UUID[] DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar colunas na tabela opportunities
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS loss_reason_id UUID REFERENCES public.loss_reasons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS loss_comment TEXT;

-- Criar índices
CREATE INDEX idx_loss_reasons_organization ON public.loss_reasons(organization_id);
CREATE INDEX idx_loss_reasons_active ON public.loss_reasons(is_active);
CREATE INDEX idx_opportunities_loss_reason ON public.opportunities(loss_reason_id);

-- Habilitar RLS
ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies para loss_reasons
CREATE POLICY "Users can view org loss reasons"
ON public.loss_reasons FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage loss reasons"
ON public.loss_reasons FOR ALL
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

-- Trigger para updated_at
CREATE TRIGGER update_loss_reasons_updated_at
BEFORE UPDATE ON public.loss_reasons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data: Inserir 43 motivos de perda padrão
-- Estes serão inseridos para cada organização existente
DO $$
DECLARE
  org RECORD;
  loss_reason_names TEXT[] := ARRAY[
    'Área de voo restrita ou proibida por regulamentação (ANAC, zoneamento)',
    'Atendimento percebido como ruim/lento',
    'Cliente bloqueou nossos canais',
    'Cliente fora do ICP: Pessoa Física',
    'Cliente já contratou solução concorrente antes do contato de vendas',
    'Cliente não entendeu/valorizou a solução',
    'Cliente não obteve autorizações necessárias para operação',
    'Cliente não possui orçamento disponível',
    'Cliente não possui viabilidade operacional',
    'Cliente não respondeu/perdemos contato',
    'Cliente optou por não terceirizar o serviço',
    'Cliente optou por postergar decisão',
    'Cliente optou por solução concorrente',
    'Cliente possui solução interna suficiente',
    'Concorrente ofereceu proposta mais vantajosa',
    'Condições meteorológicas desfavoráveis',
    'Contrato ou negociação muito demorada',
    'Dificuldade em atender requisitos técnicos específicos',
    'Entrou em contato apenas para pesquisa de preços',
    'Expectativa de ROI não foi atingida',
    'Falha na comunicação interna do cliente',
    'Falta de apoio da alta gerência do cliente',
    'Falta de disponibilidade de equipamentos',
    'Falta de fit entre necessidade e nossa solução',
    'Impedimentos legais ou contratuais do cliente',
    'Lead não qualificado/fora do perfil',
    'Limitações de infraestrutura do cliente',
    'Mudança de estratégia do cliente',
    'Mudança de prioridades do cliente',
    'Mudanças organizacionais no cliente (demissões, reestruturação)',
    'Necessidade não urgente/não prioritária',
    'Não conseguimos agendar reunião de vendas',
    'Não houve budget aprovado',
    'Período de safra ou sazonalidade desfavorável',
    'Preço percebido como alto',
    'Problemas financeiros do cliente',
    'Processo de compra muito complexo',
    'Projeto do cliente foi cancelado',
    'Proposta não atendeu expectativas técnicas',
    'Restrições de tempo para implementação',
    'Timing inadequado para o cliente',
    'Tomador de decisão não identificado/acessado',
    'Outros motivos'
  ];
  reason_name TEXT;
BEGIN
  -- Para cada organização existente, inserir os motivos de perda
  FOR org IN SELECT id FROM public.organizations LOOP
    FOREACH reason_name IN ARRAY loss_reason_names LOOP
      INSERT INTO public.loss_reasons (organization_id, name, is_active, pipeline_ids)
      VALUES (org.id, reason_name, true, NULL)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;