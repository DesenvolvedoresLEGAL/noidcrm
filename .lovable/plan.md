# Sprint INV 1.0 — Alocação Inteligente de Estoque

Evolui a pré reserva (INV 0.9) para suportar **demanda por categoria/família** e **alocação posterior** de itens físicos (serializados ou por quantidade), preservando o status físico real dos itens.

## 1. Banco de dados (migration única)

### Nova tabela `inventory_pre_reservation_allocations`
- Campos: `organization_id`, `pre_reservation_id`, `pre_reservation_item_id`, `allocation_item_type` (serialized|quantity), `serialized_item_id`, `quantity_item_id`, `allocated_quantity`, `allocation_status` (active|cancelled|replaced), `notes`, `created_by`, `updated_by`, timestamps.
- Constraints: type check, status check, quantidade > 0, exclusividade serialized vs quantity.
- Índices em `organization_id`, `pre_reservation_id`, `pre_reservation_item_id`, `serialized_item_id`, `quantity_item_id`.
- RLS via `user_belongs_to_organization` (helper já existente no projeto).

### Extensões em `inventory_pre_reservation_items`
- Novas colunas: `allocation_status` (default `unallocated`), `allocated_quantity` (default 0), `demand_label`, `demand_source` (default `manual`), `product_id`, `proposal_item_id`.
- Constraints de check para `allocation_status` e `demand_source`.
- Adicionar valor `category_family_demand` ao domínio de `inventory_item_type` (mantendo `sku` por compat).
- Índice em `(organization_id, allocation_status)`.

### Extensão em `products`
- `inventory_demand_rules jsonb not null default '[]'` para kits lógicos simples.

### Triggers e funções
- `validate_pre_reservation_allocation_org` — garante que a alocação herda org/reservation do item pai.
- `validate_pre_reservation_allocation_inventory_item` — valida que item serializado/quantidade pertence à mesma org.
- `recalculate_pre_reservation_item_allocation(uuid)` — soma alocações ativas e atualiza `allocated_quantity`, `allocation_status`, `pre_reserved_quantity`, `availability_status`.
- `recalculate_allocation_after_change` — trigger AFTER INSERT/UPDATE/DELETE em allocations chamando o recálculo.
- `find_inventory_allocation_candidates(uuid)` — RPC que retorna candidatos serializados + por quantidade filtrados por categoria/família e disponibilidade no período (usa `check_inventory_availability_for_period` da INV 0.9).
- Atualizar `recalculate_inventory_pre_reservation_status` para considerar alocação real (low/medium/high/critical conforme regra abaixo).

### Regra de risco atualizada
| Situação | Risco |
|---|---|
| Tudo alocado/disponível | low |
| Demandas sem alocação mas com candidatos | medium |
| Demandas parcialmente alocadas | high |
| Demandas sem candidatos suficientes | critical |

## 2. Backend (services + hooks)

### `src/lib/operations/inventoryPreReservations.ts`
- Adicionar enums `ALLOCATION_STATUSES`, `ALLOCATION_ITEM_TYPES`, labels e badge variants.
- Estender `inventoryPreReservationItemSchema` com `allocation_status`, `allocated_quantity`, `demand_label`, `demand_source`, `product_id`, `proposal_item_id` e suportar `category_family_demand`.
- Novo `inventoryPreReservationAllocationSchema` (com superRefine: serializado obriga qty=1, refs corretas).

### `src/services/operations/inventoryPreReservations.ts`
- `findAllocationCandidates(itemId)`
- `createAllocation(payload)`
- `cancelAllocation(allocationId)` (soft via `allocation_status='cancelled'`)
- `listAllocations(itemId)`
- `recalculatePreReservationItemAllocation(itemId)`

### `src/services/operations/inventoryProposalBridge.ts`
- Quando `inventory_control_mode = category_family_demand`: gerar item com `inventory_item_type='category_family_demand'`, `category_id`, `family_id`, `requested_quantity = qty * multiplier`, `allocation_status='unallocated'`.
- Suportar `inventory_demand_rules` (JSONB): expandir um proposal_item em N demandas conforme regras (resolver category/family por slug). Sem regras → comportamento atual.
- Persistir `product_id` e `proposal_item_id` em cada demanda.

### `src/hooks/operations/useInventoryPreReservations.ts`
Novos hooks:
- `useInventoryAllocationCandidates(itemId)`
- `useInventoryPreReservationAllocations(itemId)`
- `useCreateInventoryAllocation()`
- `useCancelInventoryAllocation()`
- `useRecalculatePreReservationItemAllocation()`

Invalidações: chave base + detail do pre_reservation + overview.

## 3. Frontend

### Detalhe da pré reserva (`InventoryPreReservationDetailDialog`)
- Tabela de itens com colunas: Demanda · Categoria · Família · Solicitado · Alocado · Status · Ações.
- Badge de `allocation_status`. Ações: **Alocar**, **Ver alocações**, **Remover demanda**.

### Novos componentes
- `src/components/operations/inventory/InventoryAllocationDialog.tsx`
  - Mostra resumo (solicitado / alocado / restante).
  - Lista candidatos via `useInventoryAllocationCandidates`.
  - Serializados: checkbox (qty=1).
  - Quantidade: input numérico (≤ disponível).
  - Validações de quantidade, indisponibilidade, alerta de alocação parcial.
  - Submete N alocações em sequência; mostra toast e recalcula.
- `src/components/operations/inventory/InventoryAllocatedItemsList.tsx`
  - Lista alocações ativas com ações **Cancelar** e **Substituir** (cancela + reabre dialog).

### Painel da proposta (`ProposalInventoryPanel`)
- Adicionar KPIs: Demandas · Alocadas · Parciais · Pendentes · Conflitos.
- Botões: Ver demandas (abre detalhe), Alocar itens (abre dialog na 1ª demanda pendente), Recalcular, Abrir no Inventário.

### Visão geral (`InventoryOverviewTab`)
- Novo bloco "Alocação de demandas" com cards: Pendentes · Parciais · 100% alocadas · Risco operacional.
- Alertas textuais para demandas pendentes em pré reservas ativas.

## 4. Comportamento físico
**NÃO** alterar `inventory_serialized_items.status` nem `inventory_quantity_items.available_quantity`. Alocação é apenas intenção de uso no período; reserva definitiva fica para sprint futura.

## 5. Critérios de aceite
Conforme lista do briefing — destaque: demanda category_family_demand criável, candidatos filtrados por período/categoria/família, alocação mista (serializado + quantidade), recálculo automático de status, prevenção de serializado com qty≠1 e quantidade > disponível, painel da proposta com KPIs, status físico inalterado, INV 0.9 sem regressões, typecheck/build verdes.

## Detalhes técnicos

**Arquivos criados (≈4):**
- `supabase/migrations/<timestamp>_inv_1_0_allocations.sql`
- `src/components/operations/inventory/InventoryAllocationDialog.tsx`
- `src/components/operations/inventory/InventoryAllocatedItemsList.tsx`
- (opcional) `src/services/operations/inventoryAllocations.ts` se preferir separar de `inventoryPreReservations.ts`

**Arquivos editados (≈8):**
- `src/lib/operations/inventoryPreReservations.ts`
- `src/services/operations/inventoryPreReservations.ts`
- `src/services/operations/inventoryProposalBridge.ts`
- `src/hooks/operations/useInventoryPreReservations.ts`
- `src/components/operations/inventory/InventoryPreReservationDetailDialog.tsx`
- `src/components/operations/inventory/InventoryPreReservationsTab.tsx` (badges/colunas allocation_status)
- `src/components/operations/inventory/InventoryOverviewTab.tsx`
- `src/components/proposals/ProposalInventoryPanel.tsx`

**Riscos:**
- Nomes reais de colunas em `inventory_serialized_items`/`inventory_quantity_items` (name/code/serial_number) precisam ser verificados antes da RPC `find_inventory_allocation_candidates` — ajustar se divergir.
- Assinatura de `check_inventory_availability_for_period` (INV 0.9) deve aceitar `exclude_pre_reservation_id` para não contar a própria reserva ao buscar candidatos; conferir e ajustar a chamada se necessário.
- Trigger de recálculo dispara em cascata; manter `security definer` + `search_path=public`.
