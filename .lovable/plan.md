# Sprint INV 0.4 — Itens Serializados

## Objetivo
Adicionar a aba **Itens** em `/app/operations/inventory` para CRUD de itens serializados (`item_kind='serialized'`), reutilizando a tabela `inventory_items` da Sprint INV 0.2.

## Pré-requisito de schema (migration mínima)
A tabela `inventory_items` **não tem** índices únicos para `asset_code` e `serial_number`. Sem eles, o tratamento de erro `23505` exigido pela sprint não dispara. Adicionar dois índices únicos parciais (apenas valores não-nulos, escopados por organização):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_asset_code
  ON public.inventory_items (organization_id, asset_code)
  WHERE asset_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_serial_number
  ON public.inventory_items (organization_id, serial_number)
  WHERE serial_number IS NOT NULL;
```

Sem alterar tabelas, RLS, enums ou triggers existentes.

## Estrutura de arquivos

**Novos:**
- `src/services/operations/inventoryItems.ts` — list (com joins de category/location), create, update, updateStatus
- `src/hooks/operations/useInventoryItems.ts` — `useInventoryItems` (query) + `useInventoryItemMutations` (create/update/updateStatus). Invalida `['inventory-items', orgId]` e `['inventory-status-history']`.
- `src/components/operations/inventory/InventoryItemsTab.tsx` — header, busca + filtros (status/categoria/local), tabela, empty state, abre dialogs
- `src/components/operations/inventory/InventoryItemFormDialog.tsx` — modal create/edit com Zod
- `src/components/operations/inventory/InventoryItemStatusDialog.tsx` — modal de mudança de status com motivo + AlertDialog de confirmação para `retired/lost/damaged`

**Editados:**
- `src/lib/operations/inventoryLabels.ts` — adicionar `ITEM_STATUS_LABEL` + `ITEM_STATUS_OPTIONS` + helpers `getQuantityAvailableForStatus(status)` (1 se `available`, senão 0) e `getStatusBadgeVariant`
- `src/pages/operations/Inventory.tsx` — adicionar tab `Itens` na ordem **Visão Geral | Itens | Categorias | Locais**

## Tipos e mapas

```ts
ITEM_STATUS_LABEL = {
  available:'Disponível', blocked:'Bloqueado', maintenance:'Em manutenção',
  damaged:'Danificado', retired:'Baixado', lost:'Perdido'
}
```
Badge: `available` → default; `maintenance/blocked` → secondary; `damaged/lost/retired` → destructive.

## Camada de dados

**list (apenas serializados):**
```ts
supabase.from('inventory_items')
  .select('*, category:inventory_categories(id,name,item_kind), location:inventory_locations(id,name,location_type)')
  .eq('organization_id', orgId)
  .eq('item_kind', 'serialized')
  .order('updated_at', { ascending: false })
```

**create:** força `item_kind='serialized'`, `quantity_total=1`, `unit_of_measure='un'`, `metadata={}`, `quantity_available = getQuantityAvailableForStatus(status)`, `created_by/updated_by = auth.uid()`. Strings vazias salvam como `null`.

**update:** mantém `item_kind` e `quantity_total=1`; recomputa `quantity_available` se `status` mudou; seta `updated_by`.

**updateStatus(id, status, reason?):** update com `status` + `quantity_available` recomputado + `updated_by`. A trigger `trg_inventory_items_status_history` já registra histórico. **Não** criar movement manual nesta sprint (decisão: manter simples; histórico já cobre via trigger).

**Selects auxiliares:**
- `useSerializedCategories()` — `inventory_categories` ativas com `item_kind='serialized'`
- `useActiveLocations()` — `inventory_locations` ativos
Reutilizam queryKeys das sprints 0.3 quando possível, ou criam queries dedicadas com `select` reduzido.

## Validação Zod

```ts
inventorySerializedItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  category_id: z.string().uuid('Selecione uma categoria.'),
  location_id: z.string().uuid('Selecione um local.'),
  status: z.enum(['available','blocked','maintenance','damaged','retired','lost']),
  asset_code: z.string().trim().max(80).optional().or(z.literal('')),
  serial_number: z.string().trim().max(120).optional().or(z.literal('')),
  brand: z.string().trim().max(80).optional().or(z.literal('')),
  model: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

inventoryItemStatusSchema = z.object({
  status: z.enum([...]),
  reason: z.string().trim().max(300).optional().or(z.literal('')),
})
```

## Tratamento de erro 23505
No `catch` das mutations:
- `err.message` contém `uq_inventory_items_asset_code` → "Já existe um item com este código patrimonial."
- contém `uq_inventory_items_serial_number` → "Já existe um item com este número de série."
- fallback `23505` → "Já existe um item com este código patrimonial ou número de série."

## UI da aba Itens

- Header: título "Itens" + descrição + botão **Novo item** (desabilitado com tooltip se não houver categoria serializada OU local ativo; mensagens "Cadastre uma categoria serializada antes de criar itens." / "Cadastre um local antes de criar itens.")
- Toolbar: input de busca (filtra client-side em `name | asset_code | serial_number | brand | model`) + 3 selects (status, categoria, local) com opção "Todos"
- Tabela: Item (name + description truncado), Categoria, Local, Status (Badge), Código patrimonial, Nº série, Marca/Modelo, Atualizado em, Ações (Editar | Alterar status)
- Empty state com ícone `Package`, título e CTA conforme spec
- Skeleton durante loading (padrão Sprint 0.3)

## Confirmações
`AlertDialog` antes de aplicar mudanças destrutivas (textos exatos da sprint):
- `retired` → "Deseja baixar este item?..."
- `lost` → "Deseja marcar este item como perdido?..."
- `damaged` → "Deseja marcar este item como danificado?..."

Outros status: salvam direto sem confirmação extra.

## Toasts
Sucesso: "Item criado com sucesso." / "Item atualizado com sucesso." / "Status alterado com sucesso." Erros conforme seção 23505 + fallback "Não foi possível concluir a ação. Tente novamente."

## Permissões
Já garantidas pela página (Sprint 0.1) e pelas RLS policies via `user_can_access_inventory()` (Sprint 0.2). Nenhuma mudança.

## Fora de escopo
Itens por quantidade, chips/kits/reservas, movements manuais, integração com proposta/tabela dinâmica, histórico em UI, cards de KPI na Visão Geral, QR code, upload, delete físico.

## Riscos
- Índices únicos parciais aplicados em base com dados existentes podem falhar se já houver duplicatas. Como a tabela está vazia (sprints 0.2/0.3 só criaram schema/CRUD de cat/loc), risco é zero.
- Constraint check `inventory_items_serialized_quantity_valid` exige `quantity_total=1` e `quantity_available ∈ {0,1}` para serializados — já coberto pelo `getQuantityAvailableForStatus`.

## Próximos passos (INV 0.5)
Cadastro de itens por quantidade e KPIs na Visão Geral.
