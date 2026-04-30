# Sprint F2.2 — Forecast Snapshot Diário

Camada de histórico diário do Forecast V2, totalmente isolada da F2.1 e da UI atual. Reaproveita `calculate_forecast_audit_v2`, `forecast_calculation_runs` e `forecast_calculation_items` como fonte. Falhas no snapshot **nunca** podem quebrar o módulo Forecast.

---

## 1. Banco de dados (migration)

### Tabela `forecast_daily_snapshots`
Schema exatamente como especificado no prompt (id, organization_id, pipeline_id, snapshot_date, period_start/end, period_type='monthly', seller_id, run_id FK→`forecast_calculation_runs`, monthly_goal, todos os campos de valores/contagens/qualidade, accuracy_score nullable, metadata jsonb, timestamps).

Índices:
- `idx_forecast_daily_snapshots_org_date (organization_id, snapshot_date desc)`
- `idx_forecast_daily_snapshots_org_pipeline_period (organization_id, pipeline_id, period_start, period_end)`
- `idx_forecast_daily_snapshots_seller (organization_id, seller_id, snapshot_date desc)`
- Único: `uq_forecast_daily_snapshot_scope` com COALESCE em pipeline_id e seller_id (zero-uuid sentinel) para garantir upsert idempotente por (org, pipeline, snapshot_date, period, seller).

### Tabela `forecast_snapshot_job_logs`
Conforme prompt (status: running|completed|completed_with_errors|failed).

### RLS
Reaproveitar helpers já usados na F2.1 (`get_user_organization_id`, `has_role`). Padrão idêntico ao `forecast_calculation_runs`:
- **SELECT** snapshots: org match + (admin/owner OR seller_id = auth.uid() OR seller_id IS NULL com permissão de Forecast global).
- **INSERT/UPDATE**: apenas via SECURITY DEFINER (RPC) ou service role.
- **Logs**: SELECT só para owner/admin/platform_admin da org. INSERT só service role.

### Trigger updated_at
Reutilizar `update_updated_at_column()` se existir no projeto; senão criar `set_forecast_daily_snapshots_updated_at()`.

---

## 2. RPCs (SECURITY DEFINER, search_path = public)

### `create_forecast_daily_snapshot_v2(p_organization_id, p_pipeline_id, p_period_start, p_period_end, p_seller_id default null, p_snapshot_date default current_date) returns jsonb`

Fluxo:
1. Validar `auth.uid()` pertence à org (ou caller é service role).
2. Chamar `calculate_forecast_audit_v2(...)` → captura `run_id`.
3. Ler totals do `forecast_calculation_runs` (closed/commit/best_case, scenarios, confidence, nrhs_avg, data_quality_score, pipeline_total, deals counts).
4. Agregar de `forecast_calculation_items WHERE run_id = v_run_id`:
   - `no_recent_activity_count`: `last_activity_at IS NULL OR last_activity_at < now() - interval '7 days'`
   - `no_next_step_count`: `next_step_exists = false`
   - `expired_close_date_count`: `close_date < current_date AND eligibility_status <> 'excluded'`
   - `low_nrhs_count`: `nrhs_score < 60`
5. Buscar `monthly_goal` da config existente da organização (se houver tabela de metas; senão 0).
6. `INSERT ... ON CONFLICT (uq scope) DO UPDATE` setando todos os campos + `updated_at = now()`.
7. Retornar `jsonb` do snapshot.

Tudo dentro de bloco `BEGIN ... EXCEPTION WHEN OTHERS` que re-lança mas registra em log se chamado por edge function.

### `get_forecast_snapshots_v2(p_organization_id, p_pipeline_id default null, p_period_start default null, p_period_end default null, p_seller_id default null) returns table(...)`

Retorna todas as colunas listadas no prompt, ordenado por `snapshot_date asc`. Filtros opcionais via `WHERE (param IS NULL OR coluna = param)`. RLS já restringe automaticamente.

---

## 3. Edge Function `create-forecast-daily-snapshots`

`supabase/functions/create-forecast-daily-snapshots/index.ts` — service role.

Payload opcional: `{organization_id?, pipeline_id?, period_start?, period_end?, seller_id?}`.

Fluxo:
1. Criar registro em `forecast_snapshot_job_logs` (status=running).
2. Se payload completo → executar apenas aquele escopo.
3. Senão:
   - Buscar organizações ativas.
   - Para cada org, buscar pipelines comerciais (`is_primary=true` ou `pipeline_type='sales'`).
   - Para cada (org, pipeline): snapshot global (seller_id=null).
   - Para cada vendedor ativo (via `crm_active_users_view`) que tenha oportunidades no período: snapshot por seller.
4. Período padrão: primeiro→último dia do mês corrente em `America/Sao_Paulo`.
5. Cada chamada em try/catch; conta `attempted/created/failed`.
6. Atualizar log final (`completed` | `completed_with_errors` | `failed`).
7. Sempre retornar 200 com resumo (jamais quebrar caller).

CORS padrão. Validação Zod do payload.

---

## 4. Cron diário 23h50

Job `forecast_daily_snapshots_2350` (cron `50 23 * * *` em UTC-3 → ajustar conforme padrão usado em outros crons do projeto). Usar `pg_cron` + `pg_net` chamando a edge function via URL + anon key, padrão idêntico ao já usado em outros crons. Inserido via tool de insert (não migration), pois contém URL/key específicos.

---

## 5. Frontend

### Tipo
`src/types/forecast.ts` (criar se não existir) ou colocar em `src/hooks/useForecastAuditRun.ts`:

```ts
export interface ForecastDailySnapshot { /* todos os campos da tabela */ }
```

### Hook
`src/hooks/forecast/useForecastSnapshots.ts`:
- React Query, queryKey `['forecast-snapshots', org, pipeline, periodStart, periodEnd, seller]`.
- Chama `supabase.rpc('get_forecast_snapshots_v2', {...})`.
- Retorna `{snapshots, latestSnapshot, hasEnoughHistory (≥5), isLoading, error, refetch}`.
- `staleTime: 5min`.

Hook auxiliar `useCreateForecastSnapshot()` (mutation) para o botão manual → chama `create_forecast_daily_snapshot_v2`, invalida query, toast de sucesso/erro.

### UI da aba Acurácia
Atualizar `src/components/forecast/AccuracyDashboard.tsx` adicionando uma nova **seção superior** com o snapshot history (mantendo o conteúdo legacy abaixo, intacto, para não quebrar nada já entregue).

Estados:
- **0 snapshots**: card "Acurácia em formação" + mini-card (snapshots: 0, status: aguardando, próxima coleta: 23h50).
- **1–4 snapshots**: card "Histórico em formação" + lista (qtd, primeiro, último, último realista, último fechado, confiança).
- **≥5 snapshots**: 6 cards (último realista, fechado atual, gap vs meta, confiança, deals em risco, sem atividade) + gráfico Recharts (LineChart já usado no arquivo) com 3 linhas (realistic, closed, monthly_goal) + tabela (data, fechado, realista, otimista, melhor caso, confiança, riscos, higiene).

### Botão "Gerar snapshot agora"
Visível apenas para owner/admin/platform_admin (usar hook de role já existente, ex: `useUserRole`). Chama mutation, mostra loading, refetch.

---

## 6. Testes

Após deploy, executar via `supabase--read_query` os testes 1–4 do prompt usando uma org real. Validar idempotência e RLS via query separada.

---

## 7. Detalhes técnicos / segurança

- **search_path**: todas RPCs `SET search_path = public`.
- **SECURITY DEFINER** com validação explícita de `organization_id` vs `auth.uid()` (exceto service role).
- **Multitenancy**: jamais permitir snapshot cross-org — checagem na RPC e na RLS.
- **Resiliência UI**: `useForecastSnapshots` com `enabled` flag; falha silenciosa não derruba a aba (mostra estado vazio).
- **Edge function**: cada snapshot em try/catch isolado; falha em uma org não impede as outras.
- **Idempotência**: garantida pelo índice único + `ON CONFLICT DO UPDATE`.
- **Não tocar**: `RevenueForecastV2.tsx`, hooks F2.1, RPC `calculate_forecast_audit_v2`, demais abas do Forecast.
- **Memória do projeto**: respeitar `closed_at` immutable, soft delete, `is_primary=true`, terminologia "Organization", AI date guards (não aplicável aqui).

## Arquivos

**Novos:**
- `supabase/migrations/<ts>_forecast_daily_snapshots.sql`
- `supabase/functions/create-forecast-daily-snapshots/index.ts`
- `src/hooks/forecast/useForecastSnapshots.ts`

**Editados:**
- `src/components/forecast/AccuracyDashboard.tsx` (adiciona seção superior, mantém legacy)
- `src/types/forecast.ts` ou hook compartilhado (novo tipo)

**Insert (não migration):** cron job `forecast_daily_snapshots_2350`.

## Riscos

- Tabela de metas (`monthly_goal`): se não existir fonte, default 0 — não bloqueia.
- Volume: snapshot por seller pode gerar muitas linhas/dia em orgs grandes — mitigado pelo índice único e por filtrar apenas sellers com oportunidades no período.
- Cron timezone: confirmar se `pg_cron` está em UTC e ajustar para `02:50 UTC` = 23h50 BRT.

## Próximos passos (pós-aprovação)

Implementar nesta ordem: migration → RPCs → edge function → cron → hook → UI Acurácia → testes RPC → testes UI manual.
