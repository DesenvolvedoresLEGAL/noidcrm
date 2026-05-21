# P0 — Dashboard + Win/Loss alinhados à Revenue SSoT (aprovado)

Fonte única: `commercial_won_revenue_view`. Todas as superfícies de receita realizada passam a ler dela. Nada de `opportunity.value`, `proposal.total_amount`, `created_at`, pipeline aberto, `v_unified_won_revenue_v2` legada ou fallback de oportunidade sem proposta aprovada.

## 1. Aba "Vendas Realizadas" em Relatórios (PRIMEIRA aba, antes de "Geral")

- Adicionar em `src/components/reports/ReportTabs.tsx` na categoria `overview`, ANTES de `general`:
  `{ id: 'vendas-realizadas', label: 'Vendas Realizadas', icon: DollarSign, category: 'overview' }`
- Em `src/pages/Reports.tsx`: novo case `'vendas-realizadas'` no `switch` e default inicial passa a ser essa aba.
- Criar:
  - `src/hooks/reports/useVendasRealizadas.ts` — query única em `commercial_won_revenue_view` com filtros: período, vendedor, pipeline, tipo de receita, origem, `revenue_confidence`, `commission_status`. Join client-side com `commission_eligibility_view`.
  - `src/components/reports/wrappers/VendasRealizadasWrapper.tsx` — usa filtros do `ReportFiltersContext`.
  - `src/components/reports/vendas-realizadas/VendasRealizadasTable.tsx` — tabela + cards superiores.
- Colunas: data da venda, cliente, proposta, oportunidade, vendedor, origem, pipeline comercial, tipo de receita, `one_shot_amount`, `mrr_amount`, `commercial_amount`, `commercial_amount_source`, `revenue_confidence`, `review_required`, `commission_status`.
- Cards no topo: Receita total fechada (`SUM(commercial_amount)`), Receita avulsa (`SUM(one_shot_amount)`), Novo MRR (`SUM(mrr_amount)`), Quantidade (`COUNT(*)`), Ticket médio (`SUM(commercial_amount)/COUNT(*)`), Comissões elegíveis, Comissões bloqueadas para revisão.

## 2. Dashboard Owner — substituir cálculos legados

Em `src/hooks/useOwnerDashboard.ts`, remover o bloco `=== CLOSED REVENUE — UNIFIED SOURCE ===` + todo o pipeline `recurringMRRByOpportunity` / `acceptedProposalsThisMonth` / `dynamic_pricing_*` / `oneTimeFromProposals` / `oneTimeFallback`. Substituir por uma única leitura:

```text
SELECT commercial_amount, mrr_amount, one_shot_amount
FROM commercial_won_revenue_view
WHERE organization_id = :org AND won_at BETWEEN :startOfMonth AND :endOfMonth
```

- `closedRevenueThisMonth` = `SUM(commercial_amount)`
- `closedOneTimeThisMonth` = `SUM(one_shot_amount)` (sem derivação `revenue − mrr`)
- `closedMRRThisMonth` = `SUM(mrr_amount)`
- `avgTicketThisMonth` = `closedRevenueThisMonth / ssotWonCount`
- Insight "Receita fechada este mês" lê `closedRevenueThisMonth` da SSoT
- `wonDealsCount` exibido no KPICard passa a refletir `ssotWonCount` (vendas realizadas reais), não `wonSalesThisMonth.length` (que conta oportunidades com `closed_at` no mês mesmo sem proposta aprovada)

Manter intactos: forecast, sellerStats, churnRisk, salesTrend, MRR total acumulado (já vem de `calculateRealMRR`).

## 3. Win/Loss — vira inteligência de decisão

Em `src/pages/intelligence/WinLossHub.tsx`, adicionar banner logo após `<PageHeader>`:

> "Base de decisões comerciais. Receita oficial em Relatórios → Vendas Realizadas."

Componente: `<Alert>` com link para `/app/reports?tab=vendas-realizadas`.

Em `WinLossKPIStrip` (cards "Ganhos", "Ticket Médio Ganho", "Valor Ganho"): quando `pipelineType === 'sales'`, ler `wonCount`, `wonValue` e `avgTicketWon` da `commercial_won_revenue_view` (via novo hook compartilhado `useSsotWonSummary(orgId, dateRange, pipelineId?)`). Caso contrário, mantém base atual de decisões. Adicionar tooltip "Sincronizado com Revenue SSoT".

A aba "Relatório" (`ProposalApprovalsTab`) que hoje mostra "Nenhuma proposta neste filtro/período" enquanto cards mostram 40/22 — investigar e corrigir o filtro para listar propostas aprovadas/recusadas/expiradas com cliente, vendedor, data da decisão, valor (aprovadas → SSoT; recusadas/expiradas → valor proposto rotulado "valor proposto, não receita realizada"), motivo, fonte.

## 4. Revenue Integrity — diagnóstico cross-fonte

Em `src/hooks/admin/useRevenueIntegrity.ts`, adicionar superfícies novas:

- "Dashboard Owner — Receita Avulsa" → re-roda lógica nova do `useOwnerDashboard` (ou apenas SUM SSoT one_shot, mostrando o que o card exibe)
- "Dashboard Owner — Novo MRR"
- "Dashboard Owner — Ticket Médio" (compara com `SUM(commercial_amount)/COUNT`)
- "Win/Loss — Ganhos (qtd)" (compara `COUNT` com SSoT; tolerância 0)
- "Win/Loss — Valor Ganho"
- "Win/Loss — Ticket Médio Ganho"

Adicionar tabela "Diagnóstico cross-fonte" em `src/pages/admin/RevenueIntegrity.tsx` com colunas: fonte, qtd vendas, receita fechada, ticket médio, filtros aplicados, campo de data usado (`won_at` / `accepted_at` / `created_at` / `updated_at`), view/RPC/hook consumido. Marca `REVENUE_SOURCE_MISMATCH` para qualquer fonte que use `opportunity.value`, `proposal.total_amount`, `created_at`, pipeline aberto, `v_unified_won_revenue_v2` legada ou fallback de opp sem proposta aprovada.

## 5. Guardrails

Estender `src/test/revenue/ssot.test.ts`:
- Para cada superfície monitorada: `|shown − ssot| ≤ R$ 0,01` (vendas: delta exato 0)
- Snapshot Maio/2026: Dashboard Owner Receita Avulsa não pode ser > 2× SSoT
- Manter casos reais: SQUADRA 1.516,32 / OGGI 2.542,35 / DU PRATA 1.894,30 / ORGÂNICA 1.194,00 / NETSEEDS 1.313,40

## 6. Travas (não fazer)

- Sem mexer em Pix, ERP, Slack, PDF, provider, `approval_snapshot`, `proposals.approved_amount`, preço dinâmico, proposta aprovada, cobrança
- Sem `UPDATE` em massa
- Sem `DROP VIEW CASCADE`
- Sem criar clones
- Sem nova funcionalidade fora do escopo acima

## 7. Critério de aceite (Maio/2026)

Todos devem reconciliar com `commercial_won_revenue_view`:
- Forecast Fechado
- BI Forecast Receita Fechada
- Relatórios Geral / Processadas / Closer / Performance / Ranking
- Dashboard Receita Avulsa (= SUM(one_shot_amount))
- Dashboard Novo MRR (= SUM(mrr_amount))
- Relatórios → Vendas Realizadas
- Win/Loss Ganhos / Ticket Médio Ganho / Valor Ganho
- Comissão Base

Typecheck e build passam.

## Arquivos

Editar:
- `src/hooks/useOwnerDashboard.ts`
- `src/components/reports/ReportTabs.tsx`
- `src/pages/Reports.tsx`
- `src/hooks/admin/useRevenueIntegrity.ts`
- `src/pages/admin/RevenueIntegrity.tsx`
- `src/pages/intelligence/WinLossHub.tsx`
- `src/components/intelligence/winloss/WinLossKPIStrip.tsx`
- `src/components/intelligence/winloss/tabs/ProposalApprovalsTab.tsx` (corrigir filtro)
- `src/test/revenue/ssot.test.ts`

Criar:
- `src/hooks/reports/useVendasRealizadas.ts`
- `src/components/reports/wrappers/VendasRealizadasWrapper.tsx`
- `src/components/reports/vendas-realizadas/VendasRealizadasTable.tsx`
- `src/hooks/intelligence/useSsotWonSummary.ts` (compartilhado WinLoss + Integrity)
