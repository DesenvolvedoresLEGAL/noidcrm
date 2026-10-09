# humanoid-sales-old

PROMPT MESTRE — LEGAL CRM (Lovable) v2

Stack alvo: React (Lovable) + services/CRM (camada de consumo) → APIs externas em Python (FastAPI/Flask) + MySQL.
Autenticação e sessão: Firebase Auth (e-mail/senha + providers), dados sensíveis do usuário no Firestore.
Não usar Supabase.

0) KNOWLEDGE (arquivo base do projeto)

Visão/PRD:

CRM proprietário LEGAL com automação total (ALUGUE + HUMANOID), integrado ao HUMANOID (agentes de enrichment, dedupe, scoring, SDR-voz, proposta, contrato, billing).

Regras dinâmicas ALUGUE: preco_final = base * M_antecedencia * M_demanda * M_ambiente * M_centro_expo(1.30).

Métricas: funil por estágio, forecast, RFM, NPS, %propostas perdidas, CAC/LTV.

Segurança: LGPD, trilha de auditoria, consentimentos por canal, RBAC.

Personas/Funções: Admin, Vendas, CS/Operações, Gestão.
Rotas principais:
/ (Home/Forecast) • /leads • /accounts/:id • /contacts/:id • /opportunities • /opportunities/:id • /sequences • /proposals • /contracts • /reports • /settings (painel igual ao print, ver seção) • /not-found (404 criativa).

Design System: Tailwind, Neue Haas Unica (Black/Bold/Regular); cores LEGAL #4D2BFB, #03F9FF, #020CBC. Cartões radius 2xl, sombras suaves, grid limpo, microinterações discretas (Framer Motion).

Eventos do ecossistema:
lead.created, lead.enriched, lead.deduped, opportunity.created, opportunity.stage_changed, proposal.sent, proposal.signed, contract.created, invoice.issued, invoice.paid, agent.run.completed.

1) GUARDA-CORPOS

Não editar: /shared/Layout.tsx, /shared/Theme.tsx, /shared/AuthGate.tsx.

Não modificar tokens de cor/spacing.

Não conectar Supabase (proibido neste projeto).

Antes de tocar MySQL, manter services/CRM com mocks estáveis.

2) CONVENÇÕES & FEATURE BREAKDOWN

Sempre implementar com este template:

Create the new page/route

Add UI layout

Connect the data (via services/CRM; usar mocks até Python estar pronto)

Add logic + edge cases

Test per role (Admin, Vendas, CS, Gestão)

3) API ALVO (contratos) + Services/CRM (antes do v1)
3.1 Endpoints (serão servidos pelo Python)
POST   /api/v1/leads
GET    /api/v1/leads/:id
GET    /api/v1/leads?status=&source=&q=&page=&page_size=
POST   /api/v1/opportunities
POST   /api/v1/opportunities/:id/advance
GET    /api/v1/pipelines/:id            // stages e wip
POST   /api/v1/proposals/:id/send
POST   /api/v1/webhooks/humanoid
GET    /api/v1/settings                 // leitura
POST   /api/v1/settings                 // escrita (by section)

3.2 Camada services/CRM (TypeScript — usar Mocks até o backend)

services/crm/leads.ts: listLeads(params), createLead(dto), getLead(id)

services/crm/opportunities.ts: listOpps(params), createOpp(dto), advanceOpp(id, targetStage)

services/crm/pipelines.ts: getPipeline(id)

services/crm/proposals.ts: sendProposal(id)

services/crm/settings.ts: getSettings(), saveSettings(section, payload)

Regras de uso: todos os componentes consomem somente via services/CRM; trocar a baseURL do mock para a API Python quando disponível.

4) BANCO DE DADOS — MySQL (.sql completo para v1)

Cole no seu MySQL (InnoDB, utf8mb4). Campos JSON onde fizer sentido. Ajuste índices conforme crescimento.

-- LEGAL CRM - MySQL schema v1
CREATE DATABASE IF NOT EXISTS legal_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE legal_crm;

-- ACCOUNTS
CREATE TABLE accounts (
  id            CHAR(36) PRIMARY KEY,
  cnpj          VARCHAR(20),
  razao_social  VARCHAR(255),
  nome_fantasia VARCHAR(255),
  segmento      VARCHAR(100),
  cnae          VARCHAR(20),
  tamanho       VARCHAR(50),
  faturamento   DECIMAL(18,2),
  origem_principal VARCHAR(100),
  consent_lgpd  JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_accounts_cnpj (cnpj),
  INDEX idx_accounts_segmento (segmento)
) ENGINE=InnoDB;

-- CONTACTS
CREATE TABLE contacts (
  id            CHAR(36) PRIMARY KEY,
  account_id    CHAR(36),
  nome          VARCHAR(255),
  cargo         VARCHAR(120),
  emails        JSON,
  telefones     JSON,
  whatsapp_optin TINYINT(1) DEFAULT 0,
  linkedin_url  VARCHAR(255),
  owner_user_id CHAR(36),
  consent_lgpd  JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contacts_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_contacts_account (account_id)
) ENGINE=InnoDB;

-- PIPELINES
CREATE TABLE pipelines (
  id         CHAR(36) PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  bu         ENUM('ALUGUE','HUMANOID') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- STAGES
CREATE TABLE stages (
  id          CHAR(36) PRIMARY KEY,
  pipeline_id CHAR(36) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  position    INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_stage_order (pipeline_id, position),
  CONSTRAINT fk_stages_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- LEADS
CREATE TABLE leads (
  id            CHAR(36) PRIMARY KEY,
  account_id    CHAR(36),
  contact_id    CHAR(36),
  origem        VARCHAR(100),
  fonte         VARCHAR(100),
  status        VARCHAR(60),
  intent_score  INT,
  fit_score     INT,
  enrichment_payload JSON,
  dedupe_key    VARCHAR(200),
  assigned_to   CHAR(36),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_leads_status (status),
  INDEX idx_leads_dedupe (dedupe_key),
  CONSTRAINT fk_leads_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- OPPORTUNITIES
CREATE TABLE opportunities (
  id                CHAR(36) PRIMARY KEY,
  account_id        CHAR(36) NOT NULL,
  pipeline_id       CHAR(36) NOT NULL,
  stage_id          CHAR(36) NOT NULL,
  produto           ENUM('ALUGUE','HUMANOID') NOT NULL,
  valor_previsto    DECIMAL(18,2),
  prob              DECIMAL(5,2),
  close_date_prevista DATE,
  meta              JSON,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_opps_pipeline_stage (pipeline_id, stage_id),
  INDEX idx_opps_close_date (close_date_prevista),
  CONSTRAINT fk_opps_account  FOREIGN KEY (account_id)  REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_opps_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE RESTRICT,
  CONSTRAINT fk_opps_stage    FOREIGN KEY (stage_id)    REFERENCES stages(id)    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ACTIVITIES
CREATE TABLE activities (
  id              CHAR(36) PRIMARY KEY,
  opportunity_id  CHAR(36),
  type            VARCHAR(60),
  channel         VARCHAR(60),
  direction       VARCHAR(20),
  duration_seconds INT,
  transcript_url  VARCHAR(500),
  sentiment       VARCHAR(40),
  resumo          TEXT,
  next_step       TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_act_opp (opportunity_id),
  CONSTRAINT fk_act_opp FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- PRICE RULES
CREATE TABLE price_rules (
  id          CHAR(36) PRIMARY KEY,
  name        VARCHAR(120),
  kind        ENUM('DINAMICO','ALUGUE') NOT NULL,
  expression  JSON,     -- guarda parâmetros e multiplicadores
  is_active   TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- PROPOSALS
CREATE TABLE proposals (
  id          CHAR(36) PRIMARY KEY,
  opportunity_id CHAR(36),
  status      ENUM('draft','sent','signed') DEFAULT 'draft',
  pdf_url     VARCHAR(500),
  checksum    VARCHAR(120),
  termos      JSON,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prop_opp (opportunity_id),
  CONSTRAINT fk_prop_opp FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- CONTRACTS
CREATE TABLE contracts (
  id            CHAR(36) PRIMARY KEY,
  proposal_id   CHAR(36),
  status        VARCHAR(40),
  signed_at     DATETIME,
  payload       JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contract_prop FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- SEQUENCES (cadências)
CREATE TABLE sequences (
  id          CHAR(36) PRIMARY KEY,
  name        VARCHAR(120),
  audience    VARCHAR(120),
  objective   VARCHAR(180),
  steps       JSON,
  created_by  CHAR(36),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- AGENT RUNS (HUMANOID)
CREATE TABLE agent_runs (
  id            CHAR(36) PRIMARY KEY,
  agent_name    VARCHAR(120),
  payload_in    JSON,
  payload_out   JSON,
  custo_tokens  DECIMAL(12,4),
  latencia_ms   INT,
  sucesso       TINYINT(1),
  related_ids   JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- SETTINGS (para tela /settings)
CREATE TABLE settings (
  id          CHAR(36) PRIMARY KEY,
  section     VARCHAR(120), -- ex: 'ProdutosServicos','Funis','AcoesAutomaticas'
  payload     JSON,
  updated_by  CHAR(36),
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_settings_section (section)
) ENGINE=InnoDB;

5) HOOK de Firebase/Firestore (trazer dados sensíveis do usuário logado)

Criar hooks/useFirebaseAuth.ts e hooks/useUserSensitive.ts. Todos os fluxos de autenticação via Firebase Auth. Firestore guarda preferências/escopos/claims.

// hooks/useFirebaseAuth.ts
import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};

let app: any; let auth: any;
export function useFirebaseAuth() {
  const [user, setUser] = useState<User|null>(null);
  useEffect(() => {
    if (!app) app = initializeApp(firebaseConfig);
    if (!auth) auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);
  return { user, auth };
}

// hooks/useUserSensitive.ts
import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useFirebaseAuth } from './useFirebaseAuth';

export function useUserSensitive() {
  const { user } = useFirebaseAuth();
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      setData(snap.exists() ? snap.data() : {});
    });
  }, [user]);
  return { user, sensitive: data };
}


Regra: páginas devem chamar useUserSensitive() para ter user + sensitive (escopos, times, territórios, preferências). Nunca replicar esses dados via props soltas.

6) BUSCA & FILTROS (componentes reutilizáveis)

Criar components/FilterBar.tsx com: busca (q), selects (status, source, pipeline, stage), date range, e sincronizar com querystring.

Tabelas com paginação server-side (page, page_size), ordenação (sort, order).

Aplicar FilterBar nas páginas /leads, /opportunities, /proposals, /reports.

Prompt pronto (exemplo):

On page /leads, add FilterBar with fields [q, status, source, date_from, date_to]. Persist filters to URL. Call services/crm/leads.listLeads(params) on change. Show total results and reset button. Don’t touch global layout.

7) PÁGINA 404 CRIATIVA (/not-found)

Requisitos:

Ilustração/emoji de rede “fora de rota”, título “Perdido no Backhaul?”, copy curto e bem-humorado.

CTAs claros: Voltar ao Dashboard, Ir para Leads, Abrir Settings, Reportar um Bug.

Atalhos de teclado: D (dashboard), L (leads), S (settings).

Busca rápida (input q) que redireciona para /search?q=....

Prompt:

Create a playful 404 page at /not-found with LEGAL brand. Include 4 CTAs, keyboard shortcuts (D/L/S) and a quick-search input. Keep Tailwind-only and don’t alter global theme.

8) TELA /settings (igual ao print, com seções em cartões)

Estrutura de cartões (grids responsivos):

Conta: Conta, Configurações, Usuários, Equipes, Grupos de equipes, Holding de contas, Importações, Exportações, Autenticações.

Oportunidades: Funis e etapas de funil, Origens e grupos, Motivos de perda, Cadastro de oportunidades, Regras de preenchimento.

Marketing: Landing pages, Domínios, Botão WhatsApp.

Propostas: Produtos/Serviços/MRR, Categorias, Características, Formas de pagamento, Unidades de medida, Papel de envolvidos.

Atividades/Templates/Modelos: Tipos de atividades, Templates de proposta/e-mail, Modelos de documento/proposta.

Dados de contatos: Segmentos, Regiões, Tags, Campos customizados, Formulários, Listas de dados, Mapeador de campos, Grupos econômicos.

Ferramentas: Ações automáticas, Cadência de funil, Ligações, Integrações, Inteligência artificial, Deduplcador, Ações em massa, Migrador de campos, Lista de distribuição, Versões do sistema.

Comportamento:

Cada cartão abre /settings/:section com formulário dinâmico (schema vindo do endpoint /api/v1/settings?section=...).

Botões Salvar (POST /api/v1/settings) com validação e toast.

Busca global no topo.

Logs de alteração (mostrar autor e data).

Prompt:

Build /settings as a grid of cards mirroring the provided sections. For each card, route to /settings/:section and render a dynamic form (fields from services/crm/settings.getSettings(section)). Include search, breadcrumbs, and audit list. Do not change layout.

9) PROMPTS OPERACIONAIS (exemplos prontos)
Leads Inbox

Role: Vendas — On /leads, render a virtualized table + FilterBar. Row click opens peek panel (right). Bulk actions: Enrich, Merge, Sequence. Data from services/crm/leads.listLeads(params). Empty/loading/error states. No global edits.

Kanban de Oportunidades

Role: Vendas — On /opportunities, Kanban by pipeline (ALUGUE/HUMANOID). Drag card → advanceOpp. Optimistic UI + revert on failure. Filters: stage, prob range, close date. Keep logic isolated.

Simulador de Preço (ALUGUE)

Role: Vendas — In /opportunities/:id, add Price Simulator with inputs (dias, demanda, ambiente, centro_expo). Compute preco_final client-side. Visualize multiplicadores.

Proposta + Assinatura (stub)

Role: Vendas — Button Send Proposal → services/crm/proposals.sendProposal(id) (mock). Reflect status in timeline.

Settings: Produtos/Serviços

Role: Admin — In /settings/ProdutosServicos, list categories + items with inline add/edit/remove. Persist via saveSettings('ProdutosServicos', payload).

10) TESTES POR FUNÇÃO (checklist)

Vendas: lead → enrich/dedupe → oportunidade → Kanban → simulador preço → proposta.

Admin: editar Produtos/Serviços, Funis/Etapas, Ações Automáticas e salvar.

Gestão: /reports com forecast e conversões filtráveis.

CS: pós-venda após “Ganhou” mostra tarefas de onboarding (stub).

11) GIT & FALLBACKS

Commits pequenos; fixe versões estáveis.

Em bug: “Compare version at T–1 to T–0. What changed? What might be breaking?”

Se entrar em loop: Remix (sem Supabase).

“Investigate but don’t write code yet” para brainstorm sem editar código.

12) Tarefas imediatas (para o Lovable executar agora)

Criar rotas e páginas base: /, /leads, /opportunities, /opportunities/:id, /proposals, /contracts, /reports, /sequences, /settings, /not-found.

Implementar services/CRM com mocks.

Implementar useFirebaseAuth e useUserSensitive e proteger rotas (AuthGate).

Construir /settings (grid de cartões + seções dinâmicas).

Adicionar FilterBar reutilizável às telas de dados.

Implementar 404 criativa com CTAs e busca.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://noid-crm.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ef1b8854-89c6-44fb-972f-53c487016b19).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
