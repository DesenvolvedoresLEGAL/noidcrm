-- Popular pipelines
INSERT INTO public.pipelines (id, name, type, color) VALUES
('pipeline-vendas', 'Pipeline de Vendas', 'sales', '#3b82f6'),
('pipeline-alugue', 'ALUGUE', 'sales', '#10b981'),
('pipeline-humanoid', 'HUMANOID', 'sales', '#8b5cf6')
ON CONFLICT (id) DO NOTHING;

-- Popular stages
INSERT INTO public.stages (id, pipeline_id, name, order_index, color) VALUES
('stage-discovery', 'pipeline-vendas', 'Discovery', 1, '#64748b'),
('stage-qualification', 'pipeline-vendas', 'Qualificação', 2, '#3b82f6'),
('stage-proposal', 'pipeline-vendas', 'Proposta', 3, '#f59e0b'),
('stage-negotiation', 'pipeline-vendas', 'Negociação', 4, '#ef4444'),
('stage-closed-won', 'pipeline-vendas', 'Ganhou', 5, '#10b981'),
('stage-closed-lost', 'pipeline-vendas', 'Perdeu', 6, '#6b7280')
ON CONFLICT (id) DO NOTHING;

-- Popular accounts de exemplo (usando UUIDs reais)
INSERT INTO public.accounts (razao_social, nome_fantasia, cnpj, segmento, tamanho, origem_principal) VALUES
('Tech Solutions LTDA', 'Tech Solutions', '12.345.678/0001-90', 'Tecnologia', 'Média', 'Inbound'),
('Construções Brasil SA', 'Construções BR', '23.456.789/0001-01', 'Construção', 'Grande', 'Outbound'),
('Varejo Premium ME', 'Premium Store', '34.567.890/0001-12', 'Varejo', 'Pequena', 'Indicação'),
('Indústria Metal Corp', 'MetalCorp', '45.678.901/0001-23', 'Indústria', 'Grande', 'Inbound'),
('Serviços Express LTDA', 'Express', '56.789.012/0001-34', 'Serviços', 'Média', 'Parceiro');

-- Popular contatos de exemplo (vamos criar depois que tivermos os IDs dos accounts)
DO $$
DECLARE
  acc1_id uuid;
  acc2_id uuid;
  acc3_id uuid;
  acc4_id uuid;
  acc5_id uuid;
BEGIN
  -- Pegar IDs dos accounts criados
  SELECT id INTO acc1_id FROM public.accounts WHERE cnpj = '12.345.678/0001-90';
  SELECT id INTO acc2_id FROM public.accounts WHERE cnpj = '23.456.789/0001-01';
  SELECT id INTO acc3_id FROM public.accounts WHERE cnpj = '34.567.890/0001-12';
  SELECT id INTO acc4_id FROM public.accounts WHERE cnpj = '45.678.901/0001-23';
  SELECT id INTO acc5_id FROM public.accounts WHERE cnpj = '56.789.012/0001-34';

  -- Inserir contatos
  INSERT INTO public.contacts (account_id, nome, cargo, emails, telefones) VALUES
  (acc1_id, 'João Silva', 'CTO', ARRAY['joao@techsolutions.com'], ARRAY['+55 11 98765-4321']),
  (acc1_id, 'Maria Santos', 'CEO', ARRAY['maria@techsolutions.com'], ARRAY['+55 11 98765-4322']),
  (acc2_id, 'Pedro Oliveira', 'Diretor de Compras', ARRAY['pedro@construcoesbr.com'], ARRAY['+55 21 97654-3210']),
  (acc3_id, 'Ana Costa', 'Gerente de TI', ARRAY['ana@premiumstore.com'], ARRAY['+55 11 96543-2109']),
  (acc4_id, 'Carlos Ferreira', 'CFO', ARRAY['carlos@metalcorp.com'], ARRAY['+55 11 95432-1098']),
  (acc5_id, 'Juliana Lima', 'Diretora Operacional', ARRAY['juliana@express.com'], ARRAY['+55 11 94321-0987']);
END $$;