# Sprint F2.4 — Forecast por Vendedor e Metas Comerciais

Transformar a aba **Vendedor** em uma tela operacional de cobrança: meta real, gap, cobertura, risco, slipping, confiança e próxima ação — tudo alimentado pela engine V2 já existente, sem mexer nas demais abas.

---

## 1. Diagnóstico do que já existe

- **Engine V2 (F2.3)** já está implementada: `calculate_forecast_audit_v2(org, pipeline, start, end, p_seller_id)` aceita filtro por vendedor, popula `forecast_calculation_runs` e `forecast_calculation_items` com `forecast_bucket` (incluindo `slipping`), `risk_level`, `penalty_reasons`, `next_step_factor`, `nrhs_score`, `confidence_score` e `calculation_version`.
- **Fontes de meta** existentes no banco (não criar nova):
  - `sales_goals` — `user_id`, `pipeline_id`, `period_start`, `period_end`, `target_value` (oficial e flexível por período/pipeline).
  - `seller_targets` — `user_id`, `period_month` (date), `monthly_revenue_target` (mensal puro).
  - `ote_seller_config.custom_goal_override` + `ote_levels.target_revenue` com `effective_date`/`end_date` (override por OTE).
- **Tela atual**: `src/pages/Forecast.tsx` aba `sellers` renderiza `SellerForecastTable` com hook legado `useForecastData → SellerForecast` que mostra `goal=0` quando não há meta e calcula `closedPercentage=0`, gerando o "0% falso".

---

## 2. Backend — RPCs auditáveis

### 2.1 `get_seller_monthly_goal_v2(p_org, p_seller, p_period_start, p_period_end) RETURNS numeric`

Função `STABLE SECURITY DEFINER`, `search_path=public`. Ordem de prioridade (primeira não-nula vence; **retorna `NULL` se nenhuma**):

1. `sales_goals` com `user_id = p_seller`, `organization_id = p_org`, intervalo que cobre `[p_period_start, p_period_end]` (preferir `pipeline_id IS NULL`; se filtro de pipeline futuramente necessário, expor parâmetro opcional).
2. `seller_targets.monthly_revenue_target` cujo `period_month` cai no mês de `p_period_start`.
3. `ote_seller_config.custom_goal_override` vigente em `p_period_start` (`effective_date <= start AND (end_date IS NULL OR end_date >= end)`).
4. Fallback `ote_levels.target_revenue` via `ote_seller_config.ote_level_id` vigente.
5. Caso contrário `NULL`.

### 2.2 `get_forecast_seller_performance_v2(p_org, p_pipeline, p_period_start, p_period_end)`

`SECURITY DEFINER`, `search_path=public`. Retorna a tabela exigida no prompt (todos os campos: `seller_id`, `seller_name`, `seller_email`, `seller_avatar_url`, `monthly_goal`, `has_goal`, `closed_amount`, `scenario_realistic/optimistic/best_case`, `gap_to_goal`, `goal_attainment_percentage`, `pipeline_total`, `coverage_ratio`, `deals_count`, `included_deals_count`, `excluded_deals_count`, `risk_deals_count`, `slipping_deals_count`, `no_recent_activity_count`, `no_next_step_count`, `expired_close_date_count`, `low_nrhs_count`, `nrhs_avg`, `forecast_confidence`, `risk_amount`, `slipping_amount`, `recommended_action`, `recommended_action_type`, `calculation_version`, `run_id`).

Lógica:

1. **Tenant guard** — resolver `caller_org` via `get_user_organization_id(auth.uid())`; comparar com `p_org`. Se diferente e usuário não for `platform_admin`, abortar.
2. **Scope de visibilidade**:
   - `is_admin/owner/manager/platform_admin` (helpers existentes `has_role`, `is_organization_admin`) → todos os vendedores ativos da org via `crm_active_users_view`.
   - Caso contrário, restringe a `seller_id = auth.uid()`.
3. **Para cada vendedor** elegível:
   - Chamar `calculate_forecast_audit_v2(p_org, p_pipeline, p_period_start, p_period_end, seller_id)` → recebe `run_id`, `calculation_version`, totais.
   - Agregar `forecast_calculation_items WHERE run_id = v_run_id` para extrair contagens, `risk_amount` (sum `deal_value` onde `risk_level IN ('alto','crítico')` OR `forecast_bucket='slipping'` OR `penalty_reasons ?| array['high_risk','critical_risk','expired_close_date','stale_activity']`), `slipping_amount`, `nrhs_avg`, contagens de higiene (penalty_reasons contém `no_recent_activity`, `no_next_step`, `expired_close_date`, `low_nrhs`).
   - `monthly_goal := get_seller_monthly_goal_v2(...)`; `has_goal := monthly_goal IS NOT NULL AND monthly_goal > 0`.
   - `gap_to_goal`, `goal_attainment_percentage`, `coverage_ratio` → `NULL` quando `has_goal=false`.
   - `recommended_action_type/text` calculado pela cadeia de prioridade (Casos 1–6 do prompt).
4. Retorno como `RETURNS TABLE (...)`.

### 2.3 Segurança

- Reutilizar `has_role`, `is_organization_admin`, `crm_active_users_view`.
- `GRANT EXECUTE` para `authenticated` em ambas as RPCs.
- Sem RLS nova: a RPC é o gatekeeper.

---

## 3. Frontend

### 3.1 Tipos e hook

- `src/types/forecast-seller.ts` — interface `ForecastSellerPerformance` com todos os campos da RPC (numéricos `null` quando `has_goal=false`).
- `src/hooks/forecast/useForecastSellerPerformance.ts` — `useQuery` chamando `supabase.rpc('get_forecast_seller_performance_v2', ...)` com `enabled` e `queryKey` por org/pipeline/período. Retorna `{ sellers, isLoading, error, refetch }`.

### 3.2 UI da aba Vendedor (`src/pages/Forecast.tsx` + novo componente)

Substituir o uso atual de `SellerForecastTable` (hook legado) por um novo container `SellerPerformanceSection` localizado em `src/components/forecast/seller-performance/`:

- **4 cards superiores** (`SellerHighlightCards`):
  1. **Maior Forecast Realista** — vendedor com maior `scenario_realistic`.
  2. **Maior Gap** — maior `gap_to_goal` positivo. Quando nenhuma meta configurada → estado "Metas não configuradas" com CTA discreta.
  3. **Maior Risco** — maior `risk_amount` (mostra valor + nº deals).
  4. **Melhor Higiene** — maior `forecast_confidence` (desempate por `nrhs_avg`).

- **Tabela** (`SellerPerformanceTable`) com as colunas obrigatórias (Vendedor, Meta, Fechado, Realista, Otimista, Melhor Caso, Gap, % Meta, Cobertura, Deals, Risco, Slipping, Confiança, Ação Recomendada).
  - Regras de exibição: "Meta não configurada" / `-` / "Meta superada" conforme prompt.
  - Badge de confiança: Alta ≥80, Moderada 60–79, Baixa 40–59, Crítica <40.
  - Coluna de ação: badge clicável quando há rota disponível:
    - `configure_goal` → navega para `/configuracoes/metas` (ou rota equivalente se existir; senão renderiza apenas o label, sem quebrar).
    - `recover_risk_deals`, `reactivate_stale_deals`, `define_next_steps` → muda aba para `risks` ou `deals` aplicando filtro `seller_id` via query params (apenas quando filtros já existirem; caso contrário, label estático).
  - Colunas com tooltips explicando a fórmula resumida.

- **Estado vazio**: card central com texto exato do prompt.
- **Loading**: skeleton da tabela.
- **Error**: fallback para `SellerForecastTable` legado (não quebra a aba) + toast destrutivo discreto.

### 3.3 Feature flag

- Hook checa `forecast_v2_engine_enabled` (já em `feature_flags`) via util existente.
- Flag **ON** → usa nova UI integralmente.
- Flag **OFF** → usa nova UI mas a engine internamente já cai no ramo legado dentro de `calculate_forecast_audit_v2`; nenhum fallback adicional necessário (a tela continua funcional). Se a RPC falhar, `error` aciona o fallback para a tabela legada.

---

## 4. Aceite e testes manuais

Cobrir os 8 testes do prompt: vendedor com meta, sem meta, com risco, sem atividade, vendedor comum (escopo restrito), admin (escopo total), flag OFF (não quebra) e flag ON (`calculation_version = forecast_v2_engine_1` e bate com o drawer "Ver cálculo").

---

## Arquivos impactados

**Backend (1 migration)**
- `supabase/migrations/<timestamp>_forecast_v2_seller_performance.sql` — cria `get_seller_monthly_goal_v2` e `get_forecast_seller_performance_v2`, com `GRANT EXECUTE` para `authenticated`.

**Frontend**
- `src/types/forecast-seller.ts` *(novo)*
- `src/hooks/forecast/useForecastSellerPerformance.ts` *(novo)*
- `src/components/forecast/seller-performance/SellerPerformanceSection.tsx` *(novo)*
- `src/components/forecast/seller-performance/SellerHighlightCards.tsx` *(novo)*
- `src/components/forecast/seller-performance/SellerPerformanceTable.tsx` *(novo)*
- `src/pages/Forecast.tsx` — troca conteúdo da aba `sellers` para o novo `SellerPerformanceSection` (mantém `SellerForecastTable` apenas como fallback de erro).

## Riscos e mitigações

- **Custo de execução** — chamar a engine N vezes (1 por vendedor) pode ser caro. Mitigação: `calculate_forecast_audit_v2` já é otimizado por org/período; em orgs grandes podemos depois adicionar caching no `forecast_calculation_runs` (fora do escopo desta sprint).
- **Múltiplas fontes de meta** — divergência possível entre `sales_goals`, `seller_targets` e OTE. Mitigação: ordem de prioridade documentada na RPC `get_seller_monthly_goal_v2` e exposta via tooltip "Origem da meta" (futuro). Nesta sprint, registramos no log apenas em caso de divergência.
- **Vendedor sem permissão** — RPC restringe via `auth.uid()`; fora isso a query retorna vazio.
- **Compat tab atual** — fallback automático para a `SellerForecastTable` legada se a nova RPC falhar.

## Próximos passos (fora desta sprint)

- F2.5: acurácia matemática real (forecast vs realizado) usando snapshots da F2.2.
- Filtros profundos por vendedor nas abas Deals/Riscos para suportar 100% das ações rápidas.
