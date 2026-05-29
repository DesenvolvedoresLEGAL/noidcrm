
# Hotfix — CEO Dashboard: alinhar todos os KPIs às fontes oficiais

## Diagnóstico por card (com base em `src/hooks/useOwnerDashboard.ts`)

| Card | Valor exibido | Valor correto | Causa raiz |
|---|---|---|---|
| Receita Avulsa "35 negócios" | 35 | 55 | Badge usa `metrics.wonDealsCount = wonSalesThisMonth.length` (tabela `opportunities` filtrada por `closed_at`/`updated_at`). A SSoT `commercial_won_revenue_view` já retorna 55 e o **valor** (R$ 143.492,19) bate. Divergência é só de **count** porque algumas oportunidades com proposta aceita herdada (ex.: PROP-2026-00761 da MLabs) entram no view mas não no filtro local. |
| Ticket Médio | R$ 4.099,78 (143.492 / 35) | R$ 2.608,95 (143.492 / 55) | Consequência direta do `wonDealsCount` errado. |
| Taxa de Conversão | 49% | 59% (Win/Loss Hub: 55 ganhos / 39 perdas) | `totalWon = wonSalesThisMonth.length` (35) em vez do count da SSoT (55). |
| Pipeline Aberto | 54 | 56 | `openSalesOpportunities` filtra só `status in ('open','new')`. Pipeline real considera `status NOT IN ('won','lost')`, incluindo `pre_approval`, `qualified`, `negotiation`, etc. (ver `services/supabase/opportunities.ts:70`). |
| Confiança Forecast | 43% | 57% | Dashboard usa `calculateForecastConfidence` local. Página Forecast usa NRHS V2 (`ForecastDataQuality` → `avgNRHS` de `useForecastData`). Fórmulas diferentes ⇒ divergência permanente. |
| Meta vs Run Rate (caindo) | 17% | maior | `yearlyRevenue` soma `valor_previsto` das won YTD (campo legado, frequentemente 0 ou desalinhado da proposta aprovada). Deve usar a SSoT `commercial_won_revenue_view` YTD (mesma fonte do card mensal). |
| Taxa Recompra | 0% | >0 | Denominador é `accounts.length` (toda a base de contas, incluindo leads). Numerador é só contas com `>1 won_sales_opportunities`, ignorando ganhos em pipeline `renewal` (recompras reais). |

## Mudanças (somente frontend, sem alterar regra de negócio comercial)

### 1. `src/hooks/useOwnerDashboard.ts`
- **wonDealsCount / avgTicket / conversionRate**: derivar `wonCountThisMonth` de `ssotRows.length` (já buscado). `avgTicketThisMonth = closedRevenueThisMonth / ssotWonCount`. Para `conversionRate`, manter `lostSalesThisMonth.length` no denominador mas usar `ssotWonCount` no numerador e no total fechados.
- **openDealsCount**: substituir filtro `status === 'open' || 'new'` por `!['won','lost','deleted'].includes(o.status)` para casar com a definição canônica do Pipeline. Atualizar `openSalesOpportunities` (afeta também `weightedPipeline`, `strategicOpportunities`, `enterpriseDeals`, `pipelineValue` no cálculo de confidence — todos passam a refletir o pipeline real).
- **Run Rate**: buscar segunda agregação de `commercial_won_revenue_view` YTD (sem filtro mensal, mesmo pipeline_type='sales'), usar `commercial` somado como `yearlyRevenue`. Mantém `runRate = yearlyRevenue / monthsElapsed * 12`.
- **Repurchase rate**: numerador = contas com ≥ 2 propostas/ganhos em qualquer pipeline `sales` ou `renewal` (incluir renewal); denominador = `accounts.filter(a => a.lifecycle_stage === 'Cliente').length` (somente clientes, não toda a base). Não criar tabela nova — usar `opportunities` + `pipelines.pipeline_type IN ('sales','renewal')` já carregadas (adicionar fetch leve só do pipeline_type renewal se necessário, sem mudar RLS).

### 2. Confiança do Forecast — fonte única
- Criar pequena variante: dashboard deixa de calcular confidence localmente e passa a **reusar** a mesma fonte do `Forecast.tsx` (NRHS V2). Caminho: extrair a função pura que calcula `avgNRHS` + composições de `ForecastDataQuality` para um helper compartilhado `src/lib/forecast/confidenceFromNRHS.ts` e consumi-la no `useOwnerDashboard` carregando as oportunidades elegíveis (mesmo `salesPipelineId` resolvido via `useForecastSalesPipeline`). Alternativa mais leve (preferida): no hook do dashboard, fazer `select` em `opportunities` com `nrhs_score, forecast_eligibility` (já existem) restrito ao pipeline de vendas e calcular `avgNRHS` ali — exatamente como o Forecast V2 faz. Resultado: dashboard e Forecast mostram o mesmo número.

### 3. Sem mudanças em
- `commercial_won_revenue_view`, `commission_eligibility_view`, RLS, profiles, organization_members, edge functions, ERP, propostas aprovadas, Pix, Slack.
- Componente `OwnerKPICards.tsx` (só consome `data.metrics.*` — já passa a refletir os números corretos automaticamente).

## Arquivos a alterar
- `src/hooks/useOwnerDashboard.ts` (toda a lógica acima)
- `src/lib/forecast/confidenceFromNRHS.ts` (novo helper puro, opcional se decidirmos extrair)

## Critério de aceite
- "Receita Avulsa (Mês)" badge mostra **55 negócios**.
- "Ticket Médio" subtítulo mostra **55 negócios fechados** e valor **R$ 2.608,95**.
- "Taxa de Conversão" = **59%** (55/(55+39)) — bate com Win/Loss Hub.
- "Pipeline Aberto" = **56** — bate com tela Pipeline.
- "Confiança Forecast" = mesmo número da página Forecast (atualmente 57%).
- "Meta vs Run Rate" volta a refletir o YTD da SSoT (não cai mais por causa de `valor_previsto` zerado).
- "Taxa Recompra" > 0 quando há ao menos 1 cliente com 2+ ganhos.
- Nada muda em commercial_won_revenue_view, comissão, settlement, propostas, ERP.

## Riscos
- Mudar `openDealsCount` para regra ampliada vai aumentar `weightedPipeline` e a contagem de "Oportunidades ativas" — comportamento desejado (alinhar com Pipeline). Sem impacto em receita realizada.
- Reaproveitar NRHS para confidence depende de `nrhs_score` estar populado nas oportunidades abertas; já é o caso na página Forecast.
