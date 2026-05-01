# Sprint F2.5 — Acurácia Real do Forecast

Medir se o Forecast acerta, infla ou subestima, comparando os snapshots diários (F2.2) com o que foi efetivamente fechado no período.

---

## 1. Diagnóstico

- `forecast_daily_snapshots` já guarda `closed_won_final_amount`, `forecast_error_amount`, `forecast_error_percentage` e `accuracy_score`. Faltam os campos da F2.5: erros específicos por cenário, `bias_direction` e `accuracy_calculated_at`.
- A engine V2 já define "fechado" como `o.status='won' AND o.closed_at::date BETWEEN start AND end` (com soft-delete excluído). Vamos reusar essa mesma fórmula numa nova RPC auxiliar.
- A aba **Acurácia** hoje exibe `ForecastSnapshotHistory` no topo + `AccuracyDashboard` (métricas legadas IA vs humano por probabilidade). Vamos **inserir um novo painel `ForecastAccuracyPanel` acima** do histórico, sem remover o legado.

---

## 2. Backend — Migration única

### 2.1 Schema
Adicionar (idempotente) em `forecast_daily_snapshots`:
- `actual_closed_amount numeric` (espelha `closed_won_final_amount` — usaremos o novo nome em todo o pipeline V2; fallback de leitura para `closed_won_final_amount` quando NULL).
- `realistic_error_amount`, `realistic_error_percentage` (numéricos)
- `optimistic_error_amount`, `optimistic_error_percentage`
- `best_case_error_amount`, `best_case_error_percentage`
- `bias_direction text` com CHECK `IN ('overestimating','underestimating','balanced','unknown')`
- `accuracy_calculated_at timestamptz`

### 2.2 RPC `get_forecast_actual_closed_amount_v2(org, pipeline, start, end, seller)`
`STABLE SECURITY DEFINER`, `search_path=public`. Soma `proposal_value` (mesma lógica do `total_closed` da engine):
```sql
SELECT COALESCE(SUM(proposal_value),0)
FROM opportunities
WHERE organization_id = p_org
  AND deleted_at IS NULL
  AND status = 'won'
  AND closed_at::date BETWEEN p_period_start AND p_period_end
  AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
  AND (p_seller_id IS NULL OR owner_user_id = p_seller_id);
```
Tenant guard: caller_org via `get_user_organization_id()`; rejeita mismatch (exceto `is_platform_admin`).

### 2.3 RPC `calculate_forecast_accuracy_v2(org, pipeline, start, end, seller)` → `jsonb`
`SECURITY DEFINER`, `search_path=public`.

Passos:
1. Tenant + permissão (sellers comuns → força `seller := auth.uid()`).
2. `actual := get_forecast_actual_closed_amount_v2(...)`.
3. Carrega snapshots do escopo (`organization_id`, `period_start`, `period_end`, `pipeline_id` e `seller_id` com tratamento NULL exato).
4. **Para cada snapshot**, calcula erros segundo as fórmulas da spec:
   - `error_amt = scenario - actual`
   - `error_pct = CASE WHEN actual>0 THEN abs(error_amt)/actual*100 WHEN scenario>0 THEN 100 ELSE 0 END`
   - Repete para Realista/Otimista/Melhor Caso.
   - `accuracy_score = GREATEST(0, 100 - realistic_error_percentage)`.
   - `bias_direction` baseado em `scenario_realistic` vs `actual` × 1.10 / 0.90 (com `unknown` quando `actual=0` e `scenario=0`).
   - `UPDATE` em massa via CTE/`UPDATE ... FROM (VALUES ...)` para preencher os 9 campos + `accuracy_calculated_at = now()`.
5. Agrega resumo:
   - `avg_realistic_forecast`, `last_realistic_forecast` (último por `snapshot_date`).
   - `avg_error_amount`, `avg_error_percentage`, `mape` (média de `realistic_error_percentage`).
   - `accuracy_score = GREATEST(0, 100 - mape)`.
   - `bias_direction` consolidado (mesma regra usando médias).
   - `best_snapshot` / `worst_snapshot`: jsonb com `{snapshot_date, realistic_error_percentage, scenario_realistic, actual_closed_amount}` (menor/maior `realistic_error_percentage`).
   - `forecast_trend`: divide snapshots em primeira vs segunda metade (ordenadas por data); `improving` se segunda < primeira em mais de 10%, `worsening` se maior em mais de 10%, `stable` caso contrário; `unknown` com <5 snapshots.
   - `calculation_version`: pega `MAX(calculation_version)` dos snapshots.
6. Retorna o JSON com a forma exigida.

### 2.4 RPC `get_forecast_seller_accuracy_v2(org, pipeline, start, end)` → TABLE
Itera vendedores ativos via `crm_active_users_view` respeitando escopo (admin/owner/manager/platform_admin → todos; demais → só `auth.uid()`). Para cada vendedor:
- Chama `calculate_forecast_accuracy_v2(..., seller_id)` reaproveitando a engine.
- Devolve `seller_id`, `seller_name`, `seller_email`, `snapshots_count`, `actual_closed_amount`, `avg_realistic_forecast`, `last_realistic_forecast`, `avg_error_percentage`, `accuracy_score`, `bias_direction`, `forecast_trend`, `calculation_version`.
- Não filtra por amostra mínima — UI mostra badge "Baixa amostra" quando `snapshots_count < 5`.

### 2.5 Confiança histórica (não invasiva)
**Nesta sprint** vamos apenas marcar `metadata.historical_accuracy_penalty_ready = true` no run V2 (uma linha extra no `UPDATE forecast_calculation_runs.metadata`). A penalidade de confiança baseada em acurácia histórica fica **preparada** mas **desligada** — evita risco de regressão. Documentado para F2.6.

### 2.6 Segurança
- `GRANT EXECUTE ... TO authenticated` nas 3 RPCs.
- Sem RLS nova; RPCs são gatekeepers.
- Tenant guard explícito em todas (rejeita mismatch).

---

## 3. Frontend

### 3.1 Tipos — `src/types/forecast-accuracy.ts`
```ts
type ForecastBias = 'overestimating'|'underestimating'|'balanced'|'unknown';
type ForecastTrend = 'improving'|'worsening'|'stable'|'unknown';
interface ForecastAccuracySummary { actual_closed_amount, snapshots_count, avg_realistic_forecast, last_realistic_forecast, avg_error_amount, avg_error_percentage, mape, accuracy_score, bias_direction, best_snapshot, worst_snapshot, forecast_trend, calculation_version, seller_id }
interface ForecastSellerAccuracy { seller_id, seller_name, seller_email, snapshots_count, actual_closed_amount, avg_realistic_forecast, last_realistic_forecast, avg_error_percentage, accuracy_score, bias_direction, forecast_trend, calculation_version }
```

### 3.2 Hook — `src/hooks/forecast/useForecastAccuracy.ts`
- `useQuery` (read) chamando `calculate_forecast_accuracy_v2` (a função já lê e atualiza; tratada como leitura idempotente — disparada apenas quando UI monta ou quando `calculateAccuracy` é invocado).
- `useQuery` (read) chamando `get_forecast_seller_accuracy_v2`.
- `calculateAccuracy()` força refetch das duas queries.
- Retorna `{ accuracy, sellerAccuracy, isLoading, error, calculateAccuracy, refetch }`.

### 3.3 Componente — `src/components/forecast/ForecastAccuracyPanel.tsx`
- Lê snapshots existentes (reutiliza `useForecastSnapshots`) para decidir entre **estado <5 snapshots** ("Acurácia em formação", último realista, fechado, versão e botão admin) e **estado ≥5** com:
  - 6 cards: Acurácia Geral, Erro Médio (%), Tendência, Bias, Melhor Previsão, Pior Previsão.
  - Labels PT-BR (mapping fixo no componente).
  - Botão **"Calcular acurácia agora"** visível apenas para `owner | admin | manager | platform_admin` (`useUserRole` + `useCurrentUser`), dispara `calculateAccuracy()` + toast.
- **Tabela "Acurácia por Vendedor"** com colunas da spec; badge "Baixa amostra" para `snapshots_count < 5`.
- **Resiliência**: erro da RPC → renderiza um `Alert` discreto e some o painel (mantém histórico legado abaixo).
- **Período aberto**: badge "Parcial — mês em andamento" quando `period_end > today`.

### 3.4 Atualização no histórico — `ForecastSnapshotHistory.tsx`
- Adicionar colunas na tabela: **Erro R$**, **Erro %**, **Acurácia**, **Bias**, **Versão** (lendo `realistic_error_amount`, `realistic_error_percentage`, `accuracy_score`, `bias_direction`, `calculation_version`).
- Quando `actual_closed_amount IS NULL` (snapshot ainda não calculado) → célula "Em cálculo".
- Gráfico: adicionar linha **"Realizado final"** quando o último snapshot tem `actual_closed_amount` (linha horizontal de referência via `ReferenceLine` do recharts já importado indiretamente — usar a mesma `LineChart` com nova `Line` constante baseada em `actual_closed_amount`). Não instalar libs novas.

### 3.5 Integração — `AccuracyDashboard.tsx`
- Renderizar `<ForecastAccuracyPanel ... />` **acima** do `snapshotSection` existente. Não remover nem alterar a seção legada de IA vs Humano (mantém compatibilidade).

---

## 4. Aceite & testes manuais
Cobrir os 8 testes do prompt (forecast inflado, subestimado, equilibrado, <5 e ≥5 snapshots, vendedor restrito, admin total, período aberto vs encerrado).

---

## Arquivos impactados

**Backend (1 migration)**
- `supabase/migrations/<ts>_forecast_v2_accuracy.sql` — schema additivo + 3 RPCs + GRANTs.

**Frontend**
- `src/types/forecast-accuracy.ts` *(novo)*
- `src/hooks/forecast/useForecastAccuracy.ts` *(novo)*
- `src/components/forecast/ForecastAccuracyPanel.tsx` *(novo)*
- `src/components/forecast/ForecastSnapshotHistory.tsx` — colunas extras + linha de realizado
- `src/components/forecast/AccuracyDashboard.tsx` — monta o painel acima
- `src/integrations/supabase/types.ts` — auto-regen pós-migration

## Riscos & mitigações
- **Custo**: `get_forecast_seller_accuracy_v2` chama a RPC principal por vendedor. Lista limitada por org; aceitável. Caching futuro fica para F2.6.
- **Conflito de campo `actual_closed_amount` × `closed_won_final_amount`**: a RPC popula AMBOS para preservar leitores legados; UI nova lê `actual_closed_amount` com fallback.
- **Snapshot sem realizado ainda**: mantemos `bias_direction='unknown'` e `accuracy_score=NULL` quando `snapshots_count<5` no consolidado.
- **Atualização lateral via SECURITY DEFINER**: RPC só atualiza linhas que casam com `p_organization_id` (tenant guard + WHERE `organization_id = p_org`).
- **Confiança histórica**: deixada apenas em `metadata.historical_accuracy_penalty_ready=true`; não altera score atual da engine. Reduz risco de regressão.
