## Causa raiz

A RPC `public.recalculate_account_rfm` agrega `MAX(o.owner_user_id)` (linha 174 da definição), e `owner_user_id` é `uuid`. Postgres não tem `max(uuid)`, daí o erro `function max(uuid) does not exist` ao clicar em "Recalcular RFM".

Demais pontos do briefing já estão OK no estado atual:
- Assinatura `(p_organization_id uuid, p_period_start date, p_period_end date)` ✅
- Frontend chama com `p_organization_id / p_period_start / p_period_end` (`src/services/crm/account-rfm.ts`) ✅
- `SECURITY DEFINER` + `SET search_path = public` ✅
- Upsert por `(organization_id, account_id, period_start, period_end)` ✅
- Limpeza de snapshots obsoletos ✅

Faltando: substituir `MAX(uuid)`, retornar JSON amigável (hoje retorna `int`), garantir grants, e ajustar tratamento de erro/refetch no frontend.

## Plano

### 1. Migration — corrigir `recalculate_account_rfm`

Recriar a função com:

- **Owner pelo deal mais recente** (sem `MAX(uuid)`):
  ```sql
  (array_agg(o.owner_user_id ORDER BY o.closed_at DESC NULLS LAST))
    FILTER (WHERE o.owner_user_id IS NOT NULL)
  )[1] AS owner_id
  ```
- **`last_won_date`** continua como `MAX(o.closed_at)` (timestamp, válido).
- **GROUP BY** mantém apenas `o.account_id` (já está correto — `account_id` não é agregado).
- **Retorno trocado para `jsonb`**:
  - Sucesso com vendas:
    ```json
    {"success": true, "processed_accounts": N, "period_start": "...", "period_end": "..."}
    ```
  - Sem vendas no período:
    ```json
    {"success": true, "processed_accounts": 0, "message": "Nenhuma conta com receita fechada encontrada no período."}
    ```
- **Early-return** se a CTE base estiver vazia (evita executar upsert/delete à toa).
- **Permanece** `SECURITY DEFINER`, `SET search_path = public`, validação de `auth.uid()`, organização e role admin/owner.

### 2. Migration — drop da assinatura antiga + grants

- `DROP FUNCTION IF EXISTS public.recalculate_account_rfm(uuid, date, date);` antes de recriar (mudança de tipo de retorno exige drop).
- `GRANT EXECUTE ON FUNCTION public.recalculate_account_rfm(uuid, date, date) TO authenticated;`
- `GRANT EXECUTE ON FUNCTION public.get_account_rfm_intelligence(uuid, date, date, uuid, text, text) TO authenticated;` (idempotente).

### 3. Frontend — `src/services/crm/account-rfm.ts`

`recalculateAccountRFM` hoje devolve `Number(data ?? 0)`. Adaptar para o novo payload JSON, mantendo a assinatura `Promise<number>` para não quebrar o hook:

```ts
const payload = data as { success: boolean; processed_accounts?: number } | null;
return Number(payload?.processed_accounts ?? 0);
```

### 4. Frontend — `src/hooks/useAccountRFMIntelligence.ts`

- Em `onSuccess`, manter `invalidateQueries({ queryKey: ['account-rfm-intelligence'] })` (já invalida cards, segmentação e tabela — a página inteira lê dessa chave).
- Toast de sucesso adaptado: quando `count === 0`, mostrar "Nenhuma conta com receita fechada no período." em vez de "0 conta(s) atualizadas."
- Toast de erro: mensagem amigável fixa "Não foi possível recalcular o RFM. Verifique se existem vendas fechadas no período ou consulte os logs.", preservando `err.message` em `description` opcional/`console.error` para debug.

### 5. Validação

Após aplicar a migration, rodar no SQL Editor:
```sql
select public.recalculate_account_rfm(
  '<org_id>'::uuid, '2025-05-10'::date, '2026-05-10'::date
);
select public.get_account_rfm_intelligence(
  '<org_id>'::uuid, '2025-05-10'::date, '2026-05-10'::date, null, null, null
);
```
E testar pela UI o fluxo: Contas → RFM Intelligence → Recalcular RFM.

## Arquivos impactados

- `supabase/migrations/<novo>.sql` — drop + recreate `recalculate_account_rfm` + grants.
- `src/services/crm/account-rfm.ts` — adaptar leitura do novo retorno JSON.
- `src/hooks/useAccountRFMIntelligence.ts` — toasts e mensagens.

## Riscos

- **Mudança de tipo de retorno** (int → jsonb) exige `DROP FUNCTION` antes do `CREATE OR REPLACE`. Sem outras dependências da função (apenas o frontend a chama), risco baixo.
- **Política de owner**: passar a usar o owner do deal **mais recente** (em vez de um uuid arbitrário do `MAX`) é semanticamente mais correto e alinhado ao briefing.
- Sem mudança em RLS, schema de `account_rfm_snapshots`, ou em `get_account_rfm_intelligence`.

## Fora de escopo

- Reescrever lógica de scoring/segmentação RFM.
- Alterar `account_rfm_snapshots` ou `get_account_rfm_intelligence`.
- Mudanças em multi-tenancy / RLS.