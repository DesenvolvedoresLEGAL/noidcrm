

## Sprint 2.5 — Views Canônicas dos Relatórios V2

### Schema confirmado
- `v_opportunities_hygiene_base`: tem `origem` ❌ (verificar via opportunities) — confirmado: `opportunities.origem text` existe, mas hygiene_base **não expõe**. Vou ler `origem` direto via JOIN com `opportunities`.
- `v_opportunity_amounts_v2`: já tem `qualified_by_user_id`, `commercial_amount_current`, `net_revenue_final`, `amount_source`, `reference_proposal_*`, `has_*_proposal`, datas (won/lost/closed/close_date_prevista) ✅
- `pipelines`: tem `pipeline_type`, `is_primary` ✅
- `stages`: tem `probability` (integer) ✅
- `organization_settings`: tem `monthly_revenue_goal`, `quarterly_revenue_goal`, `annual_revenue_goal` (colunas dedicadas) ✅
- `profiles`: tem `full_name` ✅
- `opportunity_stage_history`: existe (Sprint 2.3) ✅

### Plano de execução

**FASE 1 — Migration única (1 view base + 13 views agregadas):**

1. **`v_reporting_opportunities_v2`** (base unificada) — JOIN de:
   - `v_opportunities_hygiene_base` (status, datas, valor_previsto, loss_reason_id)
   - `opportunities` (apenas para `origem`, `client_loss_reason_id`)
   - `v_opportunity_amounts_v2` (toda camada monetária)
   - `v_opportunity_stage_age_v2` (entered_current_stage_at, hours/days_in_current_stage)
   - `v_opportunity_first_owner_v2` → `first_owner_user_id`
   - `v_opportunity_current_owner_v2` → `current_owner_user_id`
   - `v_opportunity_first_qualification_v2` → `first_qualification_at`, `qualified_by_user_id`
   - `v_loss_classification_v2` → loss_*, consolidated, source, status, bucket
   - LEFT JOIN `pipelines` p/ filtros futuros usarem `pipeline_type`
   - **Não filtra por status** — é a base universal

2. **`v_report_summary_v2`** — agrega por org filtrando `pipeline_type='sales'`. KPIs: active/won/lost counts e valores, win_rate.

3. **`v_report_processed_v2`** — won + lost por org + tickets médios.

4. **`v_report_losses_v2`** — agrega por (org, consolidated_loss_reason_id, source, status, bucket) com lost_count, lost_value, avg_lost_ticket.

5. **`v_report_losses_detail_v2`** — drilldown linha-a-linha usando `v_lost_deals_amounts_v2` direto.

6. **`v_report_origins_v2`** — agrega por (org, COALESCE(origem,'Sem origem')) com counts/valores/win_rate. Filtra `pipeline_type='sales'`.

7. **`v_report_forecast_v2`** — uma linha por org com primary pipeline:
   - `closed_revenue` = SUM(net_revenue_final WHERE status='won')
   - `open_pipeline_value` = SUM(commercial_amount_current WHERE status='active')
   - `weighted_pipeline_value` = SUM(commercial_amount_current * stage.probability/100)
   - metas via JOIN `organization_settings`
   - `forecast_reliability_pct` = % de open com `commercial_amount_current>0 AND close_date_prevista IS NOT NULL`

8. **`v_report_team_v2`** — agrega por (org, owner_user_id) + JOIN profiles p/ owner_name.

9. **`v_report_closer_v2`** — idem team_v2 + `avg_sales_cycle_days` = AVG(EXTRACT(EPOCH FROM (COALESCE(won_at,lost_at) - created_at))/86400) WHERE closed.

10. **`v_report_sdr_v2`** — agrega por (org, qualified_by_user_id):
    - `sqls_generated` = COUNT(WHERE first_qualification_at IS NOT NULL)
    - `revenue_attributed` = SUM(net_revenue_final WHERE status='won' AND first_qualification_at IS NOT NULL)
    - `avg_qualification_hours` = AVG(EXTRACT(EPOCH FROM (first_qualification_at - created_at))/3600)

11. **`v_report_handoff_v2`** — agrega por (org, qualified_by_user_id, owner_user_id) WHERE qualified_by != owner.

12. **`v_report_stage_balance_v2`** — agrega por (org, pipeline_id, stage_id) + JOIN stages.name. Usa `days_in_current_stage` real (Sprint 2.3).

13. **`v_report_stage_conversion_v2`** — usa `opportunity_stage_history`:
    - Para cada (from_stage_id, to_stage_id), COUNT(*) e taxa = transitions / SUM(transitions de from_stage)
    - JOIN stages 2x p/ nomes

14. **`v_report_accumulated_v2`** — `date_trunc('day', created_at)` com count + SUM(commercial_amount_current).

15. **Deprecation marker** — COMMENT ON VIEW p/ todas views legadas (não-V2) listando substituta:
    ```sql
    COMMENT ON VIEW public.v_lost_reasons_aggregated IS 'DEPRECATED Sprint 2.5 — usar v_report_losses_v2';
    ```
    Identificar via query `pg_views WHERE viewname NOT LIKE '%_v2'`.

16. Todas views com `WITH (security_invoker = true)`.

**FASE 2 — Frontend mínimo (12 hooks tipados + 1 arquivo de types):**

1. `src/types/reportingV2.ts` — interfaces dos 12 retornos + base `ReportingOpportunityV2`
2. `src/hooks/useReportSummaryV2.ts`
3. `src/hooks/useReportProcessedV2.ts`
4. `src/hooks/useReportLossesV2.ts`
5. `src/hooks/useReportOriginsV2.ts`
6. `src/hooks/useReportForecastV2.ts`
7. `src/hooks/useReportTeamV2.ts`
8. `src/hooks/useReportCloserV2.ts`
9. `src/hooks/useReportSDRV2.ts`
10. `src/hooks/useReportHandoffV2.ts`
11. `src/hooks/useReportStageBalanceV2.ts`
12. `src/hooks/useReportStageConversionV2.ts`
13. `src/hooks/useReportAccumulatedV2.ts`

Cada hook: React Query + `(supabase as any).from('view_name')` (evita TS2589) + `staleTime 60s`. Aceitam `{ organizationId, enabled }`.

**FASE 3 — Atualizar `reportsAuditStatus.ts`:** adicionar `REPORTS_CANONICAL_VIEW` mapeando `key → view_v2`.

**FASE 4 — Artifact `relatorios-v2-sprint2.5-checklist.md`** com mapa view↔hook↔relatório-alvo + lista de views deprecated.

### Decisões técnicas

- **`origem` via JOIN com `opportunities`** (hygiene_base não expõe) — mantém fonte canônica preservada.
- **Win Rate fórmula única**: `won::numeric / NULLIF(won + lost, 0) * 100` (alinhado com memória "Unified Win Rate").
- **`avg_sales_cycle_days`**: usa `COALESCE(won_at, lost_at) - created_at`, somente fechadas, não soft-deleted (já filtrado pela base).
- **`weighted_pipeline_value` (forecast)**: usa `stages.probability` direto (não memorizar). Memória forecast diz "is_primary=true e pipeline_type='sales'" — respeitado.
- **Conversão de etapa**: usa `opportunity_stage_history` Sprint 2.3 (não snapshot). `transition_rate_pct` = transições / total de saídas do `from_stage`.
- **Deprecation**: usa `COMMENT ON VIEW`, sem DROP. Critério #17 atendido.
- **`(supabase as any).from(...)`**: evita TS2589 (padrão estabelecido em Sprint 2.3 fix).
- **Active count**: `status NOT IN ('won','lost')` AND `deleted_at IS NULL` (já vem da base).

### Critérios de aceite (mapeamento)

| # | Como atende |
|---|---|
| 1-14 | FASE 1 — 1 view base + 13 views agregadas |
| 15 | Todas usam `v_*_v2` das sprints 2.1-2.4 |
| 16 | Win rate, ticket médio, cycle, conversion, weighted — tudo no SQL |
| 17 | `COMMENT ON VIEW` deprecated, sem DROP |

### Fora de escopo

- ❌ Refator de telas de relatórios (Sprint 6)
- ❌ Edge functions agendadas (Sprint 5)
- ❌ DROP de views antigas
- ❌ Materialização (CONCURRENTLY MATERIALIZED) — todas continuam VIEWs simples

### Risco

Baixo. 100% DDL aditivo. 14 views novas + 13 hooks + 1 types + 1 audit update + 1 artifact. Nenhuma tela existente muda.

### Tempo estimado

~40 min. 1 migration grande + 14 arquivos frontend + 1 artifact.

