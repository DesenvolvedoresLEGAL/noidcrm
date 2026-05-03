## Sprint Scoring 1.4 — Revenue Hygiene Engine (NRHS v1)

### Diagnóstico do que está quebrado hoje

Auditoria do schema/código mostrou:

- `opportunities` já tem `nrhs_score`, `nrhs_tier`, `nrhs_breakdown`, `nrhs_blockers`, `nrhs_issues_count`, `nrhs_last_calculated_at` (Sprint 1.3).
- Existe `score_history`, `nrhs_events`, view `v_opportunities_hygiene_base` e edge `calculate-nrhs` — mas só funciona via mutação manual (`useNRHS.recalculate`), sem fila, sem triggers, sem cron.
- A causa direta da aba zerada: `fetchNRHSDeals` filtra `status IN ('open','negotiation','proposal')`, porém os 278 deals abertos do projeto têm status `'new'` ou `'open'` apenas. Status `'negotiation'/'proposal'` não existem na enum.
- A fórmula atual usa pesos % (30/25/20/15/10) e tier `elite>=90`, divergente da spec v1 (pontos absolutos somados, sem tier elite, com penalidades negativas).
- Pilares “Win/Loss” e “Evidências” não existem como colunas separadas — só dentro de `nrhs_breakdown`.
- Não há `forecast_hygiene_eligible` / `ote_hygiene_eligible`, fila `nrhs_recalc_queue`, triggers de enqueue, processador cron, hook realtime, helper de invalidação, nem learning signals separados.

A spec pede que a fórmula seja v1 “oficial” (pontos absolutos), portanto vamos consolidar o motor todo nessa convenção e migrar a UI/breakdown.

---

### Escopo da entrega

#### 1. Migration de schema (`supabase/migrations/...`)

- Adicionar colunas em `opportunities` (mantendo `nrhs_score`, `nrhs_tier`, `nrhs_blockers`, `nrhs_breakdown` existentes — apenas reusar):
  - `nrhs_status text` (mapeia para `healthy|risk|critical|unhealthy`); manter `nrhs_tier` para retrocompatibilidade preenchendo igual.
  - `nrhs_data_integrity_score`, `nrhs_cadence_score`, `nrhs_stakeholders_score`, `nrhs_win_loss_score`, `nrhs_process_adherence_score`, `nrhs_evidence_score` (integer null).
  - `nrhs_gaps jsonb default '[]'`, `nrhs_recommendations jsonb default '[]'`, `nrhs_metadata jsonb default '{}'`, `nrhs_updated_at timestamptz`.
  - `forecast_hygiene_eligible boolean`, `ote_hygiene_eligible boolean`.
  - Constraints: `nrhs_score BETWEEN 0 AND 100`, `nrhs_status CHECK (in 'healthy','risk','critical','unhealthy')`. Backfill `nrhs_status` a partir de `nrhs_score`.

- Tabela `nrhs_recalc_queue` (mesmo padrão das filas existentes `lead_score_recalc_queue`/`opportunity_score_recalc_queue`):
  - Campos por spec, status default `pending`, índices em `(status, created_at)` e `(opportunity_id, created_at desc)`.
  - RLS: leitura via `has_role(...)`, gravação via service role (igual às outras filas).

- Tabela `nrhs_learning_signals` por spec, com índice `(org_id, opportunity_id, created_at desc)` e RLS por org.

- Triggers de enqueue (`AFTER INSERT/UPDATE`) em `opportunities`, `activities`, `contacts`, `proposals`, `opportunity_emails`. Comparar `OLD vs NEW` apenas em campos relevantes da spec; debounce de 2 min (checar `MAX(created_at)` na fila para o `opportunity_id` antes de inserir). Para activities/contacts/proposals: derivar `opportunity_id` (FK existente) e enfileirar.

- Cron `pg_cron`: a cada 1 min chama edge `process-nrhs-queue` (via insert tool, não migration, igual padrão de cron já adotado).

- Backfill: ao final da migration, `INSERT INTO nrhs_recalc_queue (opportunity_id, org_id, trigger_source, trigger_action) SELECT id, organization_id, 'backfill_sprint14', 'recalculate' FROM opportunities WHERE deleted_at IS NULL AND status NOT IN ('won','lost') LIMIT enqueue all`.

- Garantir `ALTER PUBLICATION supabase_realtime ADD TABLE opportunities` e `REPLICA IDENTITY FULL` (verificar; provavelmente já está).

#### 2. Edge functions

- **`calculate-nrhs`** — refatorar 100% para a fórmula v1:
  - Buscar opp + pipeline_stage + account + contatos + atividades + propostas + emails.
  - Calcular 6 pilares por pontos absolutos (Parts 3–8 da spec).
  - Aplicar penalidades (Part 9), classificar `nrhs_status`, gerar `blockers[]` (objetos com `code/severity/label/description/how_to_fix`), `gaps[]`, `recommendations[]`.
  - Persistir todos os campos novos em `opportunities` + `forecast_hygiene_eligible = score>=70` + `ote_hygiene_eligible = score>=75`.
  - Inserir snapshot em `score_history` (`score_type='nrhs'`, metadata com componentes/blockers/gaps/recommendations/formula_version `'nrhs_v1'`).
  - Inserir em `nrhs_learning_signals` evento `nrhs_recalculated`.
  - Em caso de erro: preservar último valor válido, gravar `error_message` na fila.

- **`process-nrhs-queue`** (nova) — pega até 50 itens `pending`, processa com debounce, marca `processing`/`completed`/`failed`. Padrão dos processadores existentes.

- Triggers de eventos de negócio (won/lost/stage_advanced/regressed) inserem em `nrhs_learning_signals` via DB trigger pequena (sem precisar de edge).

#### 3. Frontend — analytics e UI funcional

- `src/services/crm/nrhs-analytics.ts`:
  - Corrigir filtro de `status` para o conjunto real do banco (`status NOT IN ('won','lost')` + opcional `deleted_at IS NULL` + `pipeline_type='sales'` por default via join em `pipelines`).
  - Selecionar os 6 scores de pilar reais (não recalcular client-side).
  - `calculateTierDistribution`: usar buckets `healthy|risk|critical|unhealthy` da spec.
  - `calculatePillarAverages`: usar colunas reais (`nrhs_data_integrity_score` etc.), labels da spec.
  - Adicionar `valueAtRisk = sum(valor_previsto) WHERE nrhs_status IN ('risk','critical','unhealthy')`.
  - Insights: gerar pelas regras da Part 26 a partir dos `blockers/gaps` reais.

- `src/hooks/useNRHSAnalytics.ts`:
  - Adicionar filtros novos: `pipelineId`, `stageId`, `blockerCode`, `period`, `showWon`, `showLost`, `showOperational` (defaults conforme spec — Vendas/abertas/sem ganhas/perdidas/operacionais).
  - Buscar `pipelines` para resolver default “Vendas” via `is_primary=true AND pipeline_type='sales'`.

- Novos hooks:
  - `src/hooks/scoring/useNRHSRealtime.ts` — assina `opportunities` (filtra por org), invalida queries.
  - `src/hooks/scoring/useNRHSAnalyticsRealtime.ts` — wrapper global montado no Dashboard de Hygiene.
- `src/lib/scoring/invalidateNRHSQueries.ts` — invalida chaves listadas na Part 20.

- `RevenueHygieneDashboard.tsx`:
  - Wire-up do botão **Atualizar NRHS** → `supabase.from('nrhs_recalc_queue').insert(...)` em lote para deals filtrados (até 1000 por chamada), toast de progresso, montar realtime hook.
  - Adicionar filtros no topo (Pipeline/Status/Owner/Estágio/Faixa/Blocker/Período + toggles ganhas/perdidas/operacionais).
  - `NRHSDealsTable`: ação por linha “Reprocessar NRHS” → invoca edge `calculate-nrhs` direto.
  - `NRHSByOwner`: usar `calculateOwnerStats` já calculado, expor blockers principais por owner.
  - `NRHSGovernanceBox`: mostrar regras reais (Part 27) com thresholds 70/75 lidos do código (constantes).
  - `NRHSInsightsPanel`: consumir `generateNRHSInsights` reformulado.

- Tooltip/badge `NRHSBadge` e `NRHSBreakdown`: ajustar para 4 status oficiais e exibir blockers/gaps/recommendations do `nrhs_metadata`.

#### 4. Integrações leves

- Forecast: nada de refactor; `useForecastData` já lê deals — apenas garantir que `forecast_hygiene_eligible` esteja exposto via select para uso futuro. Sem mudança de cálculo nesta sprint.
- Lead Score, Opportunity Score, Opportunity Indicators: **não tocados**. NRHS roda em paralelo.

#### 5. RLS / segurança

- Reutilizar `has_role` e padrão `org_id` das filas existentes. Service role processa fila. Reprocessamento manual permitido a admin/owner/manager (checagem na UI + RLS de insert na fila usando `has_role`).

---

### Arquivos impactados

**Banco (migration única):**
- Colunas em `opportunities`, tabelas `nrhs_recalc_queue`, `nrhs_learning_signals`, triggers de enqueue + signals, view `v_opportunities_hygiene_base` (refresh se necessário).

**Cron (insert tool, não migration):** agendamento de `process-nrhs-queue`.

**Edge functions:**
- `supabase/functions/calculate-nrhs/index.ts` (reescrita v1).
- `supabase/functions/process-nrhs-queue/index.ts` (novo).

**Frontend:**
- `src/services/crm/nrhs-analytics.ts` (filtros + pilares reais + insights).
- `src/services/crm/nrhs-calculator.ts` (tipos `NRHSStatus`, `NRHS_THRESHOLDS`, helpers v1; manter `NRHSTier` como alias).
- `src/hooks/useNRHSAnalytics.ts`, `src/hooks/useNRHS.ts` (mutate via fila).
- `src/hooks/scoring/useNRHSRealtime.ts`, `src/hooks/scoring/useNRHSAnalyticsRealtime.ts` (novos).
- `src/lib/scoring/invalidateNRHSQueries.ts` (novo).
- `src/lib/query-keys.ts` (`nrhsKeys`, `nrhsAnalyticsKeys` ampliados).
- `src/components/scoring/nrhs/RevenueHygieneDashboard.tsx` + filhos (`NRHSOverviewKPIs`, `NRHSDistributionCharts`, `NRHSDealsTable`, `NRHSByOwner`, `NRHSGovernanceBox`, `NRHSInsightsPanel`).
- `src/components/nrhs/NRHSBadge.tsx`, `NRHSBreakdown.tsx`, `NRHSSidebarCard.tsx` (status v1 + metadata explicável).

---

### Riscos

- Mudança de fórmula muda valores históricos de `nrhs_score`. Mitigação: gravar `formula_version` no metadata e em `score_history`; backfill recalcula tudo.
- Tier antigo `elite` deixa de existir. Componentes que usam `NRHSTier === 'elite'` recebem mapeamento para `healthy`.
- Triggers de enqueue mal calibrados podem inflar a fila. Mitigação: debounce 2 min via subquery + filtros estritos por colunas relevantes.
- Backfill de ~278 deals: será processado pelo cron em lotes de 50/min (~6 min). Sem bloqueio de deploy.

### Status final

- ✅ Migration (schema + colunas v1 + filas + triggers + signals)
- ✅ Edge `calculate-nrhs` v1 + `process-nrhs-queue` deployados
- ✅ Cron 1/min + backfill enfileirado (214 deals scorados)
- ✅ Service/hook usando colunas reais por pilar; insights v1
- ✅ Botão "Atualizar NRHS" enfileira deals visíveis e dispara processamento imediato
- ✅ Realtime via `useNRHSAnalyticsRealtime` invalida queries quando `nrhs_score`/`nrhs_status` mudam
