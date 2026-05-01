## Sprint F2.6 — HUMANOID Forecast Intelligence V2

Transformar a aba **AI** do módulo Forecast em uma central executiva determinística que consolida tudo que F2.1–F2.5 já produziram (auditoria, snapshots, engine V2, seller performance e acurácia) e responde de forma direta: o forecast é confiável, está contaminado, deve ser mantido ou reduzido, e o que precisa acontecer nas próximas 24h.

Sem LLM externa. Tudo determinístico, em SQL + componente React.

---

### 1. Migration — RPC `get_forecast_intelligence_v2`

Nova migration criando função `SECURITY DEFINER` com `search_path = public`.

Assinatura:
```
get_forecast_intelligence_v2(
  p_organization_id uuid,
  p_pipeline_id uuid default null,
  p_period_start date,
  p_period_end date,
  p_seller_id uuid default null
) returns jsonb
```

Comportamento:
- Valida que o caller pertence à organização (igual padrão dos outros V2).
- Resolve escopo:
  - Roles `admin | owner | manager | platform_admin` → vê tudo (respeitando `p_seller_id` opcional).
  - Demais roles → força `p_seller_id = auth.uid()` (não vaza outros sellers).
- Lê do último `forecast_calculation_runs` do período + `forecast_calculation_items`.
- Lê snapshots do período via `forecast_daily_snapshots`.
- Chama internamente (em blocos `BEGIN/EXCEPTION`) — cada fonte em try/catch, dados parciais se uma falhar:
  - `calculate_forecast_accuracy_v2` (somente leitura agregada via SELECT dos snapshots já calculados, não recalcula).
  - `get_forecast_seller_performance_v2`.
  - `get_forecast_seller_accuracy_v2`.
- Resolve meta mensal via `get_seller_monthly_goal_v2` (org level se `p_seller_id` null, senão por seller; se null → `no_goal_configured`).

Monta o JSON final exatamente no schema da spec (executive_summary, confidence_score, confidence_level, confidence_reasons, forecast_position, forecast_adjustment_recommendation, positive_signals, risk_signals, priority_actions, manager_decisions, seller_alerts, contaminated_forecast, top_risky_deals, top_recovery_deals, metadata).

#### Regras determinísticas

**confidence_score (0-100)**: média ponderada de:
- accuracy_score (peso 30, neutro 60 se null)
- 100 − % deals contaminados sobre realista (peso 30)
- % deals com `has_next_step` (peso 20)
- % deals com `activity_factor >= 0.6` (peso 20)

**confidence_level**: ≥80 high · 60–79 moderate · 40–59 low · <40 critical.

**forecast_position**: cascata exata da spec (no_goal_configured / above_goal_secure / above_goal_risky / near_goal / below_goal_recoverable / below_goal_critical).

**forecast_adjustment_recommendation**:
- `maintain` quando confidence ≥70, bias ≠ overestimating, contaminated < 20%.
- `reduce` quando bias = overestimating ou confidence < 60 ou contaminated > 20%. `recommended = max(scenario_pessimistic, realistic − contaminated*0.5)`.
- `increase_with_caution` quando bias = underestimating, accuracy ≥70 e confidence ≥70. `recommended = realistic*1.05`.
- `manual_review` quando snapshots_count < 5 ou accuracy_score null.
- `no_goal` quando meta null.

**contaminated_forecast**: soma `adjusted_value` de itens com `forecast_bucket IN ('commit','realistic')` E (`penalty_reasons && ARRAY['stale_activity','missing_next_step','expired_close_date','high_risk','critical_risk','end_of_month_restriction']` OU `risk_level IN ('high','critical')` OU `nrhs_score < 60`). Retorna amount, deals_count e até 3 frases textuais agregadas por motivo.

**positive_signals / risk_signals**: arrays montadas via `CASE` deterministicamente (goal_progress, coverage, NRHS médio, accuracy, bias equilibrado, % com next_step etc.). Cada item tem `type`, `label`, `value`, `impact|severity`.

**priority_actions**: gerados por presença de bucket de problema:
- `reactivate_stale_deals`, `fix_expired_close_dates`, `define_next_steps`, `review_contaminated_forecast`, `coach_risky_seller` (vendedor com maior risk_amount), `configure_goal` (se sem meta). Cada um com `estimated_recovered_amount` (soma dos `adjusted_value` afetados) e `related_deals_count`.

**manager_decisions**: derivadas de adjustment_recommendation, contaminated_forecast, slipping, vendedor crítico e meta ausente.

**seller_alerts**: vindos de seller_performance + seller_accuracy. Tipos exatos: goal_gap, low_coverage, high_risk_amount, overestimating_bias, low_confidence, missing_goal.

**top_risky_deals (LIMIT 10)**: from `forecast_calculation_items` ordenado por `(forecast_bucket='slipping') DESC, risk_level rank DESC, deal_value DESC, adjusted_value DESC` (join opcional com opportunities/accounts para `deal_name` e `company_name`).

**top_recovery_deals (LIMIT 10)**: `forecast_bucket IN ('optimistic','best_case','slipping')`, `nrhs_score >= 60`, `risk_level NOT IN ('critical')`, ordenado por `deal_value DESC, nrhs_score DESC, activity_factor DESC`.

**executive_summary**: string construída por template determinístico que combina forecast_position + recomendação + principal risco. Sem LLM.

**metadata**: calculation_version do último run, snapshots_count do período, accuracy_score (último snapshot com `accuracy_calculated_at` not null), bias_direction, forecast_trend, generated_at = now().

### 2. Hook — `src/hooks/forecast/useForecastIntelligence.ts`

- React Query (`['forecast-intelligence-v2', orgId, pipelineId, period, sellerId]`).
- `staleTime: 60_000`, `enabled` quando orgId+período presentes.
- Chama `supabase.rpc('get_forecast_intelligence_v2', {...})`.
- Retorna `{ data, isLoading, error, refetch }` tipado por nova interface `ForecastIntelligenceV2` em `src/types/forecast-intelligence.ts`.

### 3. Componente — `src/components/forecast/ForecastIntelligencePanel.tsx`

Substitui o conteúdo da `TabsContent value="insights"` em `src/pages/Forecast.tsx`. Mantém `AIForecastInsightsPanel` como fallback caso a feature flag `forecast_v2_engine_enabled` esteja OFF (segue o padrão das demais sprints).

Layout (8 blocos, todos os labels em PT-BR):

1. **Resumo Executivo** — card grande com título "HUMANOID Forecast Intelligence", `executive_summary`, badge de confidence_level (Crítica/Baixa/Moderada/Alta), badge de forecast_position, label da recomendação principal e `generated_at`.
2. **Recomendação de ajuste** — card mostrando atual × recomendado, ajuste R$ e %, motivo, tipo (Manter/Reduzir/Aumentar com cautela/Revisão manual/Meta ausente).
3. **O que está sustentando o Forecast** — lista de positive_signals com ícone por impact.
4. **O que está contaminando o Forecast** — lista de risk_signals com ícone por severity.
5. **Ações das próximas 24h** — cards com priority, descrição, valor recuperável estimado, qtd de deals.
6. **Decisões do gestor** — cards pergunta/contexto/sugestão/impacto financeiro/urgência.
7. **Alertas por vendedor** — tabela (Vendedor · Alerta · Severidade · Valor) usando `Table` do shadcn.
8. **Deals críticos × recuperáveis** — duas colunas (`grid md:grid-cols-2`), cada item com nome, conta, valor, bucket, risco. Click navega para `/opportunities/:id` se a rota existir.

Estados:
- **Loading**: skeleton dos 8 blocos.
- **Sem dados** (sem run, sem snapshots, sem oportunidades): card "Inteligência em formação" com texto exato da spec.
- **Poucos snapshots** (`snapshots_count < 5`): badge "Baixa amostra histórica" no topo, mas renderiza diagnóstico operacional normalmente.
- **Erro RPC**: mensagem discreta "Não foi possível carregar a inteligência do Forecast agora. Os demais dados do módulo continuam disponíveis." Não derruba a aba.

### 4. Tipos — `src/types/forecast-intelligence.ts`

Interfaces TypeScript espelhando o JSON da RPC: `ForecastIntelligenceV2`, `ForecastSignal`, `ForecastPriorityAction`, `ForecastManagerDecision`, `ForecastSellerAlert`, `ForecastIntelligenceDeal`, `ForecastAdjustmentRecommendation`, `ContaminatedForecast`, `IntelligenceMetadata`.

### 5. Integração na página

`src/pages/Forecast.tsx` — apenas trocar o conteúdo de `TabsContent value="insights"`:
```tsx
<ForecastIntelligencePanel
  organizationId={organizationId}
  pipelineId={filters.pipelineId}
  periodStart={filters.dateFrom}
  periodEnd={filters.dateTo}
  sellerId={filters.sellerId}
/>
```
Nada nos outros tabs muda.

---

### Arquivos impactados

Criados:
- `supabase/migrations/<timestamp>_forecast_intelligence_v2.sql`
- `src/hooks/forecast/useForecastIntelligence.ts`
- `src/components/forecast/ForecastIntelligencePanel.tsx`
- `src/types/forecast-intelligence.ts`

Editados (mínimos):
- `src/pages/Forecast.tsx` (apenas troca do conteúdo do tab `insights`)
- `src/integrations/supabase/types.ts` (auto-gerado após migration — não editar à mão)

### Riscos e mitigações

- **RPC pesada** → tudo em CTEs únicas, LIMIT explícito nos top deals, sem chamadas recursivas. Cada subfonte em `BEGIN/EXCEPTION WHEN OTHERS` para garantir resposta parcial.
- **RLS / cross-tenant** → `SECURITY DEFINER` com checagem explícita de `organization_id` do caller via `profiles` e filtro forçado em todas as CTEs.
- **Permissão de seller** → `p_seller_id` reescrito server-side para `auth.uid()` quando role não é admin/owner/manager/platform_admin.
- **Quebra da aba** → componente envelopa erro em try/catch (`error` do React Query → fallback message) e nunca lança.
- **Compatibilidade** → fallback para `AIForecastInsightsPanel` quando feature flag `forecast_v2_engine_enabled` estiver OFF.

### Próximos passos pós-aprovação

1. Criar migration com a RPC + grants.
2. Criar tipos + hook.
3. Criar `ForecastIntelligencePanel` com os 8 blocos.
4. Trocar conteúdo do tab `insights` em `Forecast.tsx`.
5. Validar com `supabase--read_query` chamando a RPC para a org de teste e conferir os 7 cenários de teste da spec.