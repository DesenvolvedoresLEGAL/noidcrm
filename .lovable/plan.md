# Sprint F2.8 — Forecast V2 QA, Governança e Consolidação Final

Sprint de fechamento. Foco: confiança, consistência e estados padronizados. Sem reescrever engine, sem nova inteligência.

## 1. Backend (1 migration)

### Schema
- `ALTER TABLE public.forecast_snapshot_job_logs ADD COLUMN IF NOT EXISTS duration_ms integer;`
- `ALTER TABLE public.forecast_calculation_runs ADD COLUMN IF NOT EXISTS duration_ms integer;`
- Nova tabela `public.forecast_v2_health_logs` (id, organization_id, pipeline_id, period_start, period_end, status, warnings_count, errors_count, duration_ms, metadata jsonb, created_at). RLS: SELECT só admin/owner/manager/platform_admin da org; INSERT bloqueado (apenas SECURITY DEFINER da RPC grava).

### RPC `get_forecast_v2_health_check(p_organization_id, p_period_start, p_period_end, p_pipeline_id)`
- `SECURITY DEFINER`, `SET search_path = public`.
- Permissão: apenas admin/owner/manager/platform_admin da org. Caso contrário retorna `{status:'forbidden'}`.
- Lê:
  - `feature_flags` para `forecast_v2_engine_enabled` (e `enable_forecast_v2` como fallback de chave já usado pela engine).
  - `forecast_calculation_runs` mais recente do (org, pipeline, período) → `latest_run_at`, `calculation_version`, `total_closed`, scenarios, `total_commit`, `duration_ms`.
  - `forecast_daily_snapshots` mais recente do período + count → `latest_snapshot_at`, `snapshots_count`, scenarios snapshot.
  - `forecast_snapshot_job_logs` mais recente → `snapshot_job_last_status`, `duration_ms`.
  - `forecast_calculation_items` do último run para checks de fim de mês contaminado.
  - `sales_goals`/`seller_targets` para detectar vendedores com oportunidades sem meta no período.
- Calcula validações de consistência (ver §2). Cada falha vira `errors[]` ou `warnings[]` com `code`, `message` e `severity`.
- Calcula readiness por módulo: `accuracy_ready` (snapshots_count ≥ 5 e existe `accuracy_score`), `seller_performance_ready`, `intelligence_ready`, `risk_center_ready` (depende apenas de existir run recente).
- Performance: lê `duration_ms` das tabelas de log. Se algum > 3000ms → warning; > 8000ms → error. Mede o tempo do próprio health-check via `clock_timestamp()` e devolve `last_health_check_ms`. Calcula `latest_run_age_minutes` e `latest_snapshot_age_hours`.
- Status final agregado:
  - `not_ready`: feature flag desligada ou nenhum run.
  - `critical`: qualquer item em `errors[]`.
  - `attention`: warnings sem errors.
  - `healthy`: nenhum.
- Insere uma linha em `forecast_v2_health_logs` (best-effort, dentro de `BEGIN/EXCEPTION`).
- `GRANT EXECUTE TO authenticated`.

## 2. Validações de consistência (todas dentro da RPC)

- `closed_matches_pessimistic`: `ABS(scenario_pessimistic - total_closed - total_commit*0.7) ≤ 1`. Se diferente → error "Pessimista não bate com fechado".
- Ordem `pessimistic ≤ realistic ≤ optimistic ≤ best_case` → error se quebrar.
- `commit_not_above_best_case`: `total_commit ≤ scenario_best_case + 1`.
- `snapshot_matches_latest_run`: para cada um dos 5 campos comparar diferença ≤ R$ 1,00.
- `realistic_protected_eom`: se `(period_end - current_date) ≤ 1`, conta deals no run com `forecast_bucket='realistic'` que falham em `last_activity_at ≥ now()-2d` AND `next_step_exists` AND `nrhs_score ≥ 70` AND `(adjusted_probability ≥ 70 OR manual_probability ≥ 70)`. Warning se >0; error se valor agregado > 30% do `scenario_realistic`.
- `sellers_without_goal`: vendedores com items no run e sem `sales_goals`/`seller_targets` ativo no período → warning com contagem.
- `accuracy_low_sample`: `snapshots_count < 5` → warning "Acurácia ainda em formação".

## 3. Frontend

### Tipos — `src/types/forecast-health.ts` (novo)
- `ForecastV2HealthCheck`, `HealthStatus`, `HealthIssue`, `DataConsistency`, `PerformanceStats`.

### Hook — `src/hooks/forecast/useForecastV2Health.ts` (novo)
- `useQuery` `['forecast-v2-health', org, pipeline, start, end]`, `staleTime: 60s`.
- Mutations: `useRecalculateForecast` (chama `calculate_forecast_audit_v2`), `useGenerateSnapshot` (`create_forecast_daily_snapshot_v2`), `useCalculateAccuracy` (`calculate_forecast_accuracy_v2`). Cada mutation invalida queries relacionadas e toast (sonner).

### Componente — `src/components/forecast/health/ForecastV2HealthPanel.tsx` (+ subcomponentes)
- `HealthStatusCard` (status geral colorido).
- `HealthMetricsGrid` (Feature Flag, Último Cálculo, Último Snapshot, Snapshots, Acurácia, Engine, Risk Center, AI).
- `HealthConsistencyChecks` (lista de checks com ✓/✗).
- `HealthIssuesList` (warnings, errors, recommendations).
- `HealthActionsBar` (4 botões admin com loading state).
- `FeatureFlagOffBanner`: se `feature_flag_enabled=false`, mostra banner com SQL para ativar (não executa automaticamente).

### Permissão na UI
- Usa `useUserRoles` (existente) para esconder o painel para non-admin/manager/owner/platform_admin.

### Wiring — `src/pages/Forecast.tsx`
- Nova `<TabsTrigger value="health">` chamada **"Saúde V2"**, escondida via condicional para non-privileged. Conteúdo `<ForecastV2HealthPanel periodStart periodEnd pipelineId />`.

## 4. Estados vazios e fallbacks padronizados
Criar componente reutilizável `src/components/forecast/shared/ForecastEmptyState.tsx` (`title`, `description`, optional `action`). Substituir empty states inline em:
- `AccuracyDashboard.tsx`
- `ForecastIntelligencePanel.tsx`
- `ForecastRiskCenterPanel.tsx` (já tem; usar componente compartilhado)
- `seller-performance/SellerPerformanceSection.tsx`
- `DealInspectionTable.tsx`
- `ForecastDataQuality.tsx`

Fallback padrão: cada panel já tem fallback; padronizar mensagem via constante `FORECAST_RPC_FAILURE_MESSAGE`. Console.error apenas em `import.meta.env.DEV`.

## 5. Riscos & Mitigações
- **Não duplicar snapshot do dia**: `create_forecast_daily_snapshot_v2` já faz UPSERT — basta confiar.
- **RPC pesada**: health-check faz apenas SELECTs agregados (sem reler items inteiros, exceto contagem/agregação para EOM check com filtros indexados via run_id).
- **Cross-tenant**: RPC enforce `p_organization_id = get_user_organization_id()`.
- **Tabela `forecast_v2_health_logs`**: insert via SECURITY DEFINER bypass RLS (RLS bloqueia INSERT direto).

## 6. Arquivos
**Criar**
- `supabase/migrations/<ts>_forecast_v2_health.sql`
- `src/types/forecast-health.ts`
- `src/hooks/forecast/useForecastV2Health.ts`
- `src/components/forecast/health/ForecastV2HealthPanel.tsx`
- `src/components/forecast/health/HealthStatusCard.tsx`
- `src/components/forecast/health/HealthMetricsGrid.tsx`
- `src/components/forecast/health/HealthConsistencyChecks.tsx`
- `src/components/forecast/health/HealthIssuesList.tsx`
- `src/components/forecast/health/HealthActionsBar.tsx`
- `src/components/forecast/health/FeatureFlagOffBanner.tsx`
- `src/components/forecast/shared/ForecastEmptyState.tsx`

**Editar**
- `src/pages/Forecast.tsx` (nova tab `Saúde V2` com permissão)
- 3-4 panels existentes para adotar o `ForecastEmptyState` compartilhado

## 7. Critérios de aceite cobertos
RPC health, tabela de logs, painel admin-only, banner de feature flag, validações de consistência (cenários, snapshots, fim de mês, vendedor sem meta, baixa amostra), botões admin com loading/toast, fallbacks padronizados, empty states uniformes, performance medida e nada cross-tenant.
