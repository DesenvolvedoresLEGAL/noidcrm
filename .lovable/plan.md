# Sprint INV 0.3 — CRUD de Categorias e Locais

## Objetivo
Adicionar navegação interna na página `/app/operations/inventory` com 3 tabs (Visão Geral, Categorias, Locais) e implementar CRUD completo (criar, editar, ativar/desativar — sem delete físico) sobre as tabelas `inventory_categories` e `inventory_locations` já existentes.

## Estrutura de arquivos

**Novos:**
- `src/services/operations/inventoryCategories.ts` — list/create/update/toggleStatus
- `src/services/operations/inventoryLocations.ts` — list/create/update/toggleStatus
- `src/hooks/operations/useInventoryCategories.ts` — query + mutations (TanStack Query)
- `src/hooks/operations/useInventoryLocations.ts` — query + mutations
- `src/components/operations/inventory/InventoryCategoriesTab.tsx` — tabela + empty state + busca/filtro
- `src/components/operations/inventory/InventoryLocationsTab.tsx` — tabela + empty state + busca/filtro
- `src/components/operations/inventory/InventoryCategoryFormDialog.tsx` — modal create/edit
- `src/components/operations/inventory/InventoryLocationFormDialog.tsx` — modal create/edit
- `src/components/operations/inventory/InventoryOverviewTab.tsx` — extrai conteúdo conceitual atual
- `src/lib/operations/inventoryLabels.ts` — mapas `item_kind` e `location_type` para labels PT-BR

**Editados:**
- `src/pages/operations/Inventory.tsx` — adiciona `<Tabs>` (Visão Geral | Categorias | Locais), mantém header e badge

## Camada de dados

Todas as queries usam `supabase` client com filtro explícito `organization_id = currentOrg.id` (via `useCurrentOrganization`). RLS já garante isolamento; o filtro no SELECT mantém clareza e cache key estável.

- `select * from inventory_categories where organization_id=$org order by sort_order asc, name asc`
- Insert/update setam `organization_id`, `created_by`/`updated_by = auth.uid()`
- Toggle: `update ... set is_active = !is_active`
- Tratamento de erro `23505` (unique_violation) → toast "Já existe ... com este nome."

Query keys: `['inventory-categories', orgId]`, `['inventory-locations', orgId]`. Invalidar após cada mutation.

## Validação (Zod)

**Categoria:**
- `name`: trim, 2-80 chars, obrigatório
- `description`: opcional, max 300
- `item_kind`: enum `serialized | quantity`, obrigatório
- `sort_order`: int ≥ 0, default 0
- `is_active`: boolean, default true

**Local:** mesma estrutura, `location_type` enum com 8 valores (`internal, external, maintenance, event, technician, lost, retired, other`).

## Mapas de label

```ts
ITEM_KIND_LABEL = { serialized: 'Serializado', quantity: 'Por quantidade' }
LOCATION_TYPE_LABEL = { internal:'Interno', external:'Externo', maintenance:'Manutenção',
  event:'Evento', technician:'Técnico', lost:'Perdido', retired:'Baixado', other:'Outro' }
```

## UI

- Tabs internas com `@/components/ui/tabs` (padrão shadcn já em uso)
- Tabela com `@/components/ui/table` + `Badge` para status (Ativa/Inativa, Ativo/Inativo)
- Modal com `Dialog` + `react-hook-form` + `zodResolver` (padrão `CategoryModal` de produtos como referência)
- Toggle com `AlertDialog` de confirmação (textos especificados na sprint)
- Empty state com ícone, título, descrição e CTA "Nova categoria"/"Novo local"
- Busca por nome (input client-side) e filtro Status (Ativos/Inativos/Todos)
- Toasts via `sonner` (padrão atual)

## Permissões

- A página já está protegida em `App.tsx` + `usePermissions` (Sprint INV 0.1)
- RLS no banco restringe a `owner|admin|operations` (Sprint INV 0.2)
- Frontend: nenhum bypass; mutations dependem de RLS

## Fora de escopo
Items, movements, chips, kits, reservas, seeds automáticos, edge functions, RPCs novas, contadores na Visão Geral (decisão: pular para manter sprint enxuta), delete físico.

## Riscos
- Constraint unique de nome por org já existe na Sprint INV 0.2 → tratamento `23505` cobre
- Cache stale após toggle → invalidação explícita resolve

## Próximos passos (INV 0.4)
CRUD de itens serializados consumindo categorias/locais ativos.
