# NOID Current Product Inventory — v1

**Sprint:** `NOID-VERTICAL-1.0-VERT-01.1`
**Change ID:** VERT-01.1
**Data:** 2026-07-22
**Modo:** Read-only, documental.

## 1. Escopo

Inventário autoritativo do estado atual do NOID RevenueOS, sem qualquer alteração de código ou banco. Todas as evidências foram obtidas por leitura estática do repositório e por metadados públicos já disponíveis em auditorias anteriores (NSEC-1.2, Product Fit Audit v1.1).

## 2. Metodologia

- Enumeração de rotas em `src/App.tsx` (`<Route path=...>`).
- Enumeração de páginas em `src/pages/**`.
- Enumeração de componentes por diretório em `src/components/**`.
- Enumeração de hooks em `src/hooks/**`.
- Enumeração de services em `src/services/**`.
- Enumeração de edge functions em `supabase/functions/**`.
- Busca estática por padrões de hardcode (LEGAL, Eventrix, XGO, BLUE, WiFi, IMEI, ICCID, expositor, pavilhão, etc.).
- Consulta a documentação prévia:
  - `docs/product/noid-revenueos-for-events-product-fit-audit-v1.1.md`
  - `docs/product/noid-revenueos-for-events-capability-matrix-v1.csv`
  - `docs/security/security-go-conditional-single-project-v1.md`

Nenhum registro real de negócio foi lido.

## 3. Totais macro

| Superfície | Total | Fonte |
|---|---|---|
| Rotas declaradas em `App.tsx` | 177 | `rg -c 'path=\"' src/App.tsx` |
| Rotas únicas | ~180 (inclui admin submenu) | consolidação manual |
| Páginas em `src/pages/**` | ~140 | `find src/pages -name '*.tsx'` |
| Diretórios de componentes | 130+ | `find src/components -type d` |
| Edge Functions | 272 | `ls supabase/functions | wc -l` |
| Migrations aplicadas | 720 | `ls supabase/migrations | wc -l` |
| Tabelas em `public` | 413 (100% RLS) | NSEC-1.2 baseline |
| Policies RLS | 1.049 | NSEC-1.2 baseline |
| SECURITY DEFINER funcs | 379 | NSEC-1.2 baseline |

## 4. Inventário por área

### 4.1 CRM Core (CORE_UNIVERSAL candidato)

Rotas principais: `/app/dashboard`, `/app/accounts`, `/app/accounts/:id`, `/app/contacts` (não exposta direta — Contacts embutido em Accounts), `/app/opportunities`, `/app/opportunities/:id`, `/app/activities`, `/app/leads`.

Serviços chave:
- `src/services/supabase/accounts.ts`
- `src/services/supabase/contacts.ts`
- `src/services/supabase/opportunities.ts`
- `src/services/supabase/activities.ts`
- `src/services/crm/*` (barrel re-exports)

Hooks: `useOpportunities`, `useAccounts`, `useContacts`, `useCurrentUser`, `useSellerRole`, `usePermissions`.

Backend: tabelas `accounts`, `contacts`, `opportunities`, `activities`, `pipelines`, `stages`, `deal_participants`, `timeline_events`, `interactions`, `tags`, `opportunity_tags`.

Estado: **Alta maturidade tenant-aware** (RLS + `nsec12_*` guards). Vocabulário genérico B2B. Sem LEGAL hardcode direto no serviço.

### 4.2 Propostas e contratos

Rotas: `/app/proposals`, `/app/proposals/new`, `/app/proposals/:id/edit`, `/app/contracts`, públicas `/p/:token`, `/public/proposal/:token`.

Componentes: `src/components/proposals/**` (analytics, layouts, PDF, público).

Serviços: `src/services/proposals/**` (11 arquivos), `src/services/supabase/proposals.ts`.

Backend: `proposals`, `proposal_items`, `proposal_payment_terms`, `proposal_templates`, `proposal_layouts`, `proposal_layout_pages`, `proposal_views`, `proposal_alerts`, `proposal_dynamic_pricing_*`, `proposal_financial_audit_*`, `proposal_inventory_demand_snapshots`.

Estado: **CORE_UNIVERSAL com um único LEGAL_HARDCODE textual** em `src/components/proposals/PublicProposalApprovedScreen.tsx:233` ("A cobrança será enviada pela equipe LEGAL conforme a condição aprovada").

### 4.3 Produtos e catálogo

Rotas: `/app/products`, `/app/products/new`, `/app/products/:id/edit`, `/app/settings/product-settings`, `/app/settings/product-categories`.

Componentes:
- `src/components/products/ProductInventoryRequirementsEditor.tsx` — **acoplado a Eventrix** (`eventrix_category_id`, `eventrix_family_id`).
- `src/components/products/ProductBOMEditor.tsx` — texto "categorias e famílias do Eventrix".

Backend: `products`, `product_categories`, `product_price_history`, `product_bom_items`, `product_inventory_requirements` (com FKs para IDs Eventrix).

Estado: **Configurável (TENANT_CONFIG parcial) + OPTIONAL_INTEGRATION acoplada como se fosse obrigatória.**

### 4.4 Pricing dinâmico

Rotas: `/app/settings/pricing-factor-rules`.
Backend: `proposal_dynamic_pricing_rules`, `proposal_dynamic_pricing_tiers`, `proposal_dynamic_pricing_factor_rules`, `proposal_dynamic_pricing_events`.
Estado: TENANT_CONFIG com engine genérica; regras vertical-específicas (metragem, cobertura) ainda não abstraídas — reside no cliente.

### 4.5 Revenue Command, Forecast, Win/Loss, OTE

Rotas: `/app/revenue-command`, `/app/forecast`, `/app/intelligence/winloss`, `/app/reports/ote`, `/app/objetivos/desempenho`, `/app/scoring`.

Backend: `forecast_snapshots`, `forecast_daily_snapshots`, `forecast_predictions`, `commercial_won_revenue_view`, `commission_eligibility_view`, `v_report_forecast_v2`, `ote_*`, `winloss_*`, `loss_reasons`, `win_reasons`.

Estado: **CORE_UNIVERSAL**. Regras SSoT já centralizadas (memória `revenue-single-source-of-truth`). Sem hardcode LEGAL.

### 4.6 Intelligence / IA / Kairós

Rotas: `/app/intelligence/kairos`, `/app/intelligence/apollo-roi`, `/app/intelligence/experiments`, `/app/intelligence/graph`, `/app/intelligence/memories`, `/app/intelligence/optimization`, `/app/intelligence/playbooks`, `/app/intelligence/skills/*`, `/app/intelligence/vibe`, `/app/intelligence/winloss`.

Serviços: `src/services/ai-agents/**`, `src/services/intelligence/**`, `src/services/enrichment/**`.

Backend: `ai_agents`, `ai_agent_versions`, `ai_agent_execution_runs`, `kairos_*`, `apollo_*`, `experiment_*`, `graph_*`, `memories`, `ai_*` (18+ tabelas).

Estado: **CORE_UNIVERSAL** (orquestração agnóstica) + **VERTICAL_PACK candidato** para playbooks/skills/prompts específicos.

### 4.7 Automations, Sequences, Notifications

Rotas: `/app/automation`, `/app/email-templates`, `/app/notifications`, `/app/settings/celebracoes`.
Backend: `workflow_rules`, `workflow_executions`, `sequences`, `sequence_enrollments`, `notifications_v2`, `notification_events`.
Estado: CORE_UNIVERSAL. Regras verticais LEGAL não codificadas (usuário-configuráveis).

### 4.8 Academy / Roleplay / Copilot

Rotas: `/app/roleplay`, `/app/roleplay/*` (10 subrotas).
Serviços: `src/services/roleplay/**`, `src/services/sales-coach/**`.
Backend: `roleplay_sessions`, `roleplay_messages`, `client_archetypes`, `simulated_clients`, `evaluation_rubrics`.

**VERTICAL_PACK evidente:** `src/services/roleplay/archetypes.ts:6` e `src/schemas/roleplay.ts:17` restringem archetype type a `'Organizador' | 'Expositor' | 'Agência' | 'Empresa Contratante'` — vocabulário do setor de eventos.

### 4.9 Inventory / Operações

Rotas: `/app/operations/inventory`, `/app/operations/inventory/*`, `/app/settings/eventrix-inventory`, `/app/settings/noid-inventory-backup`.

Componentes: `src/components/operations/inventory/**`.

Serviços: `src/services/operations/**` (inventoryAllocations, categories, families, locations, occupancy, overview, pricing).

Backend: `inventory_items`, `inventory_families`, `inventory_categories`, `inventory_locations`, `inventory_movements`, `inventory_reservations`, `inventory_pre_reservations`, `inventory_pricing_rules`, `product_inventory_requirements`, `eventrix_inventory_integration_settings`, `eventrix_inventory_sync_cache`.

**Fortemente vertical-conectividade:** `src/lib/operations/inventoryEquipmentProfile.ts` codifica schema JSONB de router (IMEI, SSID, senha WiFi), sim_card (ICCID, APN), etc. Isso é **VERTICAL_PACK Conectividade LEGAL**, não CORE.

### 4.10 Settings / Administração

Rotas: `/app/settings/**` (~55 rotas). Inclui Business Units, Industries, Custom Fields, Custom Forms, Permissions, Teams, Users, Pipelines, Loss Reasons, Origins, Tags, Product Settings, Proposal Settings/Templates/Layouts, Sales Config, Seller Targets, Qualification, Notifications, Integrations, API Keys, Data Management, Security, Billing, Noid Intelligence (18 subrotas).

Estado: TENANT_CONFIG. Nível de maturidade heterogêneo — ver `noid-tenant-config-maturity-v1.csv`.

### 4.11 Admin / Control Plane

Rotas: `/admin`, `/admin/*` (~20 rotas via `src/components/admin/AdminSidebar.tsx`).
Estado: candidato a **NOID CONTROL PLANE** na arquitetura-alvo. Já isolado do CRM tenant.

### 4.12 GTM dashboards

Rotas: `/app/gtm/{ae,ceo,cs,manager,revops,sdr}`.
Estado: CORE_UNIVERSAL com routing por `seller_role`.

### 4.13 Community, Docs, Support, Release Notes

Rotas: `/app/community`, `/app/support`, `/app/docs`, `/app/release-notes`, `/docs/*` (público).
Estado: CORE_UNIVERSAL / OPTIONAL.

## 5. Eventos — o que já existe

Não existe hoje entidade dedicada `events` / `event_editions` / `venues` / `organizers` / `exhibitors` no schema `public`. As referências a "evento" estão dispersas em:

- Campos livres em `opportunities` (custom fields).
- Vocabulário em roleplay archetypes.
- Contexto operacional em `inventory_reservations` (datas de montagem/desmontagem inferidas).

Detalhe pleno em `noid-event-core-gap-analysis-v1.md`.

## 6. Estado por área — resumo

| Área | Classificação primária | Maturidade tenant-aware (0–4) |
|---|---|---|
| CRM Core | CORE_UNIVERSAL | 3 |
| Propostas | CORE_UNIVERSAL | 3 (com 1 hardcode texto) |
| Produtos | TENANT_CONFIG + OPTIONAL_INTEGRATION | 2 |
| Pricing Rules | TENANT_CONFIG | 3 |
| Revenue Command / Forecast / OTE | CORE_UNIVERSAL | 3 |
| Win/Loss | CORE_UNIVERSAL | 3 |
| Intelligence / IA | CORE_UNIVERSAL + VERTICAL_PACK (conteúdo) | 3 |
| Automations / Sequences | CORE_UNIVERSAL | 3 |
| Roleplay / Academy | CORE_UNIVERSAL (engine) + VERTICAL_PACK (archetypes) | 2 |
| Inventory | VERTICAL_PACK + OPTIONAL_INTEGRATION | 1 |
| Settings | TENANT_CONFIG | 2–3 |
| Admin | CONTROL_PLANE candidato | n/a |
| GTM dashboards | CORE_UNIVERSAL | 3 |
| Community / Docs / Support | CORE_UNIVERSAL | 3 |

Detalhes por módulo em `noid-module-classification-v1.csv`.

## 7. Referências cruzadas

- Classificação módulo a módulo: `noid-module-classification-v1.csv`
- Hardcodes com evidência: `legal-hardcodes-register-v1.csv`
- Dependências Eventrix: `noid-eventrix-dependency-map-v1.md`
- Gap Event Core: `noid-event-core-gap-analysis-v1.md`
- Maturidade config tenant: `noid-tenant-config-maturity-v1.csv`
- Relatório executivo + Gate 1: `noid-vertical-readiness-executive-report-v1.md`
