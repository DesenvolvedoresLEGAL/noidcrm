## Diagnóstico confirmado

Hoje há **4 ganhos** com win_reasons distintos, confirmados no banco:

| Oportunidade | Win reason | Valor |
|---|---|---|
| LLC MAKELOVE NOS TESTES DA FORD | Proposta mais clara e profissional | R$ 2.943 |
| ETHB - TIME HOLDING BRASIL | Melhor atendimento | R$ 4.765 |
| EVENTO CASA CANON | Indicação/Referência | R$ 1.182 |
| BR BRANDS NA BEAUTY FAIR 2026 | Suporte durante o projeto/evento | R$ 13.589 |

Os KPIs do topo (`Ganhos = 4`, `Receita Ganha = R$ 22.479`) leem da SSoT `commercial_won_revenue_view` e estão corretos. Já os blocos "O que mais gera vitória", "Top drivers", "Diferenciais decisivos", "Vitórias por vendedor" e "Vitórias por canal" leem de `data.wins` do hook `useWinLossData`, e esse array está com **3 registros** — falta a LLC MAKELOVE.

### Causa raiz

`src/hooks/useWinLossData.ts` (linhas 177‑180 e 283) aplica:

```ts
const isTestOpportunity = (title: string) => {
  const lower = (title || '').toLowerCase();
  return lower.includes('teste') || lower.includes('test');
};
// ...
.filter(opp => !isTestOpportunity(opp.title))
```

O título `LLC MAKELOVE NOS TESTES DA FORD` contém o substring `testes`, então a oportunidade é descartada como "teste". Isso é uma heurística ingênua que gera falso positivo em qualquer negócio real cujo nome contenha as palavras "teste"/"test" (comum em eventos: teste de produto, test drive, testes técnicos, etc.).

Resultado: SSoT reporta 4 vitórias e R$ 22.479, mas todas as análises derivadas (drivers, diferenciais, receita associada, ranking de vendedor, canal) enxergam apenas 3 vitórias e R$ 19.536 — exatamente a diferença de R$ 2.943 do MAKELOVE.

## Mudança proposta

Remover o filtro heurístico por título em `useWinLossData.ts`. Dados de produção não devem ser silenciosamente omitidos de análises por causa de uma palavra no nome do deal.

- Apagar a função `isTestOpportunity` e a chamada `.filter(opp => !isTestOpportunity(opp.title))`.
- Nenhuma outra alteração de lógica. Agregações (`WinDriversBlock`, `WinLossWinsTab`, `WinOriginBreakdownBlock`, ranking por vendedor, etc.) passam a receber os 4 wins e voltam a bater com a SSoT.

Se no futuro for necessário excluir oportunidades de teste, isso deve ser feito por um sinal explícito (ex.: coluna `is_test`, tag dedicada, prefixo `[TESTE]` no título) — nunca por substring livre. Fora do escopo desta correção.

## Arquivos afetados

- `src/hooks/useWinLossData.ts` — remover `isTestOpportunity` e o filtro correspondente.

## Validação pós-fix

- Recarregar a tela Win/Loss no filtro "Hoje / Vendas": drivers passam a mostrar 4 linhas (uma por win_reason), soma 4 ganhos, receita associada R$ 22.479.
- KPI strip continua exibindo 4 / R$ 22.479 (inalterado).
- Ranking "Vitórias por vendedor" para Wagner: 4 / R$ 22.479 / 100%.
- "Vitórias por canal" passa a incluir o canal do MAKELOVE.

## Riscos

- Baixo. Único efeito é parar de esconder deals reais cujo título contenha "test"/"teste". Se existirem deals sintéticos criados durante QA que dependam desse filtro, eles voltarão a aparecer — mas o correto é tratá-los via flag/tag explícita, não via heurística.
