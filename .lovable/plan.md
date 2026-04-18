

## Sprint 2.6 — Edge Functions Canônicas dos Relatórios V2

### Contexto confirmado
- **Sprint 2.5 entregou** 14 views canônicas + base unificada `v_reporting_opportunities_v2`
- **Coverage views já existem**: `v_opportunity_amount_coverage_v2` (Sprint 2.2), `v_opportunity_history_coverage_v2` (Sprint 2.3), `v_loss_classification_coverage_v2` (Sprint 2.4)
- **`_shared/` só tem `run-logger.ts`** — vou adicionar 6 utilitários novos
- **Padrão de auth**: JWT do header → `userClient.rpc('get_user_organization_id')` → validar igualdade com `organizationId` do request
- **`config.toml`**: edge functions já deployam com `verify_jwt = false` por padrão; valido JWT em código

### Plano de execução

**FASE 1 — Camada compartilhada (`supabase/functions/_shared/`)**

1. **`reportClient.ts`** — factory de 2 clientes:
   - `userClient(authHeader)` para validar identidade via `get_user_organization_id`
   - `serviceClient()` com `SUPABASE_SERVICE_ROLE_KEY` para ler views (bypass RLS, mas com escopo manual por `organization_id`)

2. **`reportRequest.ts`** — schema Zod do request canônico (organizationId obrigatório, filters/options opcionais com defaults). Helper `parseReportRequest(req)` que retorna `{ ok, value | error }`.

3. **`reportFilters.ts`** — `applyCanonicalFilters(query, filters)`:
   - aplica `dateRange` no campo configurável (default `created_at`)
   - aplica `pipelineIds`, `ownerUserIds`, `qualifiedByUserIds`, `originNames`, `stageIds`, `status`, `lossReasonIds` via `.in()`
   - aplica `teamVisibility.visibleUserIds` quando `enabled=true`

4. **`reportResponse.ts`** — builders `okResponse({reportKey, organizationId, data, filtersApplied, confidence, debug?})` e `errResponse({reportKey, code, message, status})`. Inclui CORS headers.

5. **`reportConfidence.ts`** — `computeConfidence({monetary?, history?, loss?, custom?})`:
   - lê das 3 coverage views V2 quando solicitado
   - retorna `{ level: 'high'|'medium'|'low'|'unavailable', score: 0-100, breakdown: {...} }`
   - regra: <50% → low; 50-80% → medium; >80% → high; sem dados → unavailable

6. **`reportAuth.ts`** — `authorize(req, requestedOrgId)`:
   - extrai JWT, chama `userClient.rpc('get_user_organization_id')`
   - bloqueia se org diferente
   - resolve `canDebug` via role admin (`has_role(uid, 'admin')`)
   - retorna `{ userId, organizationId, canDebug }` ou erro `401`/`403`

**FASE 2 — 14 edge functions**

Cada function segue o mesmo esqueleto:

```ts
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const parsed = await parseReportRequest(req);
  if (!parsed.ok) return errResponse({ reportKey, code: 'BAD_REQUEST', message: parsed.error, status: 400 });
  const auth = await authorize(req, parsed.value.organizationId);
  if (!auth.ok) return errResponse({ reportKey, code: auth.code, message: auth.message, status: auth.status });
  const sb = serviceClient();
  const { data, error } = await applyCanonicalFilters(
    sb.from('v_report_xxx_v2').select('*').eq('organization_id', parsed.value.organizationId),
    parsed.value.filters,
  );
  if (error) return errResponse({ reportKey, code: 'QUERY_FAILED', message: error.message, status: 500 });
  const confidence = await computeConfidence(sb, parsed.value.organizationId, { /* per-report flags */ });
  return okResponse({ reportKey, organizationId: parsed.value.organizationId, data, filtersApplied: parsed.value.filters, confidence, debug: auth.canDebug ? {...} : undefined });
});
```

Lista (todas em `supabase/functions/<name>/index.ts`):

7. **`report_summary_v2`** — view `v_report_summary_v2`. Confidence usa monetary + history.
8. **`report_processed_v2`** — view `v_report_processed_v2`.
9. **`report_losses_v2`** — view `v_report_losses_v2` + coverage de perdas.
10. **`report_losses_detail_v2`** — view `v_report_losses_detail_v2` com paginação (`limit/offset/sortBy/sortOrder`).
11. **`report_origins_v2`** — view `v_report_origins_v2`.
12. **`report_forecast_v2`** — view `v_report_forecast_v2` + computa cenários:
    - pessimistic = closed + weighted * 0.5
    - realistic = closed + weighted
    - optimistic = closed + weighted * 1.5
    - bestCase = closed + open
    - confidence pondera `forecast_reliability_pct` + presença de meta + primary pipeline
13. **`report_team_v2`** — view `v_report_team_v2`.
14. **`report_closer_v2`** — view `v_report_closer_v2`.
15. **`report_sdr_v2`** — view `v_report_sdr_v2` + history coverage.
16. **`report_handoff_v2`** — view `v_report_handoff_v2`.
17. **`report_stage_balance_v2`** — view `v_report_stage_balance_v2` + history coverage. Se cobertura <50%, retorna `confidence.level='partial'` e `avg_days_in_stage` permanece tal qual da view (não inventa).
18. **`report_stage_conversion_v2`** — view `v_report_stage_conversion_v2`.
19. **`report_accumulated_v2`** — view `v_report_accumulated_v2`.
20. **`report_reconcile_v2`** — chama em paralelo `v_report_summary_v2`, `v_report_processed_v2`, `v_report_forecast_v2`, agrega `v_report_closer_v2.won_revenue` e `v_report_losses_v2.lost_count`. Retorna `checks[]` com `{ key, expected, actual, delta, isConsistent, severity }` + `overallStatus`. Logs em `report_reconciliation_logs`.

**FASE 3 — Migration mínima (1 tabela)**

21. **`public.report_reconciliation_logs`** — colunas conforme spec + RLS (SELECT por membros da org via `has_organization_access`, INSERT só via service role) + índice `(organization_id, created_at DESC)`.

**FASE 4 — Frontend mínimo**

22. **`src/lib/reports/edgeReportClient.ts`** — wrapper `callReportEdgeFunction<T>(name, payload)` usando `supabase.functions.invoke()` com tipagem genérica do envelope `{success, data, meta, error}`.

23. **`src/types/reportEdgeV2.ts`** — interfaces `ReportEdgeRequest`, `ReportEdgeResponse<T>`, `ReportConfidence`, `ReportMeta`, `ReportEdgeError`.

24. **Atualizar `src/lib/reports/reportsAuditStatus.ts`** — adicionar `REPORTS_EDGE_FUNCTION` map (key → function name).

**FASE 5 — Artifact `relatorios-v2-sprint2.6-checklist.md`** com tabela view↔edge↔hook futuro + critérios atendidos.

### Decisões técnicas

- **Service role para queries de view** — necessário p/ ler views agregadas que somam dados de toda a org sem custo de RLS por linha; segurança preservada via validação de `organization_id` antes da query.
- **Zod via `npm:zod@3`** — padrão estável em edge runtime.
- **`teamVisibility`**: quando `enabled=true`, aplica `.in('owner_user_id', visibleUserIds)` apenas em views que expõem essa coluna (team, closer, sdr, handoff, summary). Outras views ignoram silenciosamente — documentado em `reportFilters.ts`.
- **`includeDebug`**: só populado quando `auth.canDebug` é true (role admin); inclui SQL filtros aplicados, durations, contagens intermediárias.
- **`config.toml`**: NÃO modifico (default `verify_jwt = false` aceitável; valido em código via `reportAuth`).
- **`report_reconcile_v2`** — single source of consistency check; futura cron pode chamá-lo via `daily-backup-cron`.
- **Compatibilidade Sprint 2.5**: hooks existentes (`useReportSummaryV2` etc) continuam lendo views diretamente — não quebram. Sprint 6 migrará para `callReportEdgeFunction` quando o frontend for refatorado.

### Critérios de aceite (mapeamento)

| # | Como atende |
|---|---|
| 1 | FASE 1.1 — `reportClient.ts` |
| 2 | FASE 1.2 — `reportRequest.ts` (Zod) |
| 3 | FASE 1.4 — `reportResponse.ts` (ok+err) |
| 4-19 | FASE 2 — 14 edge functions + reconcile |
| 20 | FASE 1.3 — `applyCanonicalFilters` |
| 21 | `errResponse` com códigos padronizados |
| 22 | `auth.canDebug` via `has_role` |

### Fora de escopo
- ❌ Refator de telas (Sprint 6+)
- ❌ Cron de reconciliação (Sprint 5)
- ❌ Materialização de views
- ❌ Cache em Redis/KV

### Risco
Baixo. 100% novo código: 6 utilitários `_shared` + 14 edge functions + 1 tabela + 2 arquivos frontend. Zero edição de telas/views existentes. Default `verify_jwt=false` mantém compat com hooks atuais que ainda leem views diretamente.

### Tempo estimado
~50 min. 6 shared + 14 edge functions + 1 migration + 2 arquivos frontend + 1 audit update + 1 artifact.

