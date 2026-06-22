# KAI.18 — Smart Coverage Engine

Diagnostica o que já existe no NOID sobre uma empresa **antes** de gastar Apollo/SDR/tempo. Score 0–100 + classe + recomendação acionável. Bloqueia Apollo quando cobertura ≥ 90.

## Arquitetura

```text
Prospect → Coverage (NOID lookup) → Decisão → Apollo (se necessário) → Qualified Queue
```

Coverage é **leitura-only** sobre tabelas existentes (`accounts`, `contacts`, `opportunities`, `proposals`, `enriched_contact_profiles`, `commercial_won_revenue_view`). Não cria/edita CRM. Não toca Forecast, OTE, Revenue Command.

## 1. Banco

### Nova tabela `kairos_coverage_analysis`
- Identificação: `organization_id`, `prospect_id` (FK), `account_id` (nullable), `company_name`, `normalized_domain`, `cnpj`
- Flags: `account_exists`, `contact_exists` (`none|partial|complete`), `decision_maker_exists` (`found|partial|absent`), `phone_exists`, `whatsapp_ready` (`ready|unknown`), `opportunity_status` (`open|won|lost|none`), `proposal_status` (`sent|viewed|accepted|declined|none`), `customer_status` (`active|former|never`)
- Score: `coverage_score` (int), `coverage_class` (`complete|good|partial|weak|new`)
- Output: `missing_items` (jsonb array), `recommendations` (jsonb array), `next_best_action` (text), `apollo_blocked` (bool)
- Metadados: `analyzed_at`, `expires_at` (default `now() + 24h` para cache), `signature` (hash dos inputs)
- Índices: `(prospect_id, analyzed_at desc)`, `(organization_id, coverage_class)`, unique `(prospect_id, signature)`
- RLS: org members read; service_role write. Grants padrão.

### Alterações em tabelas existentes
- `kairos_qualified_queue`: adicionar `coverage_score int`, `coverage_class text`, `missing_items jsonb`, `next_best_action text`
- `kairos_revenue_attribution`: adicionar `coverage_score_at_capture int`, `coverage_class_at_capture text` (snapshot imutável)
- `apollo_auto_enrichment_rules`: adicionar `min_coverage_gap_score int default 30` (só dispara Apollo se cobertura < 70 OU faltar dado solicitado)

## 2. Edge Function `kairos-analyze-coverage`

Input: `{ prospect_id, force_refresh?: boolean }`

Fluxo:
1. Carrega `prospects` row (organization_id, company_name, normalized_domain, cnpj)
2. Cache: se existe análise < 24h e `!force_refresh`, retorna
3. Match de conta:
   - CNPJ exato em `accounts.cnpj`
   - Domínio em `accounts.website`/`accounts.normalized_domain`
   - `pg_trgm` em `accounts.razao_social`/`nome_fantasia` (≥ 0.7)
4. Se conta existe:
   - `contacts` da conta → conta total + filtragem por `department`/`role` dos 6 departamentos LEGAL
   - `opportunities` mais recente por status (open/won/lost via `closed_at`)
   - `proposals` mais recente (sent/viewed/accepted/declined)
   - `commercial_won_revenue_view` → `customer_status` (active = won < 12m, former = won ≥ 12m, never)
   - `phone_exists` = qualquer contact com phone NOT NULL
   - `whatsapp_ready` = phone começa com `+55` celular (heurística: 9 dígitos após DDD)
5. Se conta NÃO existe: também olhar `enriched_contact_profiles` pelo prospect_id (já enriquecido fora do CRM)
6. Calcula score (pesos da spec: 10+15+20+20+10+10+5+10 = 100)
7. Define classe: ≥90 complete | 70–89 good | 40–69 partial | 20–39 weak | <20 new
8. Monta `missing_items` (lista textual: "Head de Marketing", "Telefone celular", etc.)
9. `recommendations`: derivadas das lacunas (`reveal_phone`, `find_decision_maker`, `create_opportunity`, `reactivate_relationship`, `none`)
10. `apollo_blocked = coverage_score >= 90`
11. Upsert em `kairos_coverage_analysis` (por `prospect_id + signature`)
12. Atualiza `kairos_qualified_queue` (coverage_score/class/missing/next_best_action) se houver linha
13. Retorna `{ score, class, missing, recommendation, apollo_blocked, analysis_id }`

Output: `{ score: 72, class: "good", missing: [...], recommendation: "reveal_phone", apollo_blocked: false }`

## 3. Integração Apollo (governance gate)

Em `kairos-apollo-reveal-contact` e `kairos-apollo-invisible`:
- **Antes** de chamar Apollo, invocar `kairos-analyze-coverage` (ou ler análise cacheada do prospect)
- Se `apollo_blocked` = true → retornar `{ status: "skipped", reason: "coverage_complete" }`, registrar em `apollo_reveal_audit` com `reason="coverage_complete"`, **0 crédito gasto**
- Se cobertura `good` (70–89) e o dado pedido já existe (ex: phone_exists e pedido = phone) → skip também
- Em `kairos-apollo-invisible` (autopilot batch): rodar coverage **primeiro** para cada prospect do lote; pular Apollo para os bloqueados; emitir `revenue_events: apollo_skipped_by_coverage` com `credits_saved`

## 4. Frontend

### Badge nos resultados (sourcing)
- `src/components/intelligence/sourcing/ProspectCard.tsx` (ou similar): adicionar badge ao lado do nome
- Cores: 🟢 complete/good, 🟡 partial, 🟠 weak, 🔴 new
- Hook `useCoverageAnalysis(prospect_id)` (React Query, staleTime 5min)

### Drawer aba "Smart Coverage"
- Novo componente `SmartCoverageTab.tsx` no drawer do prospect/account
- Seções: **O que temos** (lista ✅), **O que falta** (lista ❌), **Recomendação** (botão CTA conforme `next_best_action`)
- Botão "Recalcular cobertura" (chama com `force_refresh: true`)

### Qualified Queue
- Coluna nova: badge de coverage + tooltip com missing_items
- Ordenação por coverage_class disponível

### Settings/Apollo Governance
- Card "Smart Coverage" em `ApolloInvisibleSettingsCard.tsx`: toggle "Bloquear Apollo quando cobertura ≥ 90" (já default true) + slider `min_coverage_gap_score`

## 5. KPIs (ApolloRoi + KairosHub)

Adicionar painel "Smart Coverage":
- Empresas analisadas (período)
- Distribuição por classe (donut)
- Apollo evitado (count)
- Créditos economizados (sum estimado: 1 por reveal evitado)
- Telefones/decisores faltantes (gaps)

Fonte: queries agregadas sobre `kairos_coverage_analysis` + `apollo_reveal_audit` (rows com `reason='coverage_complete'`).

## 6. Revenue Attribution

Trigger ou hook no enfileiramento da queue: copiar `coverage_score`/`coverage_class` para `kairos_revenue_attribution.coverage_score_at_capture`/`coverage_class_at_capture` (snapshot imutável). Permite análise futura: "leads com cobertura alta convertem mais?".

## Critérios de aceite

- [x] Cada prospect recebe score 0–100 via `kairos-analyze-coverage`
- [x] Badge colorido aparece nos resultados de sourcing
- [x] Drawer "Smart Coverage" lista temos/falta/recomendação
- [x] Apollo reveal e Apollo invisible consultam coverage antes de gastar crédito
- [x] `coverage_score ≥ 90` bloqueia Apollo com mensagem padronizada e 0 crédito
- [x] `kairos_qualified_queue` recebe coverage_score/class/missing/next_best_action
- [x] `kairos_revenue_attribution` recebe snapshot de cobertura na captura
- [x] Painel "Créditos economizados" disponível em ApolloRoi
- [x] Zero alteração em CRM (accounts/opportunities/proposals), Forecast, OTE, Revenue Command (apenas leitura)

## Risco / fora de escopo

- **Não** cria contas/contatos/oportunidades automaticamente — só recomenda.
- **Não** sobrescreve dados do CRM com dados Apollo.
- Heurística WhatsApp = celular brasileiro; refinar depois com validação real.
- Match account por trigram pode dar falso positivo; threshold conservador (0.7) + log para auditoria.
- Migração só adiciona colunas opcionais; código antigo continua funcionando.

## Arquivos previstos

- 1 migração SQL (nova tabela + colunas em 3 tabelas existentes + grants/RLS/índices)
- 1 nova edge function `kairos-analyze-coverage/index.ts`
- 2 edge functions editadas (gate Apollo): `kairos-apollo-reveal-contact`, `kairos-apollo-invisible`
- 1 hook novo `useCoverageAnalysis.ts`
- 1 service `coverageService.ts`
- 3 componentes UI: `CoverageBadge.tsx`, `SmartCoverageTab.tsx`, atualização em `ProspectCard` + Qualified Queue + ApolloInvisibleSettingsCard
- Atualizações em `ApolloRoi.tsx` (painel novo) e `KairosHub.tsx` (KPIs)
- Memória: 1 entrada em `mem://architectural-decision/intelligence/smart-coverage-engine`
