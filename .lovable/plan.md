# Hotfix Scoring 1.4.1 — Revenue Hygiene zerada

## Diagnóstico

A causa raiz da aba zerada está em **`src/services/crm/nrhs-analytics.ts` linha 168**:

```ts
.select(`..., pipeline_stages!inner(name), ...`)
```

A tabela real de estágios no projeto é **`stages`** (confirmado em `nrhs-calculator.ts:315` e `useOpportunityDetails.ts:179`, ambos usam `stage:stages(name)` com sucesso). Como `pipeline_stages` não existe / não tem FK reconhecida pelo PostgREST, o `select` inteiro falha com **PGRST200**, `data` volta `null`, todos os arrays viram `[]` → todos os cards exibem 0.

Bug adicional confirmado em **`src/components/scoring/nrhs/NRHSDistributionCharts.tsx:69`**:

```ts
weight: `${Math.round(p.weight * 100)}%`
```

`p.weight` já é `20` (não `0.20`) — multiplicar por 100 gera **2000%** no tooltip.

## Mudanças

### 1. `src/services/crm/nrhs-analytics.ts`
- Trocar `pipeline_stages!inner(name)` por `stage:stages(name)` (FK real, mesmo padrão usado no resto do código).
- Atualizar o mapeamento `stageName: opp.stage?.name || 'Sem estágio'`.
- Mudar `!inner` para LEFT join implícito para não derrubar oportunidades sem stage.
- Trocar `accounts!inner(...)` por `accounts(...)` pelo mesmo motivo (uma oportunidade sem account não deve sumir do dashboard de higiene — ela é exatamente um caso de baixa integridade que precisa aparecer).

### 2. `src/components/scoring/nrhs/NRHSDistributionCharts.tsx`
- Linha 69: `weight: \`${p.weight}%\`` (sem multiplicar por 100).

### 3. Estado de erro vs vazio em `RevenueHygieneDashboard.tsx`
- Propagar `error` de `useNRHSAnalytics` e renderizar bloco de erro distinto do estado vazio ("Não foi possível carregar os dados de Revenue Hygiene agora.") com botão "Tentar novamente" que invalida `['nrhs-analytics']`.
- Estado vazio existente mantém-se, mas com sugestão: "Nenhuma oportunidade aberta encontrada. Tente trocar de pipeline ou clicar em Atualizar NRHS."

## Fora do escopo (justificativa)

- **Não** vou criar a RPC `get_nrhs_analytics`. O serviço atual já consulta `opportunities` direto com filtros corretos (`organization_id`, `deleted_at`, exclui `won/lost/disqualified`); o único defeito é o nome da tabela no nested select. Criar uma RPC nova só para trocar um identificador é overkill, duplica lógica que já existe em `calculateNRHSKPIs/PillarAverages/...` no client e adiciona superfície de manutenção. Posso criar a RPC numa próxima sprint se você quiser consolidar — mas para zerar o erro PGRST200 e voltar os cards, não é necessário.
- Motor NRHS, fila, edge functions, realtime hooks, botão Atualizar NRHS: já estão funcionais desde a Sprint 1.4 e não são tocados.

## Risco

Mínimo. Três linhas alteradas em 1 arquivo de serviço + 1 linha em 1 componente + bloco de erro no dashboard. Não toca DB, RLS, edge functions, Lead Score, Opportunity Score nem Indicators.

## Critérios de aceite cobertos

1, 2, 3, 4, 5, 6, 7 (tooltip corrigido), 8, 9, 10 (erro ≠ vazio), 11, 13, 14, 15, 16, 17, 18, 19, 20. Itens 9, 12 já funcionavam.
