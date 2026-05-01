# Sprint F2.7 — Risk Center, Slipping e Higiene Operacional

Transformar a aba **Riscos** em uma central operacional de recuperação de receita, consolidando dados de `forecast_calculation_items`, `forecast_calculation_runs`, performance por vendedor (F2.4) e intelligence (F2.6) em uma única RPC determinística, sem LLM externa.

## 1. Backend (1 nova migration)

### RPC `get_forecast_risk_center_v2(p_organization_id, p_pipeline_id, p_period_start, p_period_end, p_seller_id)`
- `SECURITY DEFINER`, `SET search_path = public`.
- Permissão: `admin`/`owner`/`manager`/`platform_admin` veem tudo da org; demais veem apenas `seller_id = auth.uid()`. Aplica `p_seller_id` como filtro adicional quando informado.
- Localiza o **run mais recente** em `forecast_calculation_runs` para `(org, pipeline, período)`. Se não houver run, retorna estrutura vazia com `metadata.run_id = null` (não chama `calculate_forecast_audit_v2` automaticamente para evitar custo; admin pode disparar via UI).
- Lê todos os `forecast_calculation_items` daquele run (com filtro de seller quando aplicável) e classifica cada deal nas 9 categorias:
  - `critical_risk`: `risk_level = 'critical'` ou `'critical_risk' = ANY(penalty_reasons)`
  - `attention_risk`: `risk_level = 'high'` ou `'high_risk' = ANY(penalty_reasons)`
  - `slipping`: `eligibility_status = 'slipping'` OR `forecast_bucket = 'slipping'` OR `'end_of_month_restriction' = ANY(penalty_reasons)` OR `close_date NOT BETWEEN period_start AND period_end`
  - `hygiene_issue`: união de problemas operacionais (próximo passo, atividade, close date, NRHS, valor, probabilidade)
  - `no_activity`: `last_activity_at IS NULL` OR `< now() - interval '7 days'`
  - `no_next_step`: `next_step_exists = false`
  - `low_nrhs`: `nrhs_score < 60`
  - `expired_close_date`: `close_date < current_date` AND `eligibility_status <> 'closed'` (deal aberto)
  - `contaminated_realistic`: `forecast_bucket IN ('commit','realistic')` AND qualquer penalty/risco listado na spec
- Para cada grupo calcula `deals_count`, `gross_amount` (sum `deal_value`), `adjusted_amount` (sum `adjusted_value`), `forecast_impact` (apenas itens em buckets que entram no realistic), `recoverable_amount` (deals com `nrhs_score ≥ 60` e `risk_level <> 'critical'`).
- **Risk score (0-100)** conforme regras da spec, com `LEAST(100, GREATEST(0, score))`. Lê `confidence_score` e `accuracy` via subqueries em `forecast_daily_snapshots` mais recente; se ausente assume valores neutros.
- **Seller ranking**: agrupa por `seller_id`, calcula `risk_amount`, `slipping_amount`, `contaminated_realistic_amount`, e um `risk_score` próprio (mesma fórmula em escala do vendedor). Recommended action determinística (`coach_risky_seller`, `fix_hygiene`, `fix_slipping`).
- **Top risky deals (10)** ordenado por: `risk_level='critical' DESC`, `bucket='slipping' DESC`, `is_contaminated DESC`, `deal_value DESC`, `array_length(penalty_reasons,1) DESC`.
- **Top recovery deals (10)**: `nrhs_score ≥ 60` AND `risk_level <> 'critical'` AND `bucket IN ('optimistic','best_case','slipping','realistic')` AND `activity_factor ≥ 0.30`, ordenado por `deal_value DESC`.
- **Quick actions** agregadas: `fix_expired_close_date`, `reactivate_stale_deals`, `define_next_steps`, `review_contaminated_realistic`, `coach_risky_seller` (do top 1 do ranking), `move_slipping_to_next_month`. Cada uma com `deals_count`, `amount`, `priority` (`critical`/`high`/`medium`/`low` derivado do volume).
- Retorna JSONB completo no shape da spec; em qualquer EXCEPTION devolve `jsonb_build_object('error', SQLERRM, 'summary', empty, ...)` para não quebrar a aba.
- `GRANT EXECUTE TO authenticated`.

## 2. Frontend

### Tipos — `src/types/forecast-risk-center.ts` (novo)
- `ForecastRiskCenterV2`, `ForecastRiskGroupV2`, `ForecastRiskDealV2`, `ForecastSellerRiskRankingV2`, `ForecastQuickActionV2`, `ForecastRiskSummaryV2`, `ForecastRiskMetadataV2`.
- Enums: `RiskGroupKey`, `Severity`, `ActionType`.

### Hook — `src/hooks/forecast/useForecastRiskCenter.ts` (novo)
- React Query (`['forecast-risk-center-v2', orgId, pipelineId, periodStart, periodEnd, sellerId]`).
- Chama `supabase.rpc('get_forecast_risk_center_v2', {...})` com tipagem.
- `staleTime: 60s`; expõe `{ riskCenter, isLoading, error, refetch }`.

### Componente — `src/components/forecast/risk-center/ForecastRiskCenterPanel.tsx` (novo)
Subdividido em arquivos pequenos para legibilidade:
- `RiskSummaryCards.tsx` — 6 cards (Total em Risco, Deals em Risco, Slipping, Contaminado, Recuperável, Score com label/colorida).
- `RiskQuickActions.tsx` — grid de cards de ações com count/valor/prioridade.
- `RiskGroupsAccordion.tsx` — accordion com 9 grupos; cada grupo mostra descrição, métricas, ação recomendada e até 5 top deals (link p/ `/oportunidades/:id`).
- `SellerRiskRankingTable.tsx` — tabela ordenada por `risk_amount`.
- `TopDealsLists.tsx` — duas colunas (Perigosos × Recuperáveis), com Empresa/Deal/Vendedor/Valor/Bucket/Risco/Close date/Motivo.

### Estados de UI
- **Sem run/dados**: empty state "Risk Center em formação" com texto da spec.
- **Baixa amostra** (`total_risk_deals < 5`): badge `Baixa amostra` no header.
- **Erro RPC**: alerta discreto + render fallback `<ForecastRisksPanel opportunities={...} />` (legacy preservado).

### Wiring — `src/pages/Forecast.tsx`
- Substituir conteúdo de `<TabsContent value="risks">` por `<ForecastRiskCenterPanel orgId pipelineId periodStart periodEnd opportunitiesFallback={opportunities} />`.
- Derivar `periodStart`/`periodEnd` de `filters` (mesmo padrão usado pelo `useForecastIntelligence`).
- Passar `opportunities` apenas para o fallback legado.

## 3. Permissões
- RLS já existente em `forecast_calculation_items`/`runs` cobre cross-tenant; RPC reforça via `get_user_organization_id()` e checa role via `has_role`/`is_org_admin`.
- Frontend não usa service role.

## 4. Riscos & Mitigações
- **Performance**: items podem ser milhares; RPC faz uma única leitura agregada com CTEs e arrays — sem N+1.
- **Sem run no período**: empty state evita confusão; admin pode rodar auditoria pela aba existente.
- **Quebra de outras abas**: nenhuma RPC/tabela existente é alterada; apenas adicionamos a nova RPC.
- **Compatibilidade de buckets**: usamos os enums já existentes em `fci_bucket_check`; tratamos `slipping` via `eligibility_status` (já existe no CHECK) e via close_date fora do período.

## 5. Arquivos
**Criar**
- `supabase/migrations/<ts>_forecast_risk_center_v2.sql`
- `src/types/forecast-risk-center.ts`
- `src/hooks/forecast/useForecastRiskCenter.ts`
- `src/components/forecast/risk-center/ForecastRiskCenterPanel.tsx`
- `src/components/forecast/risk-center/RiskSummaryCards.tsx`
- `src/components/forecast/risk-center/RiskQuickActions.tsx`
- `src/components/forecast/risk-center/RiskGroupsAccordion.tsx`
- `src/components/forecast/risk-center/SellerRiskRankingTable.tsx`
- `src/components/forecast/risk-center/TopDealsLists.tsx`

**Editar**
- `src/pages/Forecast.tsx` (apenas wiring da tab Riscos).

## 6. Critérios de aceite cobertos
RPC + hook + panel + 6 cards de resumo + quick actions + 9 grupos + slipping/contaminated como categorias próprias + ranking por vendedor + top deals perigosos/recuperáveis + RLS + fallback legado + nenhuma outra aba é tocada.
