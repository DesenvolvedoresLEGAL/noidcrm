## Diagnóstico

O banco mostra que a criação **está gravando** para o Gustavo (`f45f5762…`) na OPERADORA LEGAL — 7 oportunidades criadas com sucesso entre 12:58 e 13:09 UTC, todas com `owner_user_id` = Gustavo, `status='new'`, `close_date_prevista` e `origem` preenchidos.

Ainda assim, o Gustavo relatou **"modal trava/não fecha"** no pipeline PRÉ VENDAS. O padrão bate com uma falha **depois** do `INSERT` bem-sucedido dentro de `createOpportunity()` — que faz o modal cair no `catch`, mostrar toast de erro e não chamar `onOpenChange(false)`, mesmo com o registro já persistido. Isso também explica os retries visíveis no banco ("SIMONE DA AGRNCIA" → "SIMONE A AGENCIA" → "SIMONE DA AGENCIA").

Suspeitos, em `src/services/supabase/opportunities.ts` (função `createOpportunity`, linhas 326–482):

1. **`.insert(...).select().single()`** — se a política RLS de SELECT em `opportunities` (ou uma view/trigger que reescreve `owner_user_id`) fizer a linha inserida não ser visível de volta na mesma request, o `.single()` lança `PGRST116` e a UI acha que falhou, apesar da linha estar gravada.
2. **`claim_next_owner_v2`** — se retornar um `owner` de outro usuário quando `owner_user_id` chega vazio, o Gustavo perde SELECT sobre a própria criação e cai no mesmo caso 1. Hoje já existe `try/catch`, mas o resultado é aplicado sem validação.
3. **Auto-fill de responsáveis da conta** (linhas 447–479) — está sob `try/catch` e não deve derrubar; será mantido intacto, apenas garantindo que exceções continuem apenas em `console.warn`.

Nada disso indica que o `INSERT` esteja quebrado — o insert funciona. A correção precisa ser **cirúrgica**, apenas para o retorno pós-insert não derrubar o fluxo da UI quando a linha já foi gravada.

## Escopo da correção (mínimo e seguro)

Somente `src/services/supabase/opportunities.ts`, função `createOpportunity`. Nenhuma migration, nenhuma mudança em RLS, nenhuma mudança de UI, nada em duplicação, moves, updates, delete, forecast, revenue, etc.

### Mudanças

1. Trocar `.single()` por `.maybeSingle()` no retorno do insert e:
   - Se `data` vier `null` (linha gravada mas invisível pela RLS de SELECT), fazer um **re-fetch defensivo** em `opportunities` por `organization_id` + `title` + `created_by = auth.uid()` limit 1 mais recente, retornando esse row.
   - Se o re-fetch também vier vazio, retornar um objeto sintético com os campos que a UI usa (`id` do insert quando disponível via `.select('id')`, `pipeline_id`, `stage_id`, `owner_user_id`, `status`, `organization_id`), para o modal considerar sucesso e fechar.

2. Blindar `claim_next_owner_v2`: se o `claimed` retornar um `user_id` diferente do `auth.uid()` E o `dto` não pediu explicitamente outro dono, manter `resolvedOwner = user.id`. Isso evita a linha ser gravada com dono terceiro e sumir da SELECT do criador. (Comportamento explícito de "assign to X" continua funcionando quando `owner_user_id` vem no DTO.)

3. Log estruturado (`console.info('[createOpportunity] inserted', { id, pipeline_id, stage_id, owner_user_id })`) apenas para forense — sem alterar contrato.

## Fora do escopo (explícito)

- Não mexer em `duplicateOpportunity`, `moveOpportunity`, `updateOpportunity`, `markAsWon/Lost`, `restore`, `reopen`.
- Não mexer em `CreateOpportunityModal.tsx`, `Opportunities.tsx`, hooks de scoring, badges, forecast, revenue.
- Não criar migration, não alterar RLS, não alterar trigger, não alterar view.

## Verificação

1. Typecheck do arquivo alterado.
2. Rodar `src/test/services/opportunities.test.ts` (já existente) para garantir contrato preservado.
3. Pedir ao Gustavo para tentar criar 1 oportunidade no PRÉ VENDAS e confirmar que o modal fecha e o toast de sucesso aparece.

## Riscos

- Baixo: mudança isolada em uma função, com fallback conservador. Se `.maybeSingle()` retornar a linha (caso feliz de hoje), o comportamento é idêntico ao atual.
- O re-fetch defensivo pode, em teoria, resolver para uma linha muito parecida criada em paralelo pelo mesmo usuário. Mitigado por `order by created_at desc limit 1` e filtro por `created_by = auth.uid()` dentro da mesma request (< 1s).
