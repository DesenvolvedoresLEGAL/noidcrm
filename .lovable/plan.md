# Hotfix Scoring 1.4.4 — `o.value` não existe em `opportunities`

## Causa raiz confirmada

Auditei o schema real de `public.opportunities`. Não existem colunas `value` nem `amount`. O único campo de valor monetário do deal é **`valor_previsto numeric`** (também há `mrr_value`/`arr_value`/`commission_value`, mas o histórico do projeto e o resto do código usam `valor_previsto` como valor da oportunidade).

A RPC atual `public.get_nrhs_analytics(uuid, uuid, boolean, uuid)` referencia `COALESCE(o.value, 0)::numeric AS value` em duas CTEs (`base` e `base2`), gerando `42703 — column o.value does not exist`.

## Mudança (1 migration, cirúrgica)

Recriar `public.get_nrhs_analytics` mantendo assinatura, retorno, fórmulas e payload — trocando apenas:

```sql
COALESCE(o.value, 0)::numeric AS value
```

por

```sql
COALESCE(o.valor_previsto, 0)::numeric AS value
```

nas duas CTEs (`base` e `base2`). Nada mais muda. Alias interno `value` é preservado para que o resto da função (somatórios, distribuição, payload `deals`/`owners`/`summary`) continue idêntico, sem mexer em frontend.

## Auditoria adicional (fora da RPC)

- `enqueue_nrhs_recalc_for_filters`: já auditada na 1.4.3, não usa `o.value`.
- Edge functions `calculate-nrhs` / `process-nrhs-queue` e frontend (`useNRHSAnalytics`, `RevenueHygieneDashboard`): consomem campos via JSON com chave `value` (alias da RPC), não tocam `opportunities.value` direto. Sem mudança necessária.
- Se o grep encontrar resíduos NRHS apontando `opportunities.value`, troco para `valor_previsto` no mesmo passo.

## Arquivos

- 1 migration recriando `get_nrhs_analytics` com `valor_previsto`.
- (Condicional) ajustes pontuais se a busca por `o\.value|opportunities\.value` em escopo NRHS retornar algo.

## Fora de escopo

Motor NRHS, fórmula, layout, Forecast, OTE, Lead Score, Opportunity Score.

## Critérios de aceite

- Sem `o.value` na função.
- POST `/rpc/get_nrhs_analytics` retorna 200.
- Console sem `42703`.
- Aba Revenue Hygiene sai do estado de erro (dados reais ou estado vazio).
- "Valor em Risco" usa `valor_previsto`.
- Botão "Atualizar NRHS" continua funcionando.
