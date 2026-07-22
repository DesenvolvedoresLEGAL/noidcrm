# NOID RevenueOS — Vertical Readiness Executive Report v1

**Sprint:** `NOID-VERTICAL-1.0-VERT-01.1`
**Change ID:** VERT-01.1
**Data:** 2026-07-22
**Modo:** Read-only, documental.
**Autor:** Agente Lovable (auditoria estática).

---

## 1. Resumo executivo

O NOID RevenueOS chega ao início da verticalização em **estado majoritariamente favorável** à transição para o modelo **CORE_UNIVERSAL + EVENT_CORE + VERTICAL_PACKS + TENANT_CONFIG + OPTIONAL_INTEGRATIONS + CONTROL_PLANE**. A base de CRM, Propostas, Forecast, Revenue Command, OTE, Win/Loss, Intelligence, Automations, GTM dashboards e Admin já opera com nomenclatura genérica B2B, RLS tenant-aware homologado no programa NSEC-1.2 e sem hardcodes funcionais críticos ligados à LEGAL.

Os acoplamentos vertical/LEGAL residem em três clusters bem delimitados:

1. **Inventory + Products + Proposals inventory demand** acoplados ao Eventrix como se fosse dependência obrigatória (deveria ser `OPTIONAL_INTEGRATION`).
2. **Roleplay archetypes** com enums literais do setor de eventos (`Organizador | Expositor | Agência | Empresa Contratante`) — deve virar seed do pack Events.
3. **Schema de equipamento** (IMEI/ICCID/SSID/WiFi) em `inventoryEquipmentProfile.ts` — é o pack Conectividade LEGAL, não Core.

Adicionalmente, o **Event Core não existe** como camada modelada — as entidades event/edition/venue/organizer/exhibitor estão dispersas em custom fields, archetypes e campos livres de `opportunities`. Sua construção é pré-requisito para operar múltiplos verticais de eventos com ROI por evento, coortes por edição e multi-event contracts.

Um único hardcode textual literal LEGAL foi identificado: `PublicProposalApprovedScreen.tsx:233`. Todos os demais são acoplamentos de nomenclatura de integração (Eventrix) ou vocabulário vertical (eventos), não código específico da empresa LEGAL.

**Decisão:** `GATE 1 — VERTICAL READINESS APPROVED WITH BLOCKERS`.

## 2. Escopo

Fases A–J do runbook VERT-01.1. Nenhuma alteração de código, banco, RLS, migration, edge function, storage ou publish foi realizada. Apenas artefatos em `docs/vertical/` foram criados.

## 3. Metodologia

- Enumeração via `rg` de rotas, componentes, hooks, services, edge functions.
- Consulta a metadados prévios (NSEC-1.2, Product Fit Audit v1.1, memórias).
- Busca por padrões de hardcode (empresa, marcas, produtos, integração, vocabulário vertical).
- Cruzamento com decisões arquiteturais registradas em memory index.

Nenhuma consulta a registros reais de negócio foi executada.

## 4. Arquitetura atual (evidência)

```text
┌───────────────────────────────────────────────────────────────┐
│                     NOID RevenueOS (atual)                    │
├───────────────────────────────────────────────────────────────┤
│  Admin / Control Plane  ← 20 rotas /admin/*                   │
├───────────────────────────────────────────────────────────────┤
│  CRM Core (genérico B2B, RLS + nsec12 guards)                 │
│    accounts • contacts • opportunities • activities • leads   │
│    pipelines • stages • timeline • tags • deal_participants   │
├───────────────────────────────────────────────────────────────┤
│  Propostas / Contratos (CORE, 1 hardcode texto)               │
│  Forecast / Revenue Command / War Room / Win-Loss / OTE       │
│  Intelligence (Kairós, Apollo, Experiments, Skills, Vibe)     │
│  Automations / Sequences / Notifications / Email templates    │
│  GTM Dashboards (CEO, AE, SDR, Manager, CS, RevOps)           │
│  Community / Docs / Support / Release Notes                   │
├───────────────────────────────────────────────────────────────┤
│  Settings tenant-config (~55 rotas)                           │
│    pipelines · custom fields/forms · qualification · roles    │
│    products · pricing · templates · layouts · loss reasons    │
├───────────────────────────────────────────────────────────────┤
│  ACOPLAMENTOS VERTICAIS (violam target):                      │
│    Products ⇢ Eventrix (obrigatório hoje)                     │
│    Proposals inventory demand ⇢ Eventrix                      │
│    Roleplay archetypes ⇢ enum literal eventos                 │
│    Inventory equipment schema ⇢ IMEI/ICCID/WiFi (conectiv.)   │
│                                                               │
│  OUT-OF-BAND: Event Core NÃO existe formalmente               │
└───────────────────────────────────────────────────────────────┘
```

## 5. Arquitetura-alvo

```text
┌──────────────── NOID Control Plane (multi-tenant admin) ─────────────────┐
│                                                                          │
│  ┌─────────── CORE_UNIVERSAL ───────────┐  ┌── EVENT_CORE (novo) ───┐    │
│  │ CRM • Proposals • Contracts • Fcst  │  │ events • editions      │    │
│  │ Rev Command • Win/Loss • OTE        │◄─┤ venues • organizers    │    │
│  │ Automations • Notifications         │  │ exhibitors • agencies  │    │
│  │ Intelligence engine (agents/tools)  │  │ event_roles • parts    │    │
│  │ GTM dashboards • Reports • Academy  │  └────────────────────────┘    │
│  └─────────────────────────────────────┘                                 │
│                    ▲                              ▲                      │
│                    │                              │                      │
│  ┌──────── TENANT_CONFIG (per-org) ──────┐  ┌─ VERTICAL_PACKS ────────┐  │
│  │ pipelines/stages · custom fields/forms│  │ pack:conectividade      │  │
│  │ qualification · loss reasons · goals  │  │ pack:audiovisual        │  │
│  │ ote · pricing rules · templates       │  │ pack:iluminacao         │  │
│  │ permissions · integrations flags      │  │ pack:cenografia         │  │
│  │ ai prompts (versioned/audited)        │  │ pack:catering           │  │
│  └───────────────────────────────────────┘  │ pack:logistica ...      │  │
│                                             └─────────────────────────┘  │
│                                                                          │
│  ┌─────────────────── OPTIONAL_INTEGRATIONS ─────────────────────────┐   │
│  │ Eventrix (inventory) · ERPs · WhatsApp · Calendar · Payments      │   │
│  │ Apollo · ExpoFP · Firecrawl · Slack · SMTP · OAuth providers      │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

## 6. Módulos por estado

- **Prontos (CORE_UNIVERSAL, maturidade ≥3):** Dashboard, Accounts, Contacts, Opportunities, Activities, Leads, Contracts, Forecast, Revenue Command, War Room, Win/Loss, Scoring, OTE, Automation, Sequences, Notifications, Email Templates, Kairós, Apollo ROI, Experiments, Optimization, Knowledge Graph, Memories, Playbooks (engine), Skills (engine), Vibe, Noid Intelligence, GTM dashboards (6), AI Operations, Community, Support, Docs, Release Notes, Financial Audit, Public Proposal (menos hardcode texto), Public Form, Auth, Admin Control Plane. **~75 módulos.**
- **Parcialmente prontos (2–3, precisam pack seeds/versioning):** Pricing Rules, Proposal Templates/Layouts, Sales Config, Seller Targets, Qualification Framework, Custom Fields/Forms, Business Units, Industries, Origins, Tags, Loss/Win Reasons, Permissions, Territories.
- **Exigem refatoração (acoplamento a corrigir):** Products, Product Editor, Product BOM Editor, Proposal Inventory Demand Preview/Snapshot, Eventrix Inventory Settings, Roleplay archetypes.
- **Exigem reconstrução (VERTICAL_PACK):** Inventory Equipment Profile (schema IMEI/ICCID/WiFi), Noid Inventory Backup (schema pack).
- **Não existem (a criar em sprint dedicada):** Event Core inteiro (events, editions, venues, organizers, exhibitors, agencies, event_roles, event_participants).

## 7. Principais hardcodes (top 10)

Ver `legal-hardcodes-register-v1.csv` para lista completa (20 identificados).

1. HC-006 — `inventoryEquipmentProfile.ts` (schema IMEI/ICCID/WiFi obrigatório) — HIGH, VERTICAL_PACK.
2. HC-002 — `ProductInventoryRequirementsEditor` (Eventrix category/family obrigatório) — HIGH, OPTIONAL_INTEGRATION violada.
3. HC-004/HC-005 — Roleplay archetypes enum literal eventos — HIGH, VERTICAL_PACK.
4. HC-008 — `eventrixInventorySettings.ts` schema acoplado — HIGH, OPTIONAL_INTEGRATION.
5. HC-018 — Enum Postgres com `'Expositor'` — MEDIUM, VERTICAL_PACK.
6. HC-020 — ExpoFP provider embutido em `lead-sourcing` — MEDIUM, VERTICAL_PACK.
7. HC-011/HC-012 — Inventory demand snapshot/preview vinculado a Eventrix — MEDIUM.
8. HC-001 — Texto "equipe LEGAL" em `PublicProposalApprovedScreen.tsx:233` — MEDIUM, único hardcode literal LEGAL.
9. HC-003 — Texto "Eventrix" em BOM editor — MEDIUM.
10. HC-009 — Rota `/app/settings/eventrix-inventory` nomeada por provider — MEDIUM.

Distribuição por severidade: **BLOCKER 0 · HIGH 6 · MEDIUM 10 · LOW 4**.

Nenhum BLOCKER significa que **não existe regra funcional exclusiva LEGAL codificada globalmente** (nenhuma condição do tipo "if organization_id = 'LEGAL_UUID'", nenhum produto obrigatório LEGAL, nenhum pipeline hardcoded, nenhum stage hardcoded). Isso é um resultado excelente.

## 8. Principais dependências

- **Eventrix:** 17 arquivos, 258 ocorrências, todas concentradas em Products/Inventory/Proposals-inventory-demand. Zero em CRM, Forecast, Revenue Command, Win/Loss, OTE, Automations, Auth. **Violação estrutural apenas em Products.**
- **ExpoFP:** provider único em Kairós sourcing (opcional por padrão).
- **Apollo:** já modelado como `OPTIONAL_INTEGRATION` com gateway + ROI + audit.
- **Nenhuma dependência LEGAL** de infraestrutura, DNS, storage, DB ou secrets identificada.

## 9. Estado da configurabilidade por tenant

Média ponderada: **~2.8 / 4**.

- **Nível 4 (pack-ready):** apenas `ai_prompts` (via `ai_agent_versions` + audit + publish history).
- **Nível 3 (isolado, configurável, sem hardcode LEGAL):** ~60% dos capabilities (pipelines, custom fields, permissions, automations, loss/win reasons, templates, sales config, integrations).
- **Nível 2 (configurável sem versionamento):** ~30% (product settings, pricing, layouts, dashboards, reports).
- **Nível 1 (filtrado por tenant, comportamento fixo):** inventory_provider (só Eventrix), roleplay_archetypes.
- **Nível 0 (global/hardcoded):** inventory_equipment_schema.

Detalhamento em `noid-tenant-config-maturity-v1.csv`.

## 10. Estado do Event Core

**Não existe.** Nenhuma tabela dedicada. Vocabulário disperso em roleplay, sourcing e custom fields. Multi-event contracts inviável. ROI por evento não estruturado.

Recomendação: criar `EVENT_CORE` como camada primeira do NOID (não delegado ao Eventrix). Detalhes em `noid-event-core-gap-analysis-v1.md`.

## 11. Riscos

| ID | Risco | Severidade |
|---|---|---|
| R-01 | Sem Event Core, verticalização de eventos entrega valor limitado | HIGH |
| R-02 | Products acoplado a Eventrix bloqueia onboarding de tenants não-conectividade | HIGH |
| R-03 | Roleplay archetypes travados no vertical eventos → não serve outros B2B | MEDIUM |
| R-04 | Inventory equipment schema é hard-coded para conectividade → precisa pack | HIGH |
| R-05 | Vocabulário "Eventrix" exposto ao usuário (rotas, hooks, tabelas) | MEDIUM |
| R-06 | Ausência de Pack Engine formal (instalação, versionamento, override, rollback) | HIGH |
| R-07 | 720 migrations acumuladas → alto custo cognitivo para mover schema Eventrix→genérico | MEDIUM |
| R-08 | Fluxo Kairós/ExpoFP entrega "expositor" sem persistir vínculo estruturado com Event | HIGH |
| R-09 | Único hardcode textual LEGAL em `PublicProposalApprovedScreen` — trivial de corrigir mas embaraçoso se escapar | LOW |
| R-10 | Herança NSEC-1.2 GO CONDICIONAL preserva SEC-005/006/008/009 → não bloqueia verticalização mas convive | MEDIUM |

## 12. Oportunidades

- **Base CRM já genérica**: 75+ módulos prontos ou quase prontos para reuso multi-vertical.
- **Intelligence Hub** (`ai_agents` + versioning + audit + publish) é referência de maturidade para o resto do produto.
- **NSEC-1.2 concluído** — segurança tenant-aware homologada; verticalização não precisa disputar prioridade com hardening.
- **Admin já é Control Plane**: 20 rotas isoladas com AdminLayout separado.
- **Eventrix é integração** e não fundação — desacoplá-lo é caro em nomenclatura, barato em regra de negócio.
- **Poucos hardcodes literais LEGAL** — o produto nasceu na LEGAL mas evitou codificar a LEGAL.

## 13. Ordem recomendada de migração

**Sprint VERT-01.2** — Desacoplar Products/Proposals ↔ Eventrix (introduzir `InventoryProviderAdapter`, renomear rotas/hooks/schemas, manter Eventrix como um dos providers).

**Sprint VERT-01.3** — Extrair pack Conectividade LEGAL (schemas IMEI/ICCID/WiFi, labels, ExpoFP provider) para módulo instalável.

**Sprint VERT-02.1** — Criar Event Core (`events`, `event_editions`, `venues`, `event_roles`, `event_participants`; FK opcional em `opportunities`).

**Sprint VERT-02.2** — Migrar roleplay archetypes para `event_roles` seed; enum `Expositor` para lookup.

**Sprint VERT-03.1** — Pack Engine formal (instalação, versão, override tenant, rollback, defaults vs custom).

**Sprint VERT-03.2** — Seed dos primeiros packs verticais (Conectividade, Audiovisual, Cenografia) usando o engine.

**Sprint VERT-04.1** — Cleanup: remover hardcode texto "equipe LEGAL", renomear tabelas/rotas com nome de provider, feature flags por tenant/pack.

Nenhuma dessas sprints deve iniciar sem aprovação humana do presente relatório.

## 14. Gate 1

**Decisão:** `GATE 1 — VERTICAL READINESS APPROVED WITH BLOCKERS`.

Justificativa:
- ✅ Inventário completo (rotas, módulos, componentes relevantes, backend por metadados, hardcodes com evidência).
- ✅ Arquitetura-alvo adotável incrementalmente sem big-bang.
- ✅ Hardcodes críticos totalmente mapeados; nenhum BLOCKER.
- ⚠️ Existem 6 hardcodes HIGH (Eventrix Products + Roleplay archetypes + Inventory equipment schema) que exigem refatoração **antes** dos packs verticais.
- ⚠️ Event Core inexistente exige sprint dedicada antes de habilitar múltiplos verticais.

## 15. Recomendação da próxima sprint

`VERT-01.2 — Desacoplamento Products ↔ Eventrix (InventoryProviderAdapter)`.

Escopo mínimo (a definir formalmente em runbook próprio):
- Introduzir contrato `InventoryProviderAdapter`.
- Implementar `NativeInventoryProvider` (fallback) e `EventrixInventoryProvider` (existente refatorado).
- Renomear (com alias/redirect) `eventrix_inventory_integration_settings` → `inventory_provider_settings` (nova coluna `provider_type`).
- Renomear rota/hook/schema Eventrix → genérico.
- Feature flag por tenant escolhendo provider ativo; default = `native`.
- Manter compatibilidade com dados atuais da LEGAL.

Sem alterar Event Core (fica para VERT-02.1) e sem tocar em regras SSoT de receita.

## 16. Artefatos criados nesta sprint

1. `docs/vertical/noid-current-product-inventory-v1.md`
2. `docs/vertical/noid-module-classification-v1.csv`
3. `docs/vertical/legal-hardcodes-register-v1.csv`
4. `docs/vertical/noid-eventrix-dependency-map-v1.md`
5. `docs/vertical/noid-event-core-gap-analysis-v1.md`
6. `docs/vertical/noid-tenant-config-maturity-v1.csv`
7. `docs/vertical/noid-vertical-readiness-executive-report-v1.md` (este arquivo)

## 17. Confirmações finais

- Nenhum código de aplicação foi alterado.
- Nenhum arquivo em `src/`, `supabase/`, `scripts/`, `functions/`, `migrations/`, `package.json` ou configuração foi tocado.
- Nenhuma migration foi criada.
- Nenhuma RPC foi criada ou alterada.
- Nenhuma Edge Function foi criada ou alterada.
- Nenhuma policy RLS foi alterada.
- Nenhum bucket foi criado ou alterado.
- Nenhum dado real de negócio foi lido.
- Nenhum publish ou deploy foi executado.
- Todas as alterações estão contidas em `docs/vertical/`.
