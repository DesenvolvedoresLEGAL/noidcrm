

## Sprint 2.8 — UI V2 Fase 2: Migração das 8 telas analíticas/operacionais

### Contexto confirmado
- `useReportsV2Flag` tem hoje 6 sub-flags (`general, losses, forecast, closer, team, stage_metrics`) — preciso **expandir** com 8 novas: `origins, processed, sdr, handoff, stage_balance, stage_conversion, stages, accumulated`
- Sprint 2.5 já criou hooks view-direct para origins/processed/sdr/handoff/stage_balance/stage_conversion/accumulated → Sprint 2.7 substituiu 6 deles; **vou reescrever os 7 restantes para edge functions** + criar `useReportStagesV2` (novo, orquestra balance + conversion)
- Edge functions `report_origins_v2`, `report_processed_v2`, `report_sdr_v2`, `report_handoff_v2`, `report_stage_balance_v2`, `report_stage_conversion_v2`, `report_accumulated_v2` já existem (Sprint 2.6)
- Componentes legacy ficam intactos; 8 wrappers fazem switch por flag
- Tipos `ReportEdgeFilters` já tem `qualifiedByUserIds, stageIds, status` (Sprint 2.6); só preciso expor isso no `buildReportV2RequestFromFilters`
- Mapeamento de chave de aba: `funnel-balance→stage_balance`, `conversion-rate→stage_conversion`, `stage-conversion→stages` (combinada)

### Plano de execução

**FASE 1 — Flags + helper (2 arquivos)**

1. `useReportsV2Flag.ts` — expandir `ReportsV2SubFlags` e `DEFAULT_SUB` com 8 novas chaves
2. `isReportTabV2Enabled.ts` — atualizar `REPORT_KEY_TO_FLAG` com:
   - `origins→origins`, `processed→processed`, `sdr-performance→sdr`, `handoff→handoff`
   - `funnel-balance→stage_balance`, `conversion-rate→stage_conversion`, `stage-conversion→stages`, `accumulated→accumulated`

**FASE 2 — Atualizar `buildReportV2RequestFromFilters` (1 arquivo)**

3. Aceitar args adicionais: `qualifiedByUserIds?: string[]`, `stageIds?: string[]`, `status?: string[]` e propagar para `filters`

**FASE 3 — 8 hooks edge-based (8 arquivos)**

Substituir os 6 existentes (origins/processed/sdr/handoff/stage_balance/stage_conversion/accumulated da Sprint 2.5) + criar `useReportStagesV2` novo. Padrão idêntico ao Sprint 2.7: React Query + `callReportEdgeFunction<T>` + `staleTime 60s` + retorno `{data, meta, error, isLoading, refetch}`.

`useReportStagesV2` é especial: chama internamente `useReportStageBalanceV2` + `useReportStageConversionV2` e retorna `{balance, conversion, meta, error, isLoading, refetch}` combinado.

**FASE 4 — 8 mappers puros (8 arquivos em `src/lib/reports/mappers/`)**

Apenas formatação/rename. Para cada um:
- `mapOriginsV2` — rows + `computeOriginsHighlights` (origem com mais oportunidades, maior receita, melhor win rate)
- `mapProcessedV2` — single object → camelCase
- `mapSdrV2` — rows + totals (SQLs, ganhos, perdas, receita atribuída, win rate ponderado, tempo médio)
- `mapHandoffV2` — rows + totals (handoffs, won, lost, receita, win rate, tempo médio)
- `mapStageBalanceV2` — rows + cards (ativos, valor, pipelines distintos, gargalos = top N por dias)
- `mapStageConversionV2` — rows + highlights (melhor avanço, maior travamento, taxa média)
- `mapStagesV2` — combina balance+conversion em duas listas distintas
- `mapAccumulatedV2` — série temporal + médias diárias + running total opcional

**FASE 5 — 8 componentes V2 (8 arquivos em `src/components/reports/v2/`)**

Cada um segue padrão Sprint 2.7: `useCurrentUser` + `useReportFiltersContext` + `useTeamVisibility` → `buildReportV2RequestFromFilters` → hook V2 → `ReportMetaBar` + `ReportWarningsPanel` + `ReportLoadingState/ErrorState/EmptyState`. Zero recálculo de regra crítica.

- `OriginReportV2.tsx` — 4 cards + tabela (origem, total, won, lost, open, receita, pipeline aberto, win rate, ticket médio)
- `ProcessedOpportunitiesV2.tsx` — 8 cards
- `SDRPerformanceReportV2.tsx` — 6 cards + tabela; warning se `confidence.breakdown.history < 50`
- `HandoffReportV2.tsx` — 6 cards + tabela 8 colunas
- `FunnelBalanceV2.tsx` — 4 cards + tabela; sem placeholder (`avg_days_in_stage` da view real); confidence reflete cobertura histórica
- `ConversionRateV2.tsx` — 4 cards + tabela; badge "Conversão histórica real"
- `StageConversionReportV2.tsx` — usa `useReportStagesV2`; duas tabelas separadas visualmente ("Estado atual" vs "Fluxo histórico")
- `AccumulatedOpportunitiesV2.tsx` — 4 cards + série temporal (recharts LineChart) com `created_count` e `created_value`; running total calculado no front

**FASE 6 — 8 wrappers + integrar `Reports.tsx` (9 arquivos)**

- 8 wrappers pequenos em `src/components/reports/wrappers/` (`OriginReportWrapper`, `ProcessedOpportunitiesWrapper`, `SDRPerformanceWrapper`, `HandoffWrapper`, `FunnelBalanceWrapper`, `ConversionRateWrapper`, `StageConversionWrapper`, `AccumulatedOpportunitiesWrapper`)
- `Reports.tsx` — substituir 8 cases para usar wrappers

**FASE 7 — Audit + artifact (2 arquivos)**

- `reportsAuditStatus.ts` — adicionar `REPORTS_UI_V2_PHASE_2` set com as 8 abas
- Artifact `relatorios-v2-sprint2.8-checklist.md` com mapa aba↔wrapper↔V2↔hook↔edge↔flag

### Decisões técnicas

- **`useReportStagesV2` (chave `stage-conversion`)**: combina os 2 hooks existentes em paralelo. Meta vem do `balance` (mais representativo do estado atual). É o único hook novo; todos os outros 7 reaproveitam nomes Sprint 2.5 com implementação trocada para edge.
- **Flag `stages`**: nova, separada de `stage_metrics`. `stage_metrics` (Sprint 2.1) continua existindo mas foi mapeada apenas para `funnel-balance/stage-conversion` no map original — Sprint 2.8 redireciona corretamente: `funnel-balance→stage_balance`, `conversion-rate→stage_conversion`, `stage-conversion→stages`.
- **`buildReportV2RequestFromFilters`**: extensão retro-compatível (novos args opcionais).
- **Mappers proibidos de recalcular regra crítica**: win rate, ticket, ciclo, conversão — tudo vem do envelope. Mappers só fazem totais agregados de exibição (somas/médias ponderadas para cards de cabeçalho).
- **Accumulated chart**: recharts já está no projeto; running total é apenas matemática de apresentação (acumulado visual), não regra de negócio.
- **Rollback por aba**: cada wrapper checa `isReportTabV2Enabled(tabKey)` a cada render. Sem fallback silencioso.
- **Zero quebra das telas Sprint 2.7**: hooks Sprint 2.7 (`useReportSummaryV2`, etc) ficam intactos.

### Critérios de aceite (mapeamento)

| # | Como atende |
|---|---|
| 1-8 | FASE 5 — 8 componentes V2 |
| 9 | FASE 3 — 8 hooks edge-based (7 substituídos + 1 novo) |
| 10 | FASE 4 — 8 mappers |
| 11 | FASE 1 + FASE 6 — flags expandidas + wrappers checam por aba |
| 12 | Componentes V2 só importam hooks V2 |
| 13 | Mappers proibidos de recalcular regra |
| 14 | FunnelBalanceV2/ConversionRateV2 usam edge → views Sprint 2.5 com trilha real |
| 15 | SDR/Handoff usam `first_qualification_at` (vem da view via edge) |
| 16 | Suíte completa migrada via Phase 1 (Sprint 2.7) + Phase 2 (esta sprint) |
| 17 | Wrapper switch a cada render |
| 18 | Reaproveita 6 componentes shared da Sprint 2.7 |

### Fora de escopo
- ❌ Apagar componentes legacy
- ❌ Migrar AI Insights (não está na lista)
- ❌ Editar tela de configuração da flag (apenas expandir o tipo)
- ❌ Edge functions novas (todas existem)

### Risco
Médio-baixo. ~36 arquivos novos/editados: 1 flag expand + 1 helper + 1 builder edit + 8 hooks (7 substituídos + 1 novo) + 8 mappers + 8 componentes V2 + 8 wrappers + 1 Reports.tsx edit + 1 audit + 1 artifact. Zero edição de telas Sprint 2.7. Rollback automático por flag.

### Tempo estimado
~75 min.

