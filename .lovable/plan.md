## Problema

`commercial_won_revenue_view` expõe duas leituras para a mesma venda ganha:

- **Bruta (aprovado):** `commercial_amount`, `one_shot_amount`, `mrr_amount`, `approved_amount` → soma vendas mesmo depois de canceladas.
- **Líquida (válida):** `valid_revenue_amount` (= aprovado − cancelado), `cancelled_amount`, flag `is_cancelled_sale`.

Hoje:

- **Relatórios → Vendas Realizadas** já usa **líquida** → R$ 153.449,59 (correto).
- **Forecast → Fechado** lê `summary.total` = soma de `commercial_amount` em `revenueSsotService.getClosedRevenueSummary` → R$ 158.443,59 (inclui a venda cancelada).
- **Dashboard CEO → Receita Avulsa / MRR / 60 negócios / Run Rate** lê `commercial_amount`, `one_shot_amount`, `mrr_amount` em `useOwnerDashboard` → idem, infla 60 vendas e R$ 154.058,59.
- **Relatórios V2 (`v_report_forecast_v2`)** usa `sum(net_revenue_final) FILTER (status='won')` da `v_reporting_opportunities_v2`, sem deduzir cancelados.

A regra SSoT já existe e está documentada na memória (`commercial_won_revenue_view` é a única fonte oficial), só não está sendo aplicada na coluna líquida. Esta sprint é um ajuste fino para passar a usar **sempre** as colunas líquidas (`valid_revenue_amount` / equivalentes), sem mexer em regra item‑a‑item, comissão ou OTE.

## Definição única de "receita fechada"

Para todas as superfícies executivas (Forecast, Dashboard, Run Rate, Cenários):

```
receita_fechada (líquida) = SUM(valid_revenue_amount) WHERE won_at ∈ [start,end] AND pipeline_type='sales'
receita_avulsa_liquida   = SUM(one_shot_amount) FILTER (is_cancelled_sale = false)
receita_mrr_liquida      = SUM(mrr_amount)      FILTER (is_cancelled_sale = false)
vendas_validas_count     = COUNT(*) FILTER (is_cancelled_sale = false)
```

Cancelado segue **visível** em telas analíticas, mas não entra em totalizadores executivos nem em cenários de forecast.

## Mudanças

### 1. `src/services/revenue/revenueSsotService.ts`

- `ClosedRevenueRow`: incluir `valid_revenue_amount`, `cancelled_amount`, `is_cancelled_sale`.
- `ClosedRevenueSummary`: adicionar `validTotal`, `validAvulsa`, `validMRR`, `validCount`, `cancelledTotal`, `cancelledCount`.
- `fetchRows`: passar a selecionar essas colunas (continua `select('*')`, só tipar).
- `getClosedRevenueSummary`: calcular os novos campos a partir de `valid_revenue_amount` e da flag `is_cancelled_sale` (mesma regra de `useVendasRealizadas.ts` linhas 211‑223, evitando divergência).
- Manter `total`, `avulsa`, `mrr`, `count` (bruto) para back‑compat de consumidores que ainda dependem deles (Reconciliação, Revenue Integrity), mas eles não serão mais usados em superfícies executivas.

### 2. `src/hooks/useForecastData.ts`

- `closedRevenue` passa a ler `ssotSummary.validTotal` (com fallback `ssotSummary.total` se `validTotal` indefinido para máxima segurança).
- `wonCount` passa a usar `ssotSummary.validCount` (alinha "Win Rate" e tickets ao líquido).
- Cenários (commit, best case, pessimista, realista, otimista) recalculam em cima do novo `closedRevenue` automaticamente.

### 3. `src/hooks/useOwnerDashboard.ts`

- Reduce do `ssotMonthRes` passa a também acumular `valid_amount`, `valid_one_shot`, `valid_mrr`, `valid_count` aplicando filtro `is_cancelled_sale === false` na composição de avulsa/MRR/count, e somando `valid_revenue_amount` direto para o total.
- `closedRevenueThisMonth`, `closedOneTimeThisMonth`, `closedMRRThisMonth`, `ssotWonCountThisMonth` passam a usar os campos líquidos.
- `ssotYearlyRevenue` (Run Rate / Meta vs Run Rate) passa a somar `valid_revenue_amount` no select YTD.

### 4. View V2 `v_report_forecast_v2` (migração SQL)

- Redefinir `closed_revenue` para vir de `commercial_won_revenue_view.valid_revenue_amount` com `pipeline_type='sales'` e `won_at` no mês corrente do row, em vez de `sum(net_revenue_final) FILTER (status='won')` de `v_reporting_opportunities_v2`. Mantém demais colunas como hoje.
- Garante que Relatórios V2 → Forecast bata exatamente com o card "Fechado" do Forecast clássico e com Vendas Realizadas.
- Sem mudar grants nem RLS (view já existe com `security_invoker=true`).

### 5. Banner / tooltip

- Atualizar o banner do Forecast e o subtítulo do card "Fechado" para deixar explícito: *"líquido de cancelamentos — alinhado a Vendas Realizadas"*. Sem nova lógica.

## Fora de escopo (não mexer)

- `commercial_won_revenue_view` (não alteramos a view oficial).
- Regras item‑a‑item de elegibilidade OTE / `calculate-ote` / `commission_eligibility_view`.
- Relatório de Vendas Realizadas (já está correto).
- Win/Loss Hub (usa `status='won'`, independente).
- Atribuição histórica (`commercial_won_revenue_historical_view`).

## Validação

Após deploy, para Mai/2026 (org HumanoidOS):

- Forecast → card **Fechado** = R$ 153.449,59 e 59 deals (mesma base de Vendas Realizadas).
- Cenários Pessimista/Realista/Otimista recalculados a partir do novo `closed` (devem cair ≈ R$ 4.994 cada).
- Dashboard CEO → **Receita Avulsa (mês)** alinhada ao valor de Vendas Realizadas, **60 negócios** vira **59**, Run Rate recalcula sem o cancelado.
- Relatórios V2 → Forecast também mostra R$ 153.449,59.
- Aba Vendas Realizadas continua intacta.
- `npx tsc --noEmit` sem erros.

## Riscos

- Consumidores que ainda leem `summary.total` (Reconciliação, Revenue Integrity): mantemos o campo, então continuam funcionando — só não recebem o novo valor líquido a não ser que sejam atualizados depois.
- Forecast confidence usa `forecast_reliability_pct` da view; não muda.
- Multi-tenant / RLS: nenhuma mudança em grants ou políticas. View V2 segue `security_invoker=true`.
