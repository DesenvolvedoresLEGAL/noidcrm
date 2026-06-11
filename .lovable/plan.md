
# KAI.14 — Autopilot Batch

Primeiro agente operacional do Kairós: processa lotes de expositores (100/300/500+) sem intervenção humana, executando matching → enrichment → Apollo → decisor → brief → SDR Ready, entregando à Qualified Queue.

## 1. Schema (migration única)

### `kairos_batch_runs`
- `id`, `organization_id`, `event_id` (nullable — pode ser lead_search), `run_name`, `run_type` (event/search/manual)
- `status` enum `kairos_batch_status`: pending | running | paused | completed | failed | cancelled
- `total_prospects`, `processed`, `skipped`, `failed` (int)
- `credits_estimated`, `credits_used` (int)
- `config` jsonb (icp, min_score, min_quality, max_apollo_credits, max_contacts_per_company, allow_enrichment, allow_apollo, generate_brief)
- `started_at`, `completed_at`, `created_by`, `created_at`, `updated_at`

### `kairos_batch_run_items`
- `id`, `run_id` (FK cascade), `prospect_id`
- `current_stage` enum `kairos_batch_stage`: matching | queue | enrichment | apollo | decision_maker | approach | ready | completed
- `status` enum `kairos_batch_item_status`: pending | running | done | skipped | failed
- `message` text, `priority_rank` int (1–100)
- `started_at`, `completed_at`, `created_at`, `updated_at`
- Index `(run_id, status)`, `(run_id, priority_rank desc)`

### `kairos_batch_logs`
- `id`, `run_id`, `prospect_id` (nullable), `action`, `result`, `details` jsonb, `created_at`
- Index `(run_id, created_at desc)`

RLS: `organization_id` via `organization_members` para todas. GRANT pattern padrão (authenticated + service_role).

## 2. Edge Functions

### `kairos-autopilot-start`
- Recebe `{ event_id?, lead_search_id?, config }`. Resolve lista de prospects elegíveis (filtro por evento/search + ICP).
- Calcula `credits_estimated` (apollo_cost × eligible_count).
- Valida saldo e limite configurado; retorna 402 se exceder.
- Cria `kairos_batch_runs` (status=pending) + `kairos_batch_run_items` em massa.
- Dispara `kairos-autopilot-process` via `EdgeRuntime.waitUntil`.

### `kairos-autopilot-process`
- Background worker. Lê items `pending|running` em ordem `priority_rank desc`.
- Para cada item executa pipeline (PASSOS 1–9). Reutiliza:
  - `kairos-match-company` (já existe)
  - `kairos-enqueue-prospect`
  - `run-enrichment`
  - `apollo-find-decision-makers`
  - `kairos-generate-approach-brief`
- Atualiza `current_stage`/`status`/`message` por item. Grava `kairos_batch_logs` em cada ação.
- Respeita `config.max_apollo_credits` (interrompe Apollo quando atingir).
- Verifica `runs.status='paused'|'cancelled'` entre items e sai gracefully.
- Atualiza `processed/skipped/failed/credits_used`. Marca `completed` ao final.

### `kairos-autopilot-control`
- `{ run_id, action: 'pause'|'resume'|'cancel' }`. Atualiza status e (em resume) re-dispara `kairos-autopilot-process`.

## 3. Motor de priorização (DB function)
`fn_kairos_batch_priority(prospect_id)` → 0–100 baseado em: ICP match (30) + score (20) + qualidade enrichment (15) + decisor (15) + contato (10) + ticket potencial (5) + evento estratégico (5). Calculado no insert do item e em recalcs entre estágios.

## 4. Serviços/hooks frontend
- `src/services/intelligence/autopilot.ts` — list runs, get run + items + logs, estimate credits.
- `src/hooks/intelligence/useAutopilotRuns.ts`, `useAutopilotRun.ts`, `useAutopilotItems.ts`, `useAutopilotLogs.ts`, `useAutopilotKpis.ts`.
- `useAutopilotActions.ts` — start/pause/resume/cancel mutations (chamam edges).
- Realtime subscribe em `kairos_batch_runs` e `kairos_batch_run_items` para atualizar UI live.

## 5. UI (nova aba `Kairós > Autopilot`)
- `src/components/intelligence/autopilot/AutopilotPanel.tsx` — wrap.
- `AutopilotKpiBar.tsx` — execuções, prospects processados, decisores, SDR Ready, créditos, taxa de aproveitamento.
- `AutopilotRunsTable.tsx` — lista de execuções com status badges, progresso, ações pausar/retomar/cancelar.
- `AutopilotConfigModal.tsx` — modal "🚀 Executar Autopilot": evento (combobox lead_searches), ICP (cluster do `useIcpIntelligence`), score mínimo, qualidade mínima, max créditos Apollo, max contatos/empresa, switches (enrichment, Apollo, brief). Mostra `EligibilityPreview` (empresas elegíveis, créditos estimados, limite, saldo) antes de confirmar.
- `AutopilotRunDrawer.tsx` — detalhes de uma execução: tabela items + filtros (status, SDR Ready, com/sem decisor, estágio) + aba logs.
- Filtros: execução, evento, status, SDR Ready, com decisor, sem decisor.
- Botão `🚀 Executar Autopilot` em `LeadResultsTable` e em `KairosHub` (header da aba).

## 6. Integração KairosHub
Adicionar tab `autopilot` em `KairosHub.tsx` (ordem: ICP → Queue → **Autopilot** → Sourcing → ...).

## 7. Alertas
Toasts realtime via subscription:
- "Execução concluída: X SDR Ready de Y processados"
- "⚠️ Crédito próximo do limite (≥80%)"
- "❌ Falha em lote: N items"
- "⚠️ Taxa baixa de decisores (<30%)" no final

## 8. Regras invioláveis
- **Nunca** cria oportunidade/conta/CRM automaticamente. Saída = Qualified Queue.
- Promoção CRM continua manual (já implementado em KAI.13).
- Respeita `forcePromote` apenas para `platform_admin`.

## 9. Docs
- Novo: `src/components/playbook/AUTOPILOT.md`
- Update: `SOURCING_AUDIT.md`, `QUALIFIED_QUEUE.md` (referência ao Autopilot).

## Arquivos

**Novos (~16):**
- Migração (1)
- 3 edge functions
- 1 service + 6 hooks
- 5 componentes UI
- 1 doc

**Editados:**
- `src/pages/intelligence/KairosHub.tsx` (nova tab)
- `src/components/playbook/LeadResultsTable.tsx` (botão Autopilot em lote)
- `src/components/playbook/SOURCING_AUDIT.md`

## Riscos
- Long-running jobs: mitigado por `EdgeRuntime.waitUntil` + processamento em batches pequenos com checkpoint via DB.
- Custos Apollo: estimativa + hard cap por config; logs de cada chamada.
- Concorrência: lock otimista via `status='running'` no item antes de processar.
- Sem alterações em RLS de tabelas existentes, sem mudanças em regras financeiras/métricas.

## Próximos passos (fora desta sprint)
- Agendamento (cron por evento novo)
- ML score para priorização
- Multi-event autopilot
