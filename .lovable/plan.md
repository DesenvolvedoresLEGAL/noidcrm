# Sprint Scoring 1.3 — Auditoria Forense + Filtro por Pipeline

## Diagnóstico confirmado

- **AI Win inflado**: 68 oportunidades abertas (`status='new'`) com `win_probability_ai = 100`. Bug crítico.
- **Status**: oportunidades usam `won`, `new`, `lost`, `open`. Não existe `disqualified` no enum atual — tratar via pipeline `qualification` + `lost`.
- **Schema já existente** em `opportunities`: `opportunity_score`, `opportunity_grade` (a confirmar — não veio na query, vou validar antes), `opportunity_health`, `opportunity_score_metadata`, `nrhs_score`, `nrhs_tier`, `nrhs_blockers`, `nrhs_breakdown`, `nrhs_last_calculated_at`, `engagement_score`, `velocity_score`, `risk_score`, `win_probability_ai`. **Reutilizar tudo isso, não duplicar.**
- **Faltam**: `ai_win_probability_metadata`, `ai_win_probability_updated_at`, `deal_health` + metadata, `risk_level`, `engagement_metadata`, `velocity_metadata`, `risk_metadata`, `nrhs_status` (já existe `nrhs_tier` — reutilizar como sinônimo).
- **Pipelines**: existem múltiplos com mesmo nome (3x "PRÉ VENDAS", 5x "Vendas/VENDAS"). O filtro deve listar todos, agrupar por `pipeline_type`, e default por `pipeline_type='sales'` (não por nome).
- **Tabelas auxiliares disponíveis**: `proposals`, `opportunity_emails`, `activities`, `score_history`, `nrhs_events`, `v_opportunities_hygiene_base`. Não criar duplicatas.

## O que será construído

### 1. Auditoria documentada
Criar `src/lib/scoring/SCORING_INDICATORS_AUDIT.md` listando cada indicador (Lead Score, Lead Grade, Opportunity Score/Grade/Health, NRHS, Probabilidade Comercial, AI Win, Deal Health, Engagement, Velocity, Risk) com: onde aparece, fonte atual no código, fórmula encontrada, problemas, fonte oficial recomendada.

### 2. Schema (migração mínima)
Adicionar apenas o que falta em `opportunities`:
- `deal_health text`, `deal_health_score int`, `deal_health_updated_at timestamptz`, `deal_health_metadata jsonb default '{}'`
- `risk_level text`, `risk_updated_at timestamptz`, `risk_metadata jsonb default '{}'`
- `engagement_updated_at`, `engagement_metadata jsonb`
- `velocity_updated_at`, `velocity_metadata jsonb`
- `ai_win_probability_updated_at`, `ai_win_probability_metadata jsonb`

Criar `opportunity_indicators_recalc_queue` (mesmo padrão das filas 1.1/1.2: debounce 2min, batch 50, cron 1min).

Triggers `enqueue_opportunity_indicators_recalc()` em: `opportunities` (stage_id, status, amount, owner_id, primary_contact_id, won_at, lost_at), `activities` (status, completed_at, due_at), `proposals` (status, viewed_at, accepted_at, expires_at), `opportunity_emails` (opened_at, replied_at). Verificar existência de cada coluna antes (defensivo).

### 3. Edge function `calculate-opportunity-indicators`
Consolida indicadores derivados (não recalcula Lead Score nem Opportunity Score — esses já têm functions próprias). Calcula: NRHS, Engagement, Velocity, Risk, Deal Health, AI Win — com fórmulas e caps exatos do spec. Persiste tudo + metadata explicável + `score_history`.

**AI Win — caps obrigatórios**:
- `won` → 100; `lost` → 0
- `new`/`open` → máx 95 (nunca 100)
- sem next activity → máx 59
- sem responsável → máx 49
- parada >14d → máx 49
- sem decisor → máx 69
- engagement <20 → máx 69

**Backfill one-shot** ao deploy: enfileirar todas as opps abertas para corrigir os 68 com 100%.

### 4. Edge function `process-opportunity-indicators-queue` + cron 1min.

### 5. Realtime + invalidação
- `src/hooks/scoring/useOpportunityIndicatorsRealtime.ts` (escopo single opp)
- `src/hooks/scoring/usePipelineIndicatorsRealtime.ts` (escopo org_id, filtra só campos de indicadores)
- `src/lib/scoring/invalidateOpportunityIndicatorsQueries.ts` (reusa helpers existentes)

### 6. Filtro por pipeline na tela Scoring
Adicionar `<PipelineFilter>` no header de `Scoring.tsx`, propagado para as 3 abas via context/props. Buscar pipelines reais (`usePipelines`), agrupar por `pipeline_type`. Defaults:
- **Opportunity Score**: `pipeline_type='sales'` + `status IN ('new','open')` + ocultar won/lost/operacional
- **Lead Score**: contas com opp em sales/qualification, ou contas sem opp
- **NRHS**: `pipeline_type='sales'` + abertas

Toggles manuais: "Mostrar ganhas", "Mostrar perdidas", "Mostrar operacionais".

### 7. Correção `OpportunityScoreDashboard` (causa raiz do print)
Atualizar `useOpportunityScoreAnalytics` para aplicar os defaults acima. **Valor em Risco** passa a considerar só abertas filtradas com `risk_level='high'` ou `risk_score>=70` ou `deal_health IN ('risk','stalled')` — nunca won.

### 8. Tooltips explicáveis
Componente reutilizável `<IndicatorTooltip>` que lê `*_metadata` JSONB e renderiza: o que é, fórmula, componentes, caps aplicados, blockers. Aplicar em PipelineCard, OpportunityDetail, sidebar.

### 9. Renomear UI
Remover "machine learning preditivo" do `OpportunityScoreDashboard` → "Estimativa inteligente baseada em score e sinais comerciais".

## Arquivos impactados (estimativa)

**Criar:**
- `src/lib/scoring/SCORING_INDICATORS_AUDIT.md`
- `src/lib/scoring/invalidateOpportunityIndicatorsQueries.ts`
- `src/hooks/scoring/useOpportunityIndicatorsRealtime.ts`
- `src/hooks/scoring/usePipelineIndicatorsRealtime.ts`
- `src/components/scoring/IndicatorTooltip.tsx`
- `src/components/scoring/PipelineScopeFilter.tsx`
- `supabase/functions/calculate-opportunity-indicators/index.ts`
- `supabase/functions/process-opportunity-indicators-queue/index.ts`
- 1 migration (schema + queue + triggers + cron + realtime publication)

**Editar:**
- `src/pages/Scoring.tsx` (header com filtro de pipeline)
- `src/components/scoring/opportunity/OpportunityScoreDashboard.tsx` (rename + filtros)
- `src/hooks/useOpportunityScoreAnalytics.ts` (defaults: sales + abertas)
- `src/hooks/useNRHSAnalytics.ts` (default sales + abertas)
- `src/components/scoring/lead/LeadScoreDashboard.tsx` (filtro pipeline)
- `src/components/scoring/nrhs/RevenueHygieneDashboard.tsx` (filtro pipeline)
- `src/components/pipeline/*Card*` (tooltips explicáveis nos badges de score)

## Riscos e mitigações

- **Breaking 1.1/1.2**: zero alteração em `calculate-account-scores`, `calculate-opportunity-score` ou suas filas. Esta sprint adiciona uma terceira camada paralela.
- **Triggers em tabela inexistente**: cada `CREATE TRIGGER` precedido de `DO $$ ... IF EXISTS ... $$`.
- **Multi-tenant**: toda query nova filtra `organization_id`; RLS preservada nas tabelas novas.
- **Backfill em massa**: enfileirar via SQL, processar via cron normal (50/min) — sem pico.
- **Pipelines duplicados**: filtro UI lista todos, agrega por `pipeline_type` para defaults.

## Fora do escopo (não fazer)
Account Score, Forecast V2, modelo ML real, alterar fórmulas das Sprints 1.1/1.2, refazer visual do pipeline.
