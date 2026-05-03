# Hotfix Scoring 1.4.3 — get_nrhs_analytics: remover DDL e estabilizar retries

## Causa raiz confirmada

A RPC `public.get_nrhs_analytics(uuid, uuid, boolean, uuid)` (assinatura real do projeto) está marcada como `STABLE` e contém DDL vestigial:

```sql
CREATE TEMP TABLE IF NOT EXISTS _nrhs_base ON COMMIT DROP AS SELECT NULL::uuid AS id WHERE false;
TRUNCATE _nrhs_base;
DROP TABLE _nrhs_base;
```

Postgres rejeita: `0A000 — CREATE TABLE AS is not allowed in a non-volatile function`. As linhas são lixo (a função já usa CTE `WITH base AS (...)` para o trabalho real), então a correção é cirúrgica: remover essas 3 linhas. O resto da função permanece intacto (mesma assinatura, mesma fórmula, mesmo payload — não há risco para frontend).

`enqueue_nrhs_recalc_for_filters` foi auditada e **não usa DDL** — usa `FOR r IN SELECT ... LOOP INSERT`. Fica como está.

## Mudanças

### 1. Migration SQL

`CREATE OR REPLACE FUNCTION public.get_nrhs_analytics(p_org_id uuid, p_owner_id uuid, p_only_privileged boolean, p_caller_user_id uuid)` mantendo a assinatura atual (4 parâmetros — é o que o frontend chama em `nrhs-analytics.ts`). Mudanças mínimas:

- Remover as 3 linhas de DDL (`CREATE TEMP TABLE` / `TRUNCATE` / `DROP TABLE`).
- Manter `STABLE SECURITY DEFINER SET search_path = public` (sem DDL agora é válido).
- Todo o resto (CTEs `base`, `base2`, owner ranking, `jsonb_build_object` final) preservado byte a byte.

Não alterar a assinatura para a do briefing (11 params) porque quebraria o frontend existente sem ganho — a função atual já usa CTEs e atende todos os campos consumidos por `useNRHSAnalytics`.

### 2. Frontend — anti-loop em `src/hooks/useNRHSAnalytics.ts`

Adicionar config no `useQuery` de `useNRHSAnalytics` e `useNRHSKPIs`:

```ts
retry: (failureCount, error: any) => {
  const status = error?.status ?? error?.code;
  if (status === 400 || status === '400' || status === '0A000' || status === '42501') return false;
  return failureCount < 1;
},
refetchOnWindowFocus: false,
staleTime: 30_000,
```

Isso evita o loop de POSTs 400 visto no console enquanto a migration não roda, e mantém o comportamento normal pós-fix.

### 3. UI — estado de erro no `RevenueHygieneDashboard`

Verificar (sem refazer layout) que quando `error` está presente o dashboard mostra mensagem + botão "Tentar novamente" (chamando `refetch`). Se já existir, manter; se não, adicionar bloco mínimo acima dos skeletons.

## Arquivos

- `supabase/migrations/<novo>.sql` — recria `get_nrhs_analytics` sem DDL.
- `src/hooks/useNRHSAnalytics.ts` — adiciona `retry`/`refetchOnWindowFocus` nos 2 `useQuery`.
- `src/components/scoring/nrhs/RevenueHygieneDashboard.tsx` — garante render de erro com retry (edit mínimo se necessário).

## Fora de escopo

Motor NRHS, fórmula, edge functions, filas, layout, Forecast, OTE, Lead Score, Opportunity Score.

## Critérios de aceite

- Sem `CREATE TABLE` / `CREATE TEMP TABLE` / `CREATE TABLE AS` em `get_nrhs_analytics`.
- Console sem erro `0A000` e sem loop de POSTs.
- Aba NRHS sai do skeleton (dados reais ou estado vazio).
- Botão "Atualizar NRHS" continua funcionando.
- Demais abas Scoring intactas.
- Não mexa no layout. Não refaça o NRHS. Apenas corrija a RPC get_nrhs_analytics para usar CTEs e ajuste o hook para não retentar infinito em erro 400.