## Sprint INV 0.8 — Categorias, Famílias e Classificação Operacional

### Adaptações ao estado real do banco

A spec original assume duas tabelas (`inventory_serialized_items` / `inventory_quantity_items`) e helpers `user_belongs_to_organization` / `is_organization_admin_or_owner`. Hoje o módulo usa:

- Tabela única `inventory_items` (`item_kind` = `serialized` | `quantity`).
- `inventory_categories` já existe com `name`, `description`, `item_kind`, `is_active`, `sort_order` (sem slug/color/icon).
- RLS usa `user_can_access_inventory(organization_id)`.
- Não há colunas `reserved_quantity` / `maintenance_quantity` em itens; reservado/manutenção só existem como `status`.

O plano abaixo respeita essa realidade, mantendo a intenção da sprint.

### 1) Migração

**`inventory_categories` (alter)**
- Adicionar `slug text`, `color text`, `icon text`.
- Backfill `slug = normalize_inventory_slug(name)`; depois `NOT NULL`.
- Índice único `(organization_id, slug)`.
- Manter `is_active` como fonte de verdade (UI mostra "Ativo/Inativo"); `item_kind` permanece, mas formulário passa a aceitar "Ambos" (default `serialized` para compatibilidade — sem alterar dados existentes).

**`inventory_families` (nova)** — conforme spec, com FK em `inventory_categories`, RLS `user_can_access_inventory`, trigger de slug e `updated_at`.

**`inventory_items` (alter)**
- `family_id uuid references inventory_families(id) on delete set null`
- `operational_type text not null default 'equipment'` + check enum (8 valores).
- `criticality text not null default 'medium'` + check enum (4 valores).
- Índices em `(organization_id, family_id)` e `(organization_id, criticality)`.
- Trigger `validate_inventory_item_family_category()` em INSERT/UPDATE OF (category_id, family_id).

**Funções/triggers**
- `create extension if not exists unaccent`.
- `normalize_inventory_slug(text)` (immutable).
- `set_inventory_category_slug()` + `set_inventory_family_slug()` triggers BEFORE INSERT/UPDATE.

**RPC `get_inventory_category_overview()`** — agregando a partir de `inventory_items` único:
- `total_skus = count(*)`
- `total_units = sum(quantity_total)`
- `available_units = sum(quantity_available)` (e count para serializados disponíveis)
- `reserved_units = count(*) filter (where status='reserved')` (placeholder até existirem reservas reais; sprint observa que reservas virão depois)
- `maintenance_units = count(*) filter (where status='maintenance')`
- `critical_items = count(*) filter (where criticality='critical')`
- Filtra por `user_can_access_inventory`.

**Seed** — categorias padrão (Conectividade, Energia, Credenciamento, Sensores, Cabos e Acessórios, Materiais de Consumo, Outros) só em organizações sem nenhuma categoria.

### 2) Services

- `inventoryCategories.ts` — estender com `slug`, `color`, `icon`. Manter API atual.
- `inventoryFamilies.ts` (novo) — `listFamilies(orgId, categoryId?)`, `createFamily`, `updateFamily`, `deactivateFamily`.
- `inventoryItems.ts` — incluir `family_id`, `operational_type`, `criticality` em `SerializedItemInput` e `QuantityItemInput`; SELECT joinando `inventory_categories(id,name,slug,color,icon)` e `inventory_families(id,name,slug)`.
- `inventoryOverview.ts` — adicionar `getCategoryOverview()` chamando o RPC; alertas adicionais (críticos indisponíveis, categorias com >75% reservado, famílias com manutenção, categorias sem disponíveis, itens sem categoria).

### 3) Hooks

- `useInventoryCategories` — manter; expor `useCreate/Update/DeactivateCategory`.
- `useInventoryFamilies(categoryId?)`, `useCreate/Update/DeactivateFamily` (novo `useInventoryFamilies.ts`).
- `useInventoryOverview` — adicionar query `categoryOverview` e novos alertas.

### 4) Componentes UI

- `InventoryCategoriesTab.tsx` — adicionar colunas Slug, Cor, Ícone, "# famílias", "# itens"; dialog atualizado com color/icon (usar tokens semânticos do design system).
- `InventoryFamiliesTab.tsx` (novo) — filtro por categoria, CRUD, contagem de itens.
- `InventoryFamilyFormDialog.tsx` (novo).
- `Inventory.tsx` — sub-tab "Configurações" agrupando Categorias / Famílias / Locais (ou novas tabs irmãs, mantendo padrão atual).
- `InventoryClassificationFields.tsx` (novo, reutilizável):
  - Categoria (obrigatória), Família (carrega quando categoria selecionada; limpa ao trocar categoria), Tipo operacional (obrigatório, default `equipment`), Criticidade (default `medium`).
- `InventoryItemFormDialog.tsx` e `InventoryQuantityItemFormDialog.tsx` — substituir o select de categoria atual por `InventoryClassificationFields`. Persistir os 4 campos.
- `InventorySerializedItemsTab.tsx` e `InventoryQuantityItemsTab.tsx`:
  - Filtros: Categoria, Família, Tipo, Criticidade, Status, Busca textual (nome, código, serial, categoria, família, `metadata.technical_specs`).
  - Colunas: Categoria, Família, Tipo, Criticidade (badge sóbrio via tokens), Specs (já existe).
  - "Sem categoria" exibido para itens legacy.
- `InventoryOverviewTab.tsx`:
  - Bloco "Inventário por Categoria" (cards/tabela do RPC).
  - Bloco de alertas inteligentes adicionais.

### 5) Labels

`inventoryLabels.ts` — adicionar `OPERATIONAL_TYPE_LABELS`, `CRITICALITY_LABELS` (pt-BR) e helpers `criticalityBadgeVariant()`.

### 6) Validação Zod

`inventoryClassificationSchema`, `inventoryCategorySchema` (acrescentando color/icon), `inventoryFamilySchema` conforme spec.

### 7) Permissões

- Visualização: qualquer usuário com `user_can_access_inventory`.
- Mutação de categoria/família: mesma RLS atual (não há helper `is_organization_admin_or_owner` separado; controle adicional fica na UI por role `owner|admin|operations`, replicando o gate da rota).

### Critérios de aceite

- Cadastro/edição/inativação de categorias e famílias funcional.
- Itens (serializado e por quantidade) classificados pelos 4 campos.
- Trigger impede família de outra categoria.
- Listas com filtros e colunas pedidos; busca textual incluindo `metadata.technical_specs`.
- Dashboard com bloco por categoria + alertas.
- Itens legacy continuam visíveis como "Sem categoria"; nada em `metadata` é sobrescrito.
- Typecheck e build passando.

### Fora de escopo

Reservas reais (apenas placeholder via status), kits, precificação dinâmica, ações em lote de reclassificação, edge functions.