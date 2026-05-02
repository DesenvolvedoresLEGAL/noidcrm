
# Sprint F2.9.2 — Forecast V2: Metas Globais, Período Dinâmico e Estabilização Final

## Diagnóstico (causa raiz, confirmada no banco)

1. **`get_seller_monthly_goal_v2` quebrada**: o fallback referencia `ol.target_revenue`, coluna que **não existe** em `ote_levels` (a correta é `monthly_goal`). Isso quebra:
   - Aba **Vendedor V2** → erro `column ol.target_revenue does not exist`
   - Aba **AI** → como `get_forecast_intelligence_v2` chama essa função dentro de um `BEGIN/EXCEPTION`, ela retorna NULL e mostra "Sem meta configurada" mesmo com metas em `sales_config`.

2. **`get_seller_monthly_goal_v2` ignora metas globais da organização**: quando `p_seller_id` é NULL (filtro "Todos os vendedores"), retorna NULL na linha 12-14. Não consulta `sales_config.monthly_revenue_target` / `quarterly_goal` / `yearly_goal`. Resultado: AI Hub e fallbacks ficam "no_goal_configured" mesmo com metas configuradas em `/app/settings/sales`.

3. **Frontend `useForecastData` não muda meta por período**: `orgGoalQuery` sempre lê `monthly_revenue_target`. Quando o usuário troca o filtro para Trimestral/Anual, os KPIs continuam mostrando R$ 150.000,00 (a meta mensal). Deveria ler `quarterly_goal` no trimestral e `yearly_goal` no anual.

4. **Loop "Inicializar Forecast V2"**: o painel exige `latest_run_at && latest_snapshot_at` para o **período exato** (`period_start = X AND period_end = Y`). Quando o usuário navega para outra página e volta, ou troca de período, não existe run para esse `period_start/end` específico → o card de bootstrap reaparece. Faltam runs por período além do mensal corrente, e o critério precisa ser mais tolerante (a engine ativa + qualquer run recente já basta para não mostrar bootstrap).

5. **Risk Center "Não foi possível carregar"**: o RPC retorna `v_empty` quando não existe run. O hook trata o objeto vazio mas o UI legado abaixo mostra erro. Após corrigir item 4 (gerar runs por período), some.

## Mudanças

### A. Database migration (RPCs)

**A1. Corrigir `get_seller_monthly_goal_v2`** (mantém ordem: vendedor específico → org global):
- Remover referência inexistente `ol.target_revenue`; trocar fallback OTE para `ol.monthly_goal`.
- Quando `p_seller_id IS NULL`, **buscar meta global da org** em `sales_config`, escolhendo a coluna por janela do período:
  - duração ≤ 31 dias → `monthly_revenue_target`
  - 32–95 dias → `quarterly_goal`
  - 96–200 dias → `semester_goal`
  - > 200 dias → `yearly_goal`
- Adicionar fallback final: somar metas mensais ativas dos vendedores (`ote_seller_config.custom_goal_override` ou `ote_levels.monthly_goal`) e multiplicar pelo nº de meses do período quando for trimestral/anual.

**A2. Tornar `calculate_forecast_audit_v2` resiliente**: já não usa `target_revenue`, mas verificar; nenhum efeito colateral.

**A3. `get_forecast_v2_health_check`**: relaxar condição de `bootstrap_required`. Hoje exige run/snapshot para o período exato; passar a considerar:
- `bootstrap_required = (engine_active AND total_runs_org = 0)` (qualquer run recente da org no último 30 dias).
- Adicionar campo `latest_run_in_period` (run para o `period_start/end` atual) sem ditar bootstrap.

### B. Frontend `src/hooks/useForecastData.ts`

- Substituir `orgGoalQuery` para selecionar a coluna correta de `sales_config` baseada em `filters.periodType`:
  ```ts
  const col = periodType === 'yearly' ? 'yearly_goal'
            : periodType === 'quarterly' ? 'quarterly_goal'
            : 'monthly_revenue_target';
  ```
- Incluir `periodType` na `queryKey` (`salesGoalKeys.orgGoal(periodType)`).
- Ajustar `sellerGoalsQuery` para multiplicar a soma por 3 (trim) ou 12 (anual) quando aplicável, usado apenas como fallback.

### C. Frontend `src/components/forecast/health/ForecastV2HealthPanel.tsx`

- Trocar a condição do banner de bootstrap por `health.bootstrap_required === true` (vem do RPC), em vez de checar `!latest_run_at && !latest_snapshot_at` no cliente.
- Persistir o último resultado bem sucedido por organização em `sessionStorage` (chave `forecast_v2_bootstrapped:{orgId}`), para que o banner não pisque em remontagens enquanto o `useQuery` está revalidando.

### D. Frontend (filtros mostram a meta correta)

- `ForecastKPICards` já lê `kpis.goal`; após (B), o valor passa a refletir trim/anual.
- `ForecastScenariosCard`: percentuais usam `goal` recebido por prop — automaticamente correto.

### E. Forecast Risk Center fallback

- `useForecastRiskCenter`: tratar `riskCenter?.summary?.total_risk_deals === 0 && !runId` como "sem dados ainda" (estado vazio amigável), não como erro. Remove o card vermelho "Não foi possível carregar" quando o RPC respondeu com `v_empty` válido.

## Arquivos afetados

```text
supabase/migrations/<novo>.sql
  - CREATE OR REPLACE get_seller_monthly_goal_v2
  - CREATE OR REPLACE get_forecast_v2_health_check
src/hooks/useForecastData.ts
src/components/forecast/health/ForecastV2HealthPanel.tsx
src/components/forecast/risk-center/ForecastRiskCenterPanel.tsx
src/types/forecast-health.ts (novos campos opcionais)
src/lib/query-keys.ts (queryKey de orgGoal aceitando periodType)
```

## O que NÃO será alterado
- Lógica de cenários/Engine V2 e fórmula NRHS — preservada.
- RLS, segurança e enums (sem novos roles).
- AI / Risk Center / Acurácia — apenas correções de fallback/leitura.

## Resultado esperado
- **AI tab**: mostra meta global (mensal/trim/anual) e sai do estado "Sem meta configurada".
- **Aba Geral/KPIs**: "Meta do Mês" passa a "Meta do Período" e troca o valor ao trocar Mensal/Trim/Anual conforme `sales_config`.
- **Aba Vendedor V2**: deixa de mostrar `column ol.target_revenue does not exist`.
- **Aba Saúde V2**: o card "Inicializar Forecast V2 agora" só aparece quando realmente não há nenhum run; ao voltar de outra página, mantém estado.
- **Aba Riscos**: estado vazio amigável quando ainda não há run para o período, sem o banner vermelho de erro.
