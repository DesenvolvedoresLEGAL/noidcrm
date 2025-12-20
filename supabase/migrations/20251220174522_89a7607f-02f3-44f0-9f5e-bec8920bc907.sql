-- Tabela de chamados de suporte
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Dados do chamado
  ticket_number VARCHAR(20) NOT NULL UNIQUE,
  request_type VARCHAR(50) NOT NULL,
  affected_module VARCHAR(50),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  urgency VARCHAR(20) NOT NULL DEFAULT 'medium',
  
  -- Status e SLA
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  sla_deadline TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Metadados
  attachment_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de respostas do chamado
CREATE TABLE public.support_ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID,
  is_support_team BOOLEAN DEFAULT false,
  message TEXT NOT NULL,
  attachment_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_support_tickets_org ON public.support_tickets(organization_id);
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_ticket_responses_ticket ON public.support_ticket_responses(ticket_id);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_responses ENABLE ROW LEVEL SECURITY;

-- Políticas para support_tickets
CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tickets" ON public.support_tickets
  FOR UPDATE USING (user_id = auth.uid());

-- Políticas para support_ticket_responses
CREATE POLICY "Users can view ticket responses" ON public.support_ticket_responses
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can add responses to own tickets" ON public.support_ticket_responses
  FOR INSERT WITH CHECK (
    ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
  );

-- Função para gerar número do ticket
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'NOID-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_number();

-- Trigger para calcular SLA baseado na urgência
CREATE OR REPLACE FUNCTION public.set_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sla_deadline := CASE NEW.urgency
    WHEN 'critical' THEN NOW() + INTERVAL '4 hours'
    WHEN 'high' THEN NOW() + INTERVAL '24 hours'
    WHEN 'medium' THEN NOW() + INTERVAL '48 hours'
    ELSE NOW() + INTERVAL '72 hours'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_ticket_sla
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_sla_deadline();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();