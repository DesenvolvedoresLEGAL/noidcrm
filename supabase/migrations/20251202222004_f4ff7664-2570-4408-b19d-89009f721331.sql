-- Delete existing release notes and insert complete history with proper SemVer
DELETE FROM public.release_notes;

-- Insert complete release history starting from v1.0.0
INSERT INTO public.release_notes (version, title, description, release_date, changes, is_major) VALUES
-- v1.0.0 - Initial Launch
('1.0.0', 'Lançamento Inicial do NOID CRM', 'Primeira versão funcional do CRM com funcionalidades básicas de gestão comercial.', '2024-06-01', '[
  {"type": "feature", "description": "Sistema base do CRM com arquitetura React + Vite + TypeScript"},
  {"type": "feature", "description": "Integração com Supabase para backend e autenticação"},
  {"type": "feature", "description": "Design system com Tailwind CSS e shadcn/ui"},
  {"type": "feature", "description": "Estrutura de navegação e layout responsivo"}
]'::jsonb, true),

-- v1.1.0 - Authentication
('1.1.0', 'Sistema de Autenticação', 'Implementação completa de login, signup e gestão de sessões.', '2024-06-15', '[
  {"type": "feature", "description": "Tela de login com validação de credenciais"},
  {"type": "feature", "description": "Cadastro de novos usuários com confirmação por email"},
  {"type": "feature", "description": "Recuperação de senha via email"},
  {"type": "security", "description": "Proteção de rotas autenticadas"}
]'::jsonb, false),

-- v1.2.0 - Organizations
('1.2.0', 'Multi-Tenancy e Organizações', 'Suporte a múltiplas organizações com isolamento de dados.', '2024-07-01', '[
  {"type": "feature", "description": "Criação e gestão de organizações"},
  {"type": "feature", "description": "Convite de usuários para organizações"},
  {"type": "feature", "description": "Papéis e permissões (owner, admin, member)"},
  {"type": "security", "description": "Row Level Security (RLS) para isolamento de dados"}
]'::jsonb, false),

-- v1.3.0 - Pipeline & Kanban
('1.3.0', 'Pipeline e Kanban', 'Visualização de oportunidades em formato Kanban com drag-and-drop.', '2024-07-20', '[
  {"type": "feature", "description": "Board Kanban com colunas por estágio do funil"},
  {"type": "feature", "description": "Drag-and-drop para mover oportunidades entre estágios"},
  {"type": "feature", "description": "Criação e edição de pipelines personalizados"},
  {"type": "feature", "description": "Configuração de estágios com cores e probabilidades"}
]'::jsonb, false),

-- v1.4.0 - Dashboard
('1.4.0', 'Dashboard e Métricas', 'Painel inicial com visão geral do desempenho comercial.', '2024-08-05', '[
  {"type": "feature", "description": "Cards de KPIs: valor total, quantidade de deals, taxa de conversão"},
  {"type": "feature", "description": "Gráfico de funil de vendas"},
  {"type": "feature", "description": "Lista de oportunidades prioritárias"},
  {"type": "improvement", "description": "Filtros por período e pipeline"}
]'::jsonb, false),

-- v1.5.0 - Accounts Module
('1.5.0', 'Módulo de Contas/Empresas', 'Gestão completa de empresas e clientes.', '2024-08-20', '[
  {"type": "feature", "description": "Cadastro de contas com dados básicos"},
  {"type": "feature", "description": "Listagem com busca e filtros"},
  {"type": "feature", "description": "Visualização detalhada de conta"},
  {"type": "feature", "description": "Vinculação de oportunidades a contas"}
]'::jsonb, false),

-- v1.6.0 - Contacts Module
('1.6.0', 'Módulo de Contatos', 'Gestão de pessoas vinculadas às contas.', '2024-09-01', '[
  {"type": "feature", "description": "Cadastro de contatos com cargo e informações de contato"},
  {"type": "feature", "description": "Vinculação de contatos a contas"},
  {"type": "feature", "description": "Múltiplos telefones e emails por contato"},
  {"type": "improvement", "description": "Busca global de contatos"}
]'::jsonb, false),

-- v1.7.0 - Opportunities Module
('1.7.0', 'Módulo de Oportunidades Avançado', 'Funcionalidades avançadas para gestão de deals.', '2024-09-15', '[
  {"type": "feature", "description": "Modal detalhado de oportunidade com abas"},
  {"type": "feature", "description": "Campos customizados: temperatura, origem, produto"},
  {"type": "feature", "description": "Histórico de alterações (audit log)"},
  {"type": "feature", "description": "Marcação de ganho/perda com motivos"}
]'::jsonb, false),

-- v1.8.0 - Roleplay Module
('1.8.0', 'Módulo de Roleplay com IA', 'Treinamento de vendedores com simulação de clientes por IA.', '2024-10-01', '[
  {"type": "feature", "description": "Simulação de cliente com Google Gemini"},
  {"type": "feature", "description": "Arquétipos de clientes configuráveis"},
  {"type": "feature", "description": "Perfis ICP (Ideal Customer Profile)"},
  {"type": "feature", "description": "Avaliação automática com rubrica"}
]'::jsonb, true),

-- v1.9.0 - Basic Proposals
('1.9.0', 'Propostas Comerciais Básicas', 'Criação de propostas vinculadas a oportunidades.', '2024-10-15', '[
  {"type": "feature", "description": "Criação de propostas com itens e valores"},
  {"type": "feature", "description": "Status de proposta (rascunho, enviada, aceita, rejeitada)"},
  {"type": "feature", "description": "Vinculação a oportunidades"},
  {"type": "improvement", "description": "Cálculo automático de totais"}
]'::jsonb, false),

-- v1.10.0 - RLS & Data Visibility
('1.10.0', 'Visibilidade de Dados e RLS', 'Controle granular de acesso baseado em papéis.', '2024-10-25', '[
  {"type": "security", "description": "Políticas RLS para todas as tabelas principais"},
  {"type": "feature", "description": "Vendedores veem apenas seus próprios dados"},
  {"type": "feature", "description": "Gestores veem dados da equipe"},
  {"type": "feature", "description": "Admins veem todos os dados da organização"}
]'::jsonb, false),

-- v1.11.0 - Activities Sprint 1
('1.11.0', 'Atividades - Sprint 1', 'Sistema básico de atividades com responsáveis reais.', '2024-11-01', '[
  {"type": "feature", "description": "Criação de atividades (reunião, ligação, email, tarefa)"},
  {"type": "feature", "description": "Responsável pré-preenchido com usuário logado"},
  {"type": "feature", "description": "Vinculação obrigatória a conta/cliente"},
  {"type": "fix", "description": "Correção de usuários hardcoded para usuários reais"}
]'::jsonb, false),

-- v1.12.0 - Activities Sprint 2
('1.12.0', 'Atividades - Sprint 2 (Participantes)', 'Sistema de múltiplos participantes em atividades.', '2024-11-05', '[
  {"type": "feature", "description": "Tabela activity_participants para múltiplos envolvidos"},
  {"type": "feature", "description": "Seleção de participantes com chips visuais"},
  {"type": "feature", "description": "Papéis de participante (owner, participant, optional)"},
  {"type": "improvement", "description": "UI aprimorada para gestão de participantes"}
]'::jsonb, false),

-- v1.13.0 - Activities Sprint 3
('1.13.0', 'Sincronização Email/Calendário', 'Integração OAuth com Gmail e Google Calendar.', '2024-11-10', '[
  {"type": "feature", "description": "OAuth 2.0 com Gmail para sincronização de emails"},
  {"type": "feature", "description": "OAuth 2.0 com Google Calendar para eventos"},
  {"type": "feature", "description": "Criação automática de atividades a partir de emails/eventos"},
  {"type": "security", "description": "Armazenamento seguro de tokens OAuth"}
]'::jsonb, false),

-- v1.14.0 - Activities Sprint 4
('1.14.0', 'Atividades com IA - Sprint 4', 'Automação inteligente para atividades.', '2024-11-15', '[
  {"type": "feature", "description": "Sugestões de horário baseadas em padrões históricos"},
  {"type": "feature", "description": "Templates de descrição gerados por IA"},
  {"type": "feature", "description": "Sugestão de duração por tipo de atividade"},
  {"type": "feature", "description": "Lembretes automáticos 15 minutos antes"}
]'::jsonb, false),

-- v1.15.0 - Basic Products
('1.15.0', 'Módulo de Produtos Básico', 'Catálogo de produtos e serviços.', '2024-11-18', '[
  {"type": "feature", "description": "Cadastro de produtos com preço e descrição"},
  {"type": "feature", "description": "Diferenciação entre produto e serviço"},
  {"type": "feature", "description": "Listagem com busca e filtros"},
  {"type": "improvement", "description": "Vinculação de produtos a propostas"}
]'::jsonb, false),

-- v1.16.0 - Proposals with PDF Layouts
('1.16.0', 'Propostas com Layouts PDF', 'Geração de PDFs profissionais para propostas.', '2024-11-20', '[
  {"type": "feature", "description": "Layouts de proposta configuráveis"},
  {"type": "feature", "description": "Geração de PDF com jsPDF"},
  {"type": "feature", "description": "Preview de proposta antes de enviar"},
  {"type": "feature", "description": "Envio de proposta por email"}
]'::jsonb, false),

-- v1.17.0 - Dynamic Variables
('1.17.0', 'Variáveis Dinâmicas em Propostas', 'Sistema de 40+ variáveis para personalização automática.', '2024-11-22', '[
  {"type": "feature", "description": "40+ variáveis contextuais (organização, cliente, contato, proposta)"},
  {"type": "feature", "description": "Substituição automática ao gerar PDF"},
  {"type": "feature", "description": "Preview com variáveis renderizadas"},
  {"type": "improvement", "description": "Editor visual de variáveis"}
]'::jsonb, false),

-- v1.18.0 - Robust Account Registration
('1.18.0', 'Cadastro Robusto de Contas (CNPJ)', 'Auto-preenchimento via consulta CNPJ.', '2024-11-25', '[
  {"type": "feature", "description": "Busca automática de dados via OpenCNPJ API"},
  {"type": "feature", "description": "45+ campos preenchidos automaticamente"},
  {"type": "feature", "description": "Extração de sócios (QSA) para tabela account_partners"},
  {"type": "improvement", "description": "Redução de 90% no tempo de cadastro"}
]'::jsonb, true),

-- v1.19.0 - Unified Accounts Module
('1.19.0', 'Módulo de Contas Unificado', 'Consolidação de 5 sprints em experiência única.', '2024-11-27', '[
  {"type": "feature", "description": "Página de detalhes com abas (Overview, Contatos, Oportunidades, Atividades, Timeline)"},
  {"type": "feature", "description": "Gestão de contatos integrada à conta"},
  {"type": "feature", "description": "Timeline unificada de todas as interações"},
  {"type": "feature", "description": "Métricas KPI por conta"}
]'::jsonb, false),

-- v1.20.0 - Digital Signature
('1.20.0', 'Assinatura Digital e Aceite Formal', 'Aceite de propostas com validade jurídica.', '2024-11-28', '[
  {"type": "feature", "description": "Link público para aceite de proposta"},
  {"type": "feature", "description": "Captura de IP, User-Agent e timestamp"},
  {"type": "feature", "description": "Geração de PDF de comprovante com hash SHA-256"},
  {"type": "feature", "description": "Criação automática de contrato ao aceitar"},
  {"type": "security", "description": "Validação de integridade com hash criptográfico"}
]'::jsonb, true),

-- v1.21.0 - AI Copilot for Proposals
('1.21.0', 'AI Copilot para Propostas', 'Assistente de IA para criação de propostas.', '2024-11-29', '[
  {"type": "feature", "description": "Geração de introduções personalizadas por IA"},
  {"type": "feature", "description": "Sugestões de preço baseadas em histórico de vendas"},
  {"type": "feature", "description": "Revisão automática detectando inconsistências"},
  {"type": "feature", "description": "Análise de sentimento do cliente"}
]'::jsonb, false),

-- v1.22.0 - Data Management Hub
('1.22.0', 'Data Management Hub', 'Central de importação e exportação de dados.', '2024-11-30', '[
  {"type": "feature", "description": "Exportação para CSV e Excel"},
  {"type": "feature", "description": "Templates de exportação configuráveis"},
  {"type": "feature", "description": "Exportações agendadas"},
  {"type": "feature", "description": "Histórico de importações/exportações"}
]'::jsonb, false),

-- v1.23.0 - Advanced Products
('1.23.0', 'Produtos Avançados', 'Categorias, unidades de medida e métricas.', '2024-12-01', '[
  {"type": "feature", "description": "Categorias de produtos com cores"},
  {"type": "feature", "description": "Unidades de medida configuráveis"},
  {"type": "feature", "description": "Cálculo automático de margem"},
  {"type": "feature", "description": "Métricas separadas por tipo (produto vs serviço)"},
  {"type": "improvement", "description": "Upload de imagens de produtos"}
]'::jsonb, false),

-- v1.24.0 - Import with AI Validation
('1.24.0', 'Importação com Validação IA', 'Importação inteligente de dados com validação semântica.', '2024-12-01', '[
  {"type": "feature", "description": "Importação de CSV/Excel com mapeamento de colunas"},
  {"type": "feature", "description": "Validação semântica com IA para detecção de duplicatas"},
  {"type": "feature", "description": "Processamento em lotes para grandes volumes (10.000+ registros)"},
  {"type": "feature", "description": "Relatório detalhado pós-importação"},
  {"type": "fix", "description": "Correção de timezone em datas importadas"}
]'::jsonb, false),

-- v1.25.0 - Notifications & Release Notes (Current)
('1.25.0', 'Sistema de Notificações e Release Notes', 'Notificações em tempo real e histórico de versões.', '2024-12-02', '[
  {"type": "feature", "description": "Notificações automáticas para oportunidades, contas e propostas"},
  {"type": "feature", "description": "Sino de notificações com contador de não lidas"},
  {"type": "feature", "description": "Página de Release Notes com histórico completo"},
  {"type": "improvement", "description": "Sidebar minimalista sem badges desnecessários"},
  {"type": "improvement", "description": "Timeline visual de versões com filtros"}
]'::jsonb, false);