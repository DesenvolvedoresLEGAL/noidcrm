## Sprint INV 0.6 — Visão Geral Real do Inventário

Transformar `InventoryOverviewTab` num dashboard operacional real com dados das tabelas existentes (`inventory_items`, `inventory_categories`, `inventory_locations`, `inventory_status_history`). Sem novas tabelas, sem RPCs, sem edge functions, sem alterar schema.

### Arquivos a criar

1. **`src/services/operations/inventoryOverview.ts`** — funções puras de leitura:
   - `listOverviewItems(orgId)` — `SELECT id, item_kind, status, quantity_total, quantity_available, quantity_minimum, updated_at FROM inventory_items WHERE organization_id`.
   - `countCategories(orgId)` / `countLocations(orgId)` via `count: 'exact', head: true`.
   - `listCriticalItems(orgId)` — busca itens com `status in (maintenance, damaged, lost)` OU (`item_kind='quantity'` e (`quantity_available=0` ou `quantity_available < quantity_minimum`)), join categoria/local, ordenação no frontend (zerado > abaixo > manutenção > danificado > perdido), limit 10.
   - `listRecentItems(orgId)` — top 8 por `updated_at desc` com category/location.
   - `listRecentStatusHistory(orgId)` — top 8 de `inventory_status_history` com `item:inventory_items(name,item_kind)`.

2. **`src/hooks/operations/useInventoryOverview.ts`** — hooks TanStack Query:
   - `useInventoryOverviewData()` → executa as 5 queries em paralelo via `useQueries` ou hooks separados; expõe os agregados calculados (`totals`, `health`, `alerts`, `categoriesCount`, `locationsCount`).
   - Cálculo derivado no client a partir de `listOverviewItems`: serializados, por quantidade, disponíveis, indisponíveis (blocked/maintenance/damaged/retired/lost), bloqueados, manutenção, danificados, perdidos, baixados, zerados, abaixo do mínimo.

3. **`src/components/operations/inventory/overview/`** (novos componentes pequenos):
   - `OverviewKpiCards.tsx` — 4 cards principais (Serializados, Por quantidade, Disponíveis, Indisponíveis).
   - `OverviewHealthCards.tsx` — 7 cards compactos (Bloqueados, Manutenção, Danificados, Perdidos, Baixados, Categorias, Locais).
   - `OverviewAlertsBlock.tsx` — 4 cards de alerta + estado vazio "Nenhum alerta operacional no momento".
   - `OverviewCriticalItemsTable.tsx` — tabela "Itens que exigem atenção" (Item, Tipo, Categoria, Local, Status/Alerta, Saldo, Atualizado em).
   - `OverviewRecentItemsTable.tsx` — "Últimos itens atualizados".
   - `OverviewRecentStatusTable.tsx` — "Últimas mudanças de status" usando `ITEM_STATUS_LABEL`.
   - `OverviewEmptyState.tsx` — estado quando não há nenhum item, com CTA "Cadastrar item" que muda a tab ativa para `items`.

### Arquivos a editar

- **`src/components/operations/inventory/InventoryOverviewTab.tsx`** — reescrito para orquestrar:
  1. Frase curta no topo
  2. KPIs principais
  3. Saúde operacional
  4. Alertas
  5. Itens críticos
  6. Últimos itens atualizados
  7. Últimas mudanças de status
  8. Regra de demanda (versão enxuta da existente)
  9. Próximas capacidades (lista compacta substituindo `conceptCards`/`futureFlows` longos)
  10. Empty state global se zero itens
  - Aceita prop opcional `onNavigateToItems?: () => void` para o CTA do empty state.

- **`src/pages/operations/Inventory.tsx`** — controlar `Tabs` por estado (`useState`) em vez de `defaultValue`, passar `onNavigateToItems={() => setTab('items')}` ao `InventoryOverviewTab`.

- **`src/lib/operations/inventoryLabels.ts`** — adicionar helper `getCriticalSortRank(item)` opcional para ordenação consistente.

### Regras técnicas

- Todas as queries filtram por `organization_id` da org corrente (`useCurrentOrganization`). RLS já cobre, mas filtramos explicitamente.
- Sem service role, sem RPC nova, sem alterar schema.
- Loading: usar `Skeleton` (componente já existe no projeto) nos cards e linhas das tabelas.
- Empty states elegantes em cada bloco.
- Badges reutilizam `getStatusBadgeVariant` e `getStockAlertVariant` já presentes em `inventoryLabels.ts`.
- Saldo: serializado → `—`; quantidade → `quantity_available / quantity_total`.
- Datas formatadas com util já usado no projeto (`date-fns` pt-BR — verificar `src/lib/dateUtils.ts`).

### Fora de escopo

Chips, kits, reservas, ocupação, transferências, integração proposta/tabela dinâmica, edge functions, RPCs, delete físico, alteração de schema.

### Riscos

- `inventory_status_history` pode não ter `organization_id` direto — se não tiver, filtrar via join `item:inventory_items!inner(organization_id)` com `.eq('item.organization_id', orgId)`. Verificar no momento da implementação.
- `useQueries` precisa que cada query tenha `enabled: !!orgId` para evitar disparos prematuros.
- Lista de "itens críticos" ordenada no client porque PostgREST não suporta `CASE WHEN` em order.