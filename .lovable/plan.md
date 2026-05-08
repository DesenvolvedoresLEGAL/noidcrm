# Sprint INV 1.3 — Calendário de Ocupação e Capacidade Operacional

Substituir o placeholder da sub-aba "Calendário de ocupação" por uma visão real, baseada em RPCs agregadas das tabelas existentes (sem nova tabela de calendário). Adiciona snapshot de capacidade reutilizável pela proposta e bloco de capacidade na Visão Geral.

## 1. Banco de dados (1 migration)

Sem novas tabelas. Apenas 3 RPCs `SECURITY DEFINER` com `SET search_path = public`, escopadas por `organization_id` via `user_belongs_to_organization`.

### RPC `get_inventory_occupancy_calendar`
- Parâmetros: `p_start_date date`, `p_end_date date`, `p_category_id uuid default null`, `p_family_id uuid default null`, `p_status text default null`, `p_view_mode text default 'item'`.
- Une (UNION ALL) ocupações de:
  - `inventory_pre_reservations` + `_items` + `_allocations` com `status = 'active'` (source_type=`pre_reservation`, occupancy_type=`pre_reserved`).
  - `inventory_reservations` + `_items` + `_allocations` com status em `('confirmed','in_preparation','dispatched','in_operation','returned')` (source_type=`reservation`, occupancy_type derivado de `operational_status` ou status do header).
  - Status físico atual de `inventory_items` (quantity buckets) e `inventory_serialized_items` para `maintenance | damaged | lost` (source_type=`physical_status`, span = período inteiro do filtro).
- Filtra por interseção de `[start_date, end_date]` com o intervalo solicitado e por categoria/família via join com `inventory_items`.
- Retorna colunas: `occupancy_type`, `source_type`, `source_id`, `item_type` (serialized|quantity), `item_id`, `item_name`, `item_code`, `category_id/name`, `family_id/name`, `start_date`, `end_date`, `status`, `quantity numeric`, `client_name`, `proposal_id`, `reservation_code`, `risk_level`.
- `closed`/`cancelled` só aparecem se `p_status` explicitamente os incluir (histórico).

### RPC `get_inventory_capacity_by_period`
- Parâmetros: `p_start_date`, `p_end_date`, `p_category_id`, `p_family_id`.
- Para cada `(category_id, family_id)`:
  - `total_units` = soma de `quantity_total` (quantity items) + count de serializados ativos.
  - Buckets agregados a partir do calendário acima: `pre_reserved_units`, `reserved_units`, `in_preparation_units`, `dispatched_units`, `in_operation_units`, `returned_units`, `maintenance_units`, `damaged_units`, `lost_units`.
  - `available_units = total - (pre_reserved + reserved + in_preparation + dispatched + in_operation + returned + maintenance + damaged + lost)`.
  - `occupancy_rate numeric` = (pre_reserved+reserved+in_preparation+dispatched+in_operation+returned)/NULLIF(total,0).
  - `risk_level`: `<0.5 baixo`, `<0.75 medio`, `<0.9 alto`, `>=0.9 critico`.

### RPC `get_inventory_availability_snapshot`
- Parâmetros: `p_start_date`, `p_end_date`, `p_category_id`, `p_family_id`, `p_requested_quantity numeric`.
- Retorna `available_quantity`, `pre_reserved_quantity`, `reserved_quantity`, `operational_quantity` (in_preparation+dispatched+in_operation+returned), `maintenance_quantity`, `can_fulfill bool` (`available >= requested`), `risk_level`, `message text` (PT-BR).

Validação Zod no front; sem CHECK constraints adicionais.

## 2. Camadas TS

### Service `src/services/operations/inventoryOccupancy.ts`
- `getOccupancyCalendar(filters)`
- `getCapacityByPeriod(filters)`
- `getAvailabilitySnapshot(payload)`
- Chama `supabase.rpc(...)` com tipos derivados de `Database['public']['Functions']`.

### Lib `src/lib/operations/inventoryOccupancy.ts`
- `inventoryOccupancyFiltersSchema` (zod): datas obrigatórias, `end_date >= start_date`, opcionais ids/status, `view_mode` enum `'item'|'category'|'reservation'`.
- `inventoryAvailabilitySnapshotSchema`: datas obrigatórias, `requested_quantity > 0`.
- Helpers: `OCCUPANCY_TYPE_LABELS`, `OCCUPANCY_TYPE_BADGE_VARIANT`, `RISK_LEVEL_LABELS/COLORS`, `computeRiskLevel(rate)`, `groupOccupancyByItem/Category/Reservation`.

### Hooks `src/hooks/operations/useInventoryOccupancy.ts`
- `useInventoryOccupancyCalendar(filters)`
- `useInventoryCapacityByPeriod(filters)`
- `useInventoryAvailabilitySnapshot(payload, { enabled })`
- React Query, keys `['inventory','occupancy', ...]`, stale 60s.

## 3. Frontend

### Página `InventoryOccupancyCalendarPage.tsx`
Renderizada dentro da sub-aba `calendar` em `InventoryReservationsTab.tsx` (substitui placeholder). Composição:

1. `InventoryCalendarFilters` — período (date range), categoria, família, tipo operacional, criticidade, status, cliente, proposta, reserva, busca por item; modo `Semana | Mês | Lista`.
2. `InventoryCapacitySummaryCards` — cards: capacidade total, livres, pré-reservadas, reservadas, em operação, retornos pendentes, taxa de ocupação, risco.
3. `InventoryOccupancyTimeline` — grid temporal item × dias com badges discretas (variants já existentes do design system, sem cores cruas).
4. `InventoryOccupancyTable` — tabela "por item" alternativa à timeline.
5. `InventoryCapacityByCategoryTable` — visão agregada por categoria/família com `occupancy_rate` e badge de risco.
6. `InventoryOccupancyByReservationTable` — visão por reserva (cliente, período, status, itens, risco).
7. `InventoryOccupancyAlerts` — gera alertas a partir do retorno das RPCs (categorias > 75%, retornos pendentes, sobreposições críticas).
8. `InventoryAvailabilitySnapshotCard` — usado tanto na página quanto reaproveitado pela proposta.

Badges via `Badge` shadcn com `variant` semântica (`secondary`, `outline`, `destructive`); cores via tokens já em `index.css`.

### Integração com proposta
Editar `ProposalInventoryPanel.tsx`:
- Botão "Ver capacidade no período" abre `Sheet`/`Dialog` com `InventoryAvailabilitySnapshotCard`, pré-preenchendo período da proposta + categoria/família do item selecionado.

### Visão Geral
Editar `InventoryOverviewTab.tsx`:
- Bloco "Capacidade operacional" com cards (7d / 30d / categorias críticas / itens em operação / retornos pendentes / capacidade livre) usando `useInventoryCapacityByPeriod`.
- Lista "Próximos períodos críticos" derivada das categorias com `risk_level >= alto`.

## 4. Arquivos

**Novos**
- `supabase/migrations/<ts>_inv_1_3_occupancy_rpcs.sql`
- `src/services/operations/inventoryOccupancy.ts`
- `src/lib/operations/inventoryOccupancy.ts`
- `src/hooks/operations/useInventoryOccupancy.ts`
- `src/components/operations/inventory/InventoryOccupancyCalendarPage.tsx`
- `src/components/operations/inventory/calendar/InventoryCalendarFilters.tsx`
- `src/components/operations/inventory/calendar/InventoryCapacitySummaryCards.tsx`
- `src/components/operations/inventory/calendar/InventoryOccupancyTimeline.tsx`
- `src/components/operations/inventory/calendar/InventoryOccupancyTable.tsx`
- `src/components/operations/inventory/calendar/InventoryCapacityByCategoryTable.tsx`
- `src/components/operations/inventory/calendar/InventoryOccupancyByReservationTable.tsx`
- `src/components/operations/inventory/calendar/InventoryOccupancyAlerts.tsx`
- `src/components/operations/inventory/calendar/InventoryAvailabilitySnapshotCard.tsx`

**Editados**
- `src/components/operations/inventory/InventoryReservationsTab.tsx` (remove placeholder, monta página)
- `src/components/operations/inventory/InventoryOverviewTab.tsx` (bloco capacidade)
- `src/components/proposals/ProposalInventoryPanel.tsx` (botão snapshot)
- `src/integrations/supabase/types.ts` (auto após migration)

## 5. Segurança e qualidade
- RPCs validam `organization_id = get_user_organization_id()` em todos os joins; sem acesso cross-tenant.
- `SECURITY DEFINER` + `SET search_path = public` (memory rule).
- Tudo via tokens semânticos do design system; sem cores hardcoded.
- Sem alterações em INV 1.1 / 1.2 (apenas leitura agregada).

## 6. Critérios de aceite
Conforme descrito na sprint: sub-aba real, 3 visões funcionais, filtros, capacidade/ocupação/risco calculados, snapshot acessível pela proposta, bloco na Visão Geral, RLS preservado, typecheck/build verdes.
