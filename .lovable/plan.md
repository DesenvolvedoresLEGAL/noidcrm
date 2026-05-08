
# Sprint INV 0.5 — Itens por Quantidade

Adicionar segundo tipo de item ao Inventário (`item_kind = 'quantity'`) reaproveitando estrutura da Sprint 0.4, sem novas tabelas, sem alterações de schema, sem novas RPCs.

## Estrutura de Navegação

A aba **Itens** vira um container com subtabs internas:

```text
Operações > Inventário
├── Visão Geral
├── Itens
│   ├── Serializados      ← comportamento da Sprint 0.4 preservado
│   └── Por quantidade    ← novo nesta sprint
├── Categorias
└── Locais
```

## Arquivos a Criar

1. **`src/services/operations/inventoryItems.ts`** — estender (mesmo arquivo):
   - `listQuantityItems(orgId)` — filtra `item_kind='quantity'`
   - `createQuantityItem(orgId, userId, input)`
   - `updateQuantityItem(id, userId, input)`
   - `updateQuantityItemStatus(id, status, userId, quantityAvailable?)`
   - Helper `getQuantityAvailableForQuantityStatus(status, requested)`: retorna `requested` se `available`, senão `0`.

2. **`src/hooks/operations/useInventoryItems.ts`** — estender:
   - `useInventoryQuantityItems()`
   - `useInventoryQuantityItemMutations()` (create/update/updateStatus)
   - Invalidar queries: `['inventory-items']`, `['inventory-quantity-items']`, `['inventory-status-history']`.

3. **`src/components/operations/inventory/InventoryQuantityItemsTab.tsx`**:
   - 4 cards de KPI no topo (Total, Disponíveis, Abaixo do mínimo, Zerados).
   - Tabela com colunas: Item, Categoria, Local, Status, Unidade, Qtd Total, Qtd Disponível, Estoque Mínimo, Alerta, Atualizado em, Ações.
   - Busca (name/description/brand/model) + filtros: status, categoria (filtrada por `item_kind='quantity'`), local.
   - Empty state com CTA "Novo item por quantidade".
   - Badge de alerta com prioridade: Zerado > Abaixo do mínimo > No mínimo > OK > Sem mínimo.

4. **`src/components/operations/inventory/InventoryQuantityItemFormDialog.tsx`**:
   - 12 campos conforme spec, validação Zod com `refine` para `quantity_available <= quantity_total`.
   - Quando status ≠ `available`, força e desabilita `quantity_available = 0` com aviso.
   - Select de categoria filtrado por `item_kind='quantity'` (com mensagem se vazio).

5. **`src/components/operations/inventory/InventoryQuantityItemStatusDialog.tsx`**:
   - Status atual + novo status + motivo opcional.
   - Se novo status = `available` e atual ≠ `available`, exibe input "Quantidade disponível" obrigatório (≤ `quantity_total`).
   - AlertDialog de confirmação para `retired`/`lost`/`damaged` (textos da spec).

6. **`src/components/operations/inventory/InventoryItemsTab.tsx`** — refatorar:
   - Renomear o conteúdo atual para `InventorySerializedItemsTab.tsx` (mover lógica) **ou** manter componente atual e wrapper.
   - Decisão: criar wrapper `InventoryItemsTab.tsx` com subtabs Radix `<Tabs>` internas, e mover conteúdo atual para novo `InventorySerializedItemsTab.tsx` (rename limpo).

## Arquivos a Editar

- **`src/lib/operations/inventoryLabels.ts`**:
  - Adicionar `UNIT_OF_MEASURE_OPTIONS` (un, m, cx, pct, rolo, kit, par, kg, l).
  - Adicionar helper `getStockAlert({ available, minimum })` retornando `'zeroed' | 'below' | 'at_min' | 'ok' | 'no_min'` + labels e variants.

- **`src/pages/operations/Inventory.tsx`**: nenhum mudança estrutural — `InventoryItemsTab` já está plugado e passa a renderizar subtabs internamente.

## Regras de Negócio Críticas

- `item_kind` sempre `'quantity'` em create; nunca alterado em update.
- `organization_id` da org atual; `created_by`/`updated_by` = `user.id`.
- Em qualquer mutação de status para algo ≠ `available`: forçar `quantity_available = 0`.
- Em mutação para `available`: usar valor informado pelo usuário (validado ≤ `quantity_total`).
- `quantity_minimum` opcional (`null` permitido).
- Não exibir nem enviar `asset_code`/`serial_number` para itens quantity.
- Trigger DB existente cuida de `inventory_status_history`.

## Permissões

Reutilizar guard de `Inventory.tsx` (já restrito a owner/admin/operations/operacional). RLS no banco já bloqueia escrita indevida.

## Toasts

- Sucesso: "Item por quantidade criado/atualizado com sucesso.", "Status alterado com sucesso."
- Erro Zod: mensagem do schema (incl. "A quantidade disponível não pode ser maior que a quantidade total.")
- Erro genérico: "Não foi possível concluir a ação. Tente novamente."

## Fora de Escopo (não implementar)

Reservas, kits, chips, movimentações avançadas, transferências, integração com proposta/tabela dinâmica, edge functions, RPCs novas, delete físico, filtro de alerta (deixar para sprint futura — só busca + status + categoria + local nesta).

## Riscos

- Renomear o atual `InventoryItemsTab` pode quebrar imports — verificar e atualizar `Inventory.tsx`.
- `quantity_available` é `numeric` no banco — usar `z.coerce.number()` e enviar como número.
- Garantir que select de categorias só liste `item_kind='quantity'` para evitar inconsistência.
