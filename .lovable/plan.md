# P0 ABSOLUTO — Revenue Surfaces Reconciliation (approved)

Toda receita realizada lê exclusivamente `commercial_won_revenue_view`.
Vendas Realizadas é o padrão; demais superfícies passam a usar o mesmo SSoT.

## Núcleo novo
- `src/services/revenue/dateRange.ts` — resolver único de período. `this_month` = primeiro dia do mês → HOJE. Sem rolling 30d. Campo de data único: `won_at`.
- `src/services/revenue/revenueSsotService.ts` — `getClosedRevenueSummary`, `getClosedRevenueRows`, `getRevenueBySeller`, `getRevenueByPipeline`, `getRevenueByStage`, `getRevenueByType`. Lê `commercial_won_revenue_view` + `commission_eligibility_view`. Proibido somar `valor_previsto`, `total_amount`, `proposal_items`, `v_opportunity_amounts_v2`, `get_unified_won_revenue_v2`.
- `src/hooks/revenue/useRevenueSsot.ts` — wrappers React Query: `useClosedRevenueSummary`, `useClosedRevenueRows`, `useRevenueBySeller`, `useRevenueByPipeline`, `useRevenueByStage`, `useRevenueByType`.
- `src/components/revenue/RevenueSsotBanner.tsx` — banner verde (migrada) ou amarelo "Esta tela ainda não usa a fonte oficial de receita."

## Override por superfície (campos monetários de receita ganha)
1. **Dashboard Owner** (`useOwnerDashboard` + `OwnerKPICards`) — Receita Avulsa, Novo MRR, Receita Total, Ticket Médio, contagem won, conversão (numerador won), insights. Banner verde.
2. **Forecast principal** (`/forecast`, `useForecastData`) — sobrescrever `closedRevenue`, parcela fechada de Commit/Best Case, Progresso da Meta e Velocidade do mês. Pipeline aberto/probabilístico permanece. Banner verde.
3. **Relatórios → Geral V2** — `wonCount`, `wonRevenue`, `avgWonTicket` do SSoT. Remover tooltip de cascata `useUnifiedWonRevenueV2`. Banner verde. Demais KPIs (pipeline ativo, perdas, processadas, conversão) continuam via edge.
4. **Relatórios → Processadas V2** — "Ganhas", "Receita ganha", "Ticket médio ganho" do SSoT. Perdas continuam via edge.
5. **Relatórios → Estágios V2** — substituir `activeValue` das linhas de stage cujo nome casa /ganh|won/i pelo valor SSoT por pipeline (`getRevenueByStage`). Banner verde.
6. **Relatórios → Forecast V2** — `closedRevenue` e parcela fechada dos cenários do SSoT.
7. **Relatórios → Closer V2** — totais e por-linha (`wonRevenue`, `wonCount`, `avgWonTicket`) via `getRevenueBySeller`. Demais colunas (perdas, ativos, ciclo, win rate) permanecem.
8. **Relatórios → Performance Equipe V2** — mesmo override do Closer.
9. **Win/Loss Hub** — `wonCount`, `wonValue`, `avgTicketWon` via SSoT em `WinLossKPIStrip`. Demais blocos (motivos, ciclo, sinais) seguem `useWinLossData`. Cards rotulados "Análise de decisão" onde aplicável.
10. **Revenue Integrity** (`useRevenueIntegrity` + `RevenueIntegrity.tsx`) — STOP comparar SSoT contra SSoT. Cada linha agora lê a fonte real (RPC/view/edge/hook) e compara. Tabela ganha colunas: `surface_name`, `displayed_value`, `displayed_source`, `ssot_value`, `delta`, `date_range`, `date_field`, `hook/service`, `view/RPC/edge`, `status`. Drawer "Diferenças por venda": `only_in_surface`, `only_in_ssot`, `amount_diff` com `proposal_number`, `opportunity_id`, `cliente`, `vendedor`, `won_at`, `commercial_amount`, `source`, `motivo`.

## Travas absolutas
Sem mexer em: Pix · ERP · Slack · PDF · `proposals.approved_amount` · `approval_snapshot` · preço dinâmico · propostas aceitas · clones operacionais · recálculo de proposta · updates em massa · `DROP VIEW CASCADE`.

## Critério de aceite — 01/05/2026 → 21/05/2026
Receita Total = R$ 114.840,24 · Avulsa = R$ 113.246,24 · Novo MRR = R$ 1.594,00
Vendas = 40 · Ticket = R$ 2.871,01 · Comissão Elegível = R$ 109.846,24 · Aguardando Settlement = R$ 4.994,00
Dashboard, Forecast, Geral, Processadas, Estágios, Forecast(R), Closer, Performance e Win/Loss reconciliam com SSoT. Revenue Integrity: todas as superfícies |Δ| ≤ R$ 0,01.

## Testes
`src/test/revenue/ssot.test.ts` ganha matriz por superfície (10 entradas), todas com Δ ≤ R$ 0,01 vs `commercial_won_revenue_view`.

## Memória
Atualizar `mem://business-rules/crm/revenue-single-source-of-truth` com a nova arquitetura central (service + hook + banner) e proibição explícita de leitura direta a `valor_previsto`/`total_amount`/`v_opportunity_amounts_v2`/`get_unified_won_revenue_v2` para receita realizada.

## Arquivos
**Novos**: `src/services/revenue/dateRange.ts`, `src/services/revenue/revenueSsotService.ts`, `src/hooks/revenue/useRevenueSsot.ts`, `src/components/revenue/RevenueSsotBanner.tsx`.
**Editados**: `src/hooks/useOwnerDashboard.ts`, `src/hooks/useForecastData.ts`, `src/pages/Forecast.tsx`, `src/components/reports/v2/GeneralOverviewV2.tsx`, `src/components/reports/v2/ProcessedOpportunitiesV2.tsx`, `src/components/reports/v2/StageConversionReportV2.tsx`, `src/components/reports/v2/RevenueForecastV2.tsx`, `src/components/reports/v2/CloserPerformanceReportV2.tsx`, `src/components/reports/v2/TeamPerformanceReportV2.tsx`, `src/components/intelligence/winloss/WinLossKPIStrip.tsx`, `src/hooks/admin/useRevenueIntegrity.ts`, `src/pages/admin/RevenueIntegrity.tsx`, `src/test/revenue/ssot.test.ts`.

## Próximo passo
Clique em **Implement plan** para sair do plan mode e iniciar a execução.
