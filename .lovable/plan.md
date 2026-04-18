

## Sprint 2.7 — UI V2 Fase 1: Migração das 5 telas críticas

### Contexto confirmado
- `useReportsV2Flag` já existe com sub-flags `{general, losses, forecast, closer, team, stage_metrics}` ✅
- Sprint 2.5 criou hooks `useReport*V2` mas **lendo views diretamente** (não edge functions) — precisam ser **substituídos** pelos novos hooks edge-based desta sprint
- Sprint 2.6 entregou `callReportEdgeFunction<T>` + envelope `ReportEdgeResponse<T>` ✅
- Telas legacy: `GeneralOverview`, `LostReasons`, `RevenueForecast`, `CloserPerformanceReport`, `TeamPerformanceReport` (ficam intactas)
- Reports.tsx faz switch por `activeReport` — vou criar wrappers que decidem V2 vs Legacy

### Plano

**FASE 1 — Helpers compartilhados (4 arquivos)**

1. `src/lib/reports/isReportTabV2Enabled.ts` — `isReportTabV2Enabled(tab, master, sub)` retorna `master && sub[tab]`
2. `src/lib/reports/buildReportV2Request.ts` — `buildReportV2RequestFromFilters({ orgId, filters, effectiveDates, teamVisibility })` → `ReportEdgeRequest` canônico (mapeia `filters.pipelines→pipelineIds`, `effectiveDates→dateRange`, aplica `teamVisibility.enabled+visibleUserIds`)
3. `src/lib/reports/mappers/` — 5 mappers puros (sem regra de negócio):
   - `mapSummaryV2.ts`, `mapLossesV2.ts`, `mapForecastV2.ts`, `mapCloserV2.ts`, `mapTeamV2.ts`
   - Apenas formatação (formatCurrency/formatPct), rename de campos snake_case→camelCase, e cálculo de cenários do forecast (pessimist/realistic/optimistic/bestCase) que JÁ vem do edge function `report_forecast_v2`
4. `src/lib/reports/formatReportNumbers.ts` — `formatCurrency`, `formatPct`, `formatDateBR` consolidados

**FASE 2 — Componentes UI compartilhados (6 arquivos em `src/components/reports/v2/shared/`)**

5. `ReportConfidenceBadge.tsx` — mapeia `ConfidenceLevel` → label PT-BR (`high→Confiável`, `medium/partial→Parcial`, `low→Atenção`, `unavailable→Indisponível`) com cores semânticas
6. `ReportMetaBar.tsx` — barra superior compacta: badge "V2 ativo" + `generatedAt` formatado + `rowCount` + `<ReportConfidenceBadge>` + breakdown opcional
7. `ReportWarningsPanel.tsx` — lista warnings derivados de `confidence.breakdown` (cobertura monetária <80%, histórica <50%, etc) com ícone e severidade
8. `ReportLoadingState.tsx` — skeleton padrão (4 cards + chart)
9. `ReportErrorState.tsx` — mensagem + botão "Tentar novamente" (recebe `onRetry`)
10. `ReportEmptyState.tsx` — mensagem contextual por aba (recebe `tabKey`, `title`, `description`)

**FASE 3 — Hooks V2 edge-based (6 hooks)** — substituem os hooks Sprint 2.5 (que liam view direto)

11-16. `src/hooks/useReportSummaryV2.ts`, `useReportLossesV2.ts`, `useReportLossesDetailV2.ts`, `useReportForecastV2.ts`, `useReportCloserV2.ts`, `useReportTeamV2.ts`
   - Padrão: React Query + `callReportEdgeFunction<T>(name, request)` + `staleTime 60s`
   - Recebem `{ organizationId, request, enabled }` 
   - Retornam `{ data, meta, error, isLoading, refetch }` (envelope completo p/ ReportMetaBar usar)
   - **Compatibilidade**: Sprint 2.5 já criou versões view-direct desses hooks. Vou **substituir o conteúdo** (mesmo nome) p/ usar edge functions. Apenas `useReportLossesDetailV2` é novo.

**FASE 4 — Componentes V2 (5 telas em `src/components/reports/v2/`)**

17. `GeneralOverviewV2.tsx` — 9 cards (pipeline ativo, valor pipeline, ganhas, receita, perdidas, valor perdido, processadas, win rate, ticket médio) + `ReportMetaBar` + `ReportWarningsPanel`
18. `LostReasonsV2.tsx` — 6 cards de cobertura + ranking por motivo + tabela detalhada (15 colunas conforme spec) com bucket legado visível
19. `RevenueForecastV2.tsx` — 4 cards de receita + 4 cenários computados pelo edge function + meta atingida (% se meta>0, "Meta não configurada" se 0)
20. `CloserPerformanceReportV2.tsx` — 7 cards + tabela 9 colunas; warning se `confidence.breakdown.history < 50`
21. `TeamPerformanceReportV2.tsx` — 6 cards (sem média aritmética) + tabela 8 colunas; usa `win_rate_pct` oficial do view

Cada um:
- Usa `useCurrentUser` p/ `organizationId`
- Usa `useReportFiltersContext` + `useTeamVisibility` p/ montar request via `buildReportV2RequestFromFilters`
- Estados: `isLoading→ReportLoadingState`, `error→ReportErrorState`, `!data→ReportEmptyState`
- **Zero recálculo de regra crítica** — só renderiza o que vem do envelope

**FASE 5 — Wrappers de roteamento (5 arquivos curtos)**

22. `src/components/reports/wrappers/GeneralOverviewWrapper.tsx`, `LostReasonsWrapper.tsx`, `RevenueForecastWrapper.tsx`, `CloserPerformanceWrapper.tsx`, `TeamPerformanceWrapper.tsx`
   - Cada um: lê `useReportsV2Flag()` + `isReportTabV2Enabled(tab)` → renderiza `*V2` ou componente legacy
   - **Sem fallback silencioso**: se V2 falha, mantém estado de erro V2 (não mistura dados)

**FASE 6 — Integrar em `Reports.tsx`**

23. Substituir os 5 imports/cases no `switch` por wrappers. Telas não-críticas (processed, accumulated, origins, etc) ficam exatamente como estão.

**FASE 7 — Atualizar audit + artifact**

24. `src/lib/reports/reportsAuditStatus.ts` — marcar `general`, `lost-reasons`, `forecast`, `closer-performance`, `team-performance` como `V2_READY` quando flag ligada
25. Artifact `relatorios-v2-sprint2.7-checklist.md`

### Decisões técnicas

- **Substituir hooks Sprint 2.5 (não criar novos nomes)**: já estão `useReportSummaryV2`, etc. Mantenho assinatura compatível mas troco implementação para edge function. Simplifica futuras Sprints.
- **`useReportLossesDetailV2` é novo**: Sprint 2.5 não criou (só `useReportLossesV2` agregado).
- **Cenários do forecast**: vêm do **edge function** `report_forecast_v2` (Sprint 2.6 já calcula pessimist/realistic/optimistic/bestCase). Mappers só renomeiam.
- **`teamVisibility`**: extraído de `useTeamVisibility()` e propagado via `request.filters.teamVisibility`. Edge functions Sprint 2.6 já aplicam.
- **Rollback automático**: wrapper checa flag a cada render. Desligar flag no settings = legacy reaparece imediatamente (próxima query).
- **Sem migração das outras 9 abas**: explicitamente fora de escopo.
- **`generatedAt` da meta**: usado p/ ReportMetaBar mostrar "Atualizado às HH:mm". Nada de cache TTL além do React Query 60s.
- **Warnings derivados**: `ReportWarningsPanel` lê `confidence.breakdown` e mostra apenas itens com cobertura <80%.

### Critérios de aceite (mapeamento)

| # | Como atende |
|---|---|
| 1-5 | FASE 4 — 5 componentes V2 |
| 6 | FASE 3 — 6 hooks edge-based |
| 7-9 | FASE 2 — `ReportMetaBar`, `ReportConfidenceBadge`, `ReportWarningsPanel` |
| 10 | FASE 2 — `ReportLoadingState`, `ReportErrorState`, `ReportEmptyState` |
| 11 | FASE 5 — wrappers checam `isReportTabV2Enabled(tab)` |
| 12 | FASE 4 — componentes V2 só usam hooks V2 (zero import legacy) |
| 13 | Mappers proibidos de recalcular regra; tudo vem do envelope |
| 14 | Wrappers fazem switch por flag a cada render |
| 15 | `ReportMetaBar` + `ReportWarningsPanel` em cada tela V2 |

### Fora de escopo
- ❌ Migrar abas Processed, Accumulated, Origins, SDR, Handoff, Stage Balance/Conversion, AI Insights (Sprint 2.8+)
- ❌ Apagar componentes legacy
- ❌ Editar `Reports.tsx` além de trocar 5 cases para wrappers
- ❌ Tela de configuração de flag (já existe em `ReportsV2FlagsSection`)

### Risco
Médio-baixo. 100% novo código para V2 + 5 wrappers de 1 linha cada + 1 edição mínima em `Reports.tsx`. Hooks Sprint 2.5 mudam implementação mas mantêm assinatura — afetam apenas usos que ainda não existem (Sprint 2.5 era só infra). Rollback é instantâneo via flag.

### Tempo estimado
~60 min. 4 helpers + 6 shared UI + 6 hooks (substituídos) + 5 telas V2 + 5 wrappers + 1 edit `Reports.tsx` + 1 audit update + 1 artifact = ~28 arquivos.

