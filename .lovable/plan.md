
## Contexto

Fonte de verdade do "Fechado do mês" = R$ 18.405,20 (BI + Forecast). No Dashboard CEO os cards quebram em:
- Receita Avulsa: R$ 17.149,40
- Novo MRR: R$ 797,00/mês
- Soma: R$ 17.946,40 ≠ R$ 18.405,20

Além disso, o insight "lidera com 7 negócios fechados" mostra Leandro André, mas quem fechou os 7 negócios do mês foi Wagner.

## Causa raiz

**1. Receita Avulsa quebrada** — `src/hooks/useOwnerDashboard.ts` (linha ~270):
- `closedOneTimeThisMonth` vem de `unifiedOneTimeValue` do RPC `get_unified_won_revenue_v2`, que calcula `one_time = net_revenue − mrr_value × 12` (visão de contrato anualizado).
- Mas o card exibe Novo MRR como `R$ X/mês` (1 mês), não 12 meses.
- Resultado: avulsa + MRR(1m) ≠ total fechado. Diferença ≈ MRR × 11 meses contidos no avulso (797 × 11 ≈ 8.767... os números não batem porque o RPC unificado já "tirou" 12 MRRs do total e algum deal recorrente está contribuindo de forma diferente do esperado).

**2. Top Performer errado** — `useOwnerDashboard.ts` linha 394–410:
- `sellerStats` usa `salesOpportunities` (TODAS as oportunidades históricas), não as do mês.
- Insight "lidera com X negócios fechados" usa esse ranking histórico, mas apresenta como se fosse do período atual exibido nos KPIs.
- Wagner pode ter feito os 7 deste mês, mas Leandro acumula mais histórico → aparece como líder no card.

## Plano de correção

### A. Receita Avulsa do mês (consistência matemática)

Garantir que **Receita Avulsa + Novo MRR (1 mês) = Receita Fechada no Mês**.

Alterar em `src/hooks/useOwnerDashboard.ts` (~linha 270):
```ts
// Receita avulsa = total fechado do mês − parcela MRR (1 mês) contida nesses deals
const closedOneTimeThisMonth = Math.max(0, closedRevenueThisMonth - closedMRRThisMonth);
```
- Remover dependência de `unifiedOneTimeValue` (que assume 12 meses) para esse card.
- `closedRevenueThisMonth` continua sendo a fonte de verdade unificada (bate com BI/Forecast).
- `closedMRRThisMonth` continua sendo a soma de `monthly_value` dos deals recorrentes ganhos no mês.
- Resultado: 17.608,20 + 797 = 18.405,20 (ou o que for matematicamente coerente).

Adicionar subtítulo no card "Novo MRR" em `OwnerKPICards.tsx` deixando claro:
- Subtitle: `ARR: R$ X` (já existe) + tooltip/hint: "Receita avulsa inclui apenas a parcela única; MRR é mensal."

### B. Insight de Top Performer do mês

Em `src/hooks/useOwnerDashboard.ts`:

1. Criar `sellerStatsThisMonth` em paralelo a `sellerStats`, restrito a `wonSalesThisMonth`:
```ts
const sellerStatsThisMonth = profiles
  .filter(p => salesUserIds.includes(p.user_id))
  .map(p => {
    const won = wonSalesThisMonth.filter(o => o.owner_user_id === p.user_id);
    return {
      name: p.full_name || 'Sem nome',
      revenue: won.reduce((s, o) => s + (o.valor_previsto || 0), 0),
      deals: won.length,
    };
  })
  .filter(s => s.deals > 0)
  .sort((a, b) => b.revenue - a.revenue);
```

2. Passar `sellerStatsThisMonth` para `generateInsights` e usar no insight "lidera com X negócios fechados" (ao invés do `sellerStats[0]` histórico). Ajustar texto: `"... lidera o mês com X negócio(s) fechado(s) (R$ Y)."`.

3. Manter `sellerStats` histórico para os outros usos (sellerProductivity, etc.).

## Arquivos impactados

- `src/hooks/useOwnerDashboard.ts` — ajuste do `closedOneTimeThisMonth` e novo `sellerStatsThisMonth` + propagar para `generateInsights`.
- `src/components/dashboards/owner/OwnerKPICards.tsx` — pequeno ajuste de subtítulo/clareza no card "Novo MRR" (opcional).

## Riscos

- **Baixo**: mudança apenas em derivações de display do CEO Dashboard; não toca RLS, RPC, BI ou Forecast.
- BI e Forecast continuam intocados (já usam `unifiedWonRevenue` corretamente).
- Multi-tenant preservado (todos os filtros por `organizationId` permanecem).

## Validação

1. Soma "Receita Avulsa" + "Novo MRR" = "Receita fechada" exibida no insight.
2. Receita fechada do mês no CEO Dashboard = Fechado do Forecast = Valor Total Ganho do BI = R$ 18.405,20.
3. Insight "lidera com X" mostra Wagner (autor dos 7 deals do mês) e não mais Leandro.
