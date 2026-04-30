# Sprint F2.1 — Forecast Audit Layer

Adicionar uma camada de **rastreabilidade** ao módulo Forecast V2: cada número exibido passa a ter origem, fórmula, deals incluídos, deals excluídos e motivos de penalização — sem alterar visual nem quebrar o módulo atual.

## Estratégia

- Persistir cada cálculo de forecast em duas tabelas novas (`forecast_calculation_runs` + `forecast_calculation_items`).
- Expor uma RPC `calculate_forecast_audit_v2` que classifica cada oportunidade em buckets (`closed`, `commit`, `best_case`, `realistic`, `optimistic`, `pipeline_only`, `excluded`) com motivos.
- Adicionar dois hooks de leitura (`useForecastAuditRun`, `useForecastAuditItems`).
- Adicionar **apenas um botão "Ver cálculo"** no `RevenueForecastV2` que abre um Drawer com o detalhamento. Nada mais muda na UI.
- O módulo atual continua funcionando mesmo se a auditoria falhar (try/catch isolado, sem dependência hard).

## Banco de dados (migration)

### Tabela `forecast_calculation_runs`
Campos exatamente conforme especificação (id, organization_id, pipeline_id, period_start/end, period_type, seller_id, created_by, calculation_version='forecast_v2_audit_1', status, totais, scenarios, forecast_confidence, nrhs_avg, data_quality_score, pipeline_total, contagens, metadata, created_at).

Índices: `(organization_id, created_at desc)`, `(organization_id, pipeline_id, period_start, period_end)`.

### Tabela `forecast_calculation_items`
Campos conforme especificação. CHECK constraints em:
- `forecast_bucket IN ('closed','commit','best_case','realistic','optimistic','pipeline_only','excluded')`
- `eligibility_status IN ('included','penalized','excluded','slipping')`

Índices: `(run_id)`, `(organization_id, opportunity_id)`, `(run_id, forecast_bucket)`, `(run_id, eligibility_status)`.

### RLS

Ativar RLS nas duas tabelas. Reusar helpers existentes (`get_user_organization_id()`, `has_role()`) — sem duplicar.

Políticas `SELECT`:
- `runs`: `organization_id = get_user_organization_id()` AND (admin/owner/manager OR `seller_id IS NULL` OR `seller_id = auth.uid()` OR `created_by = auth.uid()`).
- `items`: mesma lógica via join lógico (organização + role OR seller_id próprio).

Políticas `INSERT`: apenas via SECURITY DEFINER (a RPC). Sem políticas `UPDATE`/`DELETE` para usuários.

## RPC `calculate_forecast_audit_v2`

Assinatura:
```
calculate_forecast_audit_v2(
  p_organization_id uuid,
  p_pipeline_id uuid,
  p_period_start date,
  p_period_end date,
  p_seller_id uuid default null
) returns jsonb
```

`SECURITY DEFINER`, `set search_path = public`. Valida que `auth.uid()` pertence a `p_organization_id` antes de qualquer leitura.

### Fluxo

1. INSERT em `forecast_calculation_runs` com `status='running'` → captura `v_run_id`.
2. SELECT oportunidades da org+pipeline (filtro opcional por `owner_user_id = p_seller_id`), excluindo `deleted_at IS NOT NULL`. Janela: `closed_at` no período (para won/lost) OU `close_date_prevista` no período (para abertas) OU stage aberto sem close date (entram como `pipeline_only`).
3. Para cada opp, calcular fatores e classificar (regras abaixo). INSERT em `forecast_calculation_items`.
4. Recalcular agregados (somas por bucket, contagens, NRHS médio, data_quality_score) e UPDATE no run com `status='completed'`.
5. Retornar `jsonb { run_id, total_closed, total_commit, total_best_case, scenario_*, deals_count, included_deals_count, excluded_deals_count }`.

### Regras de classificação

Variáveis derivadas por opp:
- `prob = COALESCE(opp.prob, stage.probability, 0)`
- `nrhs = COALESCE(opp.nrhs_score, 0)`
- `value = COALESCE(opp.valor_previsto, opp.mrr_value*12+opp.arr_value, 0)`
- `has_recent_activity = last_contact_date >= now() - interval '14 days'`
- `has_next_step = next_followup_date IS NOT NULL`
- `slipping = close_date_prevista < CURRENT_DATE AND status='open'`

Decisão (em ordem):
| Condição | bucket | eligibility | exclusion/penalty |
|---|---|---|---|
| `status='won'` no período | `closed` | included | — |
| `value <= 0` | `excluded` | excluded | `no_value` |
| `prob IS NULL OR prob = 0` | `excluded` | excluded | `no_probability` |
| `nrhs < 40` | `excluded` | excluded | `low_nrhs` |
| `status='lost'` | `excluded` | excluded | `lost` |
| `slipping` AND stage avançado (prob>=70) | `commit` | slipping | penalty `slipping_close_date` |
| `slipping` (demais) | `realistic` | slipping | penalty `slipping_close_date` |
| `prob>=70 AND nrhs>=70 AND close_date∈período AND has_recent_activity AND has_next_step` | `commit` | included | — |
| `prob>=50 AND nrhs>=60 AND close_date∈período` | `realistic` | included/penalized | penalty se faltar atividade ou next step |
| `prob>=25 AND nrhs>=50 AND status='open'` | `optimistic` | included/penalized | idem |
| outras abertas | `pipeline_only` | included | — |

`adjusted_value = value * adjusted_probability/100`, com `adjusted_probability = prob × nrhs_factor × time_factor × activity_factor` (mesma lógica que já existe em `forecast.ts`/`useForecastData.ts`, reaproveitada).

Cenários do run (somatórios):
- `scenario_pessimistic = sum(closed) + sum(commit)*0.7`
- `scenario_realistic = sum(closed) + sum(commit) + sum(realistic)*0.5`
- `scenario_optimistic = sum(closed) + sum(commit) + sum(realistic) + sum(optimistic)*0.5`
- `scenario_best_case = sum(closed) + sum(commit) + sum(realistic) + sum(optimistic) + sum(best_case)`
- `total_commit = sum(closed)+sum(commit)`, `total_best_case = scenario_best_case`.

`forecast_confidence` e `data_quality_score`: aproveitar lógica já existente em `services/crm/forecastConfidence.ts` (chamada inline ou via subquery sobre os items). `nrhs_avg = avg(nrhs_score) WHERE nrhs IS NOT NULL`.

## Frontend

### Hooks novos
- **`src/hooks/useForecastAuditRun.ts`** — `useMutation` que invoca a RPC e cacheia o último run via React Query (`forecastKeys.audit(orgId, pipelineId, period)`). Exponde `{ run, runId, isLoading, error, runCalculation }`.
- **`src/hooks/useForecastAuditItems.ts`** — `useQuery` que lê `forecast_calculation_items` por `run_id` com filtros opcionais (`bucket`, `seller_id`, `risk_level`, `eligibility_status`, `exclusion_reason`).

### UI mínima
- **`src/components/reports/v2/forecast-audit/ForecastAuditButton.tsx`** — botão `variant="ghost"` com ícone `Calculator`, label "Ver cálculo", abre o drawer.
- **`src/components/reports/v2/forecast-audit/ForecastAuditDrawer.tsx`** — usa `Sheet` (shadcn) lado direito. Seções:
  1. Resumo do run (período, pipeline, totais, confiança, NRHS médio).
  2. Fórmula textual de cada cenário.
  3. Cards por bucket com contagem e soma.
  4. Top 5 motivos de penalização (agregação client-side de `penalty_reasons`).
  5. Top 5 motivos de exclusão (agregação de `exclusion_reasons`).
  6. Lista paginada (20 por página) de deals com link para o detalhe.
- **`src/components/reports/v2/RevenueForecastV2.tsx`** — adicionar **apenas** o `<ForecastAuditButton>` no header do componente, ao lado do título existente. Nada mais é alterado.

### Isolamento de falhas
O drawer faz seu próprio fetch. Se a RPC falhar, exibe `Alert` com retry — o restante do `RevenueForecastV2` continua renderizando normalmente.

## Arquivos a criar
- `supabase/migrations/<timestamp>_forecast_audit_layer.sql`
- `src/hooks/useForecastAuditRun.ts`
- `src/hooks/useForecastAuditItems.ts`
- `src/components/reports/v2/forecast-audit/ForecastAuditButton.tsx`
- `src/components/reports/v2/forecast-audit/ForecastAuditDrawer.tsx`
- `src/components/reports/v2/forecast-audit/ForecastAuditBucketCard.tsx`
- `src/components/reports/v2/forecast-audit/ForecastAuditDealsList.tsx`

## Arquivos a editar
- `src/components/reports/v2/RevenueForecastV2.tsx` — inserir o botão no header.
- `src/lib/query-keys.ts` — adicionar `forecastKeys.audit(...)`.

## Riscos & Mitigações
- **Custo de execução da RPC**: limitada a opps da org+pipeline+janela; índices já existem em `(organization_id, status, closed_at)` e `(organization_id) WHERE deleted_at IS NULL`.
- **RLS**: políticas reusam `get_user_organization_id()`/`has_role()` — sem recursão.
- **Não regressão**: nenhum hook/serviço existente do Forecast é tocado. O botão é aditivo.
- **Multi-tenant**: a RPC valida `p_organization_id == get_user_organization_id()` antes de qualquer leitura.
- **Permissões SDR/Sales**: vendedor comum só vê items do próprio `seller_id`, alinhado com [Permission model](mem://architectural-decision/access-control/unified-permission-and-visibility-model).

## Critérios de aceite
- Botão "Ver cálculo" abre drawer e mostra resumo do run, buckets e top motivos.
- Cada opp usada aparece em `forecast_calculation_items` com bucket e motivos.
- Cada exclusão tem `exclusion_reasons` preenchido; cada penalização tem `penalty_reasons`.
- Falha da RPC não derruba o `RevenueForecastV2`.
- Nenhum item de outra organização é visível (validado via RLS + filtro server-side).
