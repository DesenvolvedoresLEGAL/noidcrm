# Sprint INV 1.2 — Preparação, Expedição, Retorno e Baixa Operacional

Fecha o ciclo físico do inventário: a reserva definitiva passa a mover o status real dos itens (serializados) e os buckets operacionais (itens por quantidade), com timeline, checklists e histórico auditável.

## 1. Banco de Dados (migration única)

### 1.1 Nova tabela `inventory_operation_events`
- Campos conforme especificado: `reservation_id`, `reservation_item_id`, `reservation_allocation_id`, `event_type`, `from_status`, `to_status`, `allocation_item_type`, `serialized_item_id`, `quantity_item_id`, `quantity`, `notes`, `metadata`, `created_by`.
- Constraints de `event_type` e `quantity > 0`.
- Índices por `(org, reservation, created_at desc)`, `(org, serialized_item_id)`, `(org, quantity_item_id)`.
- RLS: SELECT/INSERT via `user_belongs_to_organization(organization_id)` (helper já existente no projeto).

### 1.2 Alterações em `inventory_reservation_allocations`
- Novas colunas: `operational_status` (default `pending`), `prepared_at/by`, `dispatched_at/by`, `in_operation_at`, `returned_at/by`, `released_at/by`, `return_condition`, `return_notes`.
- Constraints de domínio para `operational_status` e `return_condition`.
- Índice em `(organization_id, operational_status)`.

### 1.3 Alterações em `inventory_quantity_items`
- Novos buckets: `reserved_quantity`, `in_preparation_quantity`, `dispatched_quantity`, `in_operation_quantity`, `returned_quantity`, `maintenance_quantity`, `damaged_quantity`, `lost_quantity` (default 0, check `>= 0`).
- Verifica que `available_quantity` continua sendo a base; transições subtraem/adicionam atomicamente.

### 1.4 Status físico em `inventory_serialized_items`
- Garantir que o enum/check aceite: `available`, `reserved`, `in_preparation`, `dispatched`, `in_operation`, `returned`, `maintenance`, `lost`, `damaged`, `inactive`. Adicionar valores faltantes preservando os existentes.

## 2. Funções RPC (SECURITY DEFINER, `search_path = public`)

### 2.1 `update_inventory_reservation_operational_status(p_reservation_id, p_new_status, p_notes)`
- Valida transições permitidas:
  - `confirmed → in_preparation → dispatched → in_operation → returned → closed`
  - `confirmed | in_preparation → cancelled`
- Para cada alocação ativa (`operational_status not in (cancelled, released, damaged, lost, maintenance)`), aplica efeitos físicos:

```text
confirmed → in_preparation : serializado=in_preparation; qty: reserved→in_preparation; alloc=prepared; evento item_prepared
in_preparation → dispatched: serializado=dispatched; qty: in_preparation→dispatched; alloc=dispatched; evento item_dispatched
dispatched → in_operation : serializado=in_operation; qty: dispatched→in_operation; alloc=in_operation; evento item_in_operation
in_operation → returned   : serializado=returned; qty: in_operation→returned; alloc=returned; evento item_returned
returned → closed         : exige return_condition em TODAS as alocações; aplica baixa por condição
```
- `closed` por condição:
  - `ok` → serializado `available`, qty `returned→available`, alloc `released`, evento `item_released`
  - `damaged` → serializado `damaged`, qty `returned→damaged`, alloc `damaged`, evento `item_damaged`
  - `lost` → serializado `lost`, qty `returned→lost`, alloc `lost`, evento `item_lost`
  - `maintenance_required` → serializado `maintenance`, qty `returned→maintenance`, alloc `maintenance`, evento `item_sent_to_maintenance`
- Atualiza header `inventory_reservations.status` + cria evento `reservation_status_changed`.
- Tudo dentro de transação atômica; valida tenant via `user_belongs_to_organization`.

### 2.2 `set_inventory_return_condition(p_reservation_allocation_id, p_return_condition, p_return_notes)`
- Exige reserva em `returned` e alocação em `returned`.
- Atualiza `return_condition`, `return_notes`, `returned_by` (não muda status físico — isso só ocorre no fechamento).

### 2.3 Atualizar `convert_pre_reservation_to_reservation` (INV 1.1)
- Após criar reserva e alocações com status inicial `confirmed`, comprometer estoque físico:
  - Serializados alocados: `status = 'reserved'`.
  - Quantidade: `available_quantity -= allocated; reserved_quantity += allocated` (com validação `available_quantity >= 0`, abortando a conversão em caso de inconsistência).
- Em caso de falha de validação, rollback completo (já é uma única transação RPC).
- Registrar evento `reservation_status_changed` (from null → confirmed).

### 2.4 Ajustar `check_inventory_availability_for_period`
- Continuar subtraindo as alocações definitivas ativas; agora `reserved_quantity` já representa o bloqueio físico, garantir que não haja dupla contagem entre buckets (`available` é a fonte). Revisar para usar `available_quantity` direto onde já refletido.

## 3. Camada de Serviço & Hooks

### 3.1 `src/services/operations/inventoryReservations.ts` (expansão)
- `updateReservationOperationalStatus(reservationId, status, notes?)`
- `setReturnCondition(allocationId, condition, notes?)`
- `getOperationEvents(reservationId)`

### 3.2 `src/hooks/operations/useInventoryReservations.ts` (expansão)
- `useUpdateInventoryReservationOperationalStatus()`
- `useSetInventoryReturnCondition()`
- `useInventoryOperationEvents(reservationId)`
- Invalidações: queries de reserva, alocações, overview, itens serializados/quantidade afetados.

### 3.3 `src/lib/operations/inventoryReservations.ts`
- Adicionar Zod:
  - `inventoryReservationOperationalStatusSchema`
  - `inventoryReturnConditionSchema`
- Tabela de transições `OPERATIONAL_STATUS_TRANSITIONS` reutilizada no client para habilitar/desabilitar ações.

## 4. Frontend

### 4.1 `InventoryReservationDetailDialog`
Nova seção **Operação Física** com 4 blocos:
- **Timeline** horizontal: Confirmada → Em preparação → Despachada → Em operação → Retornada → Fechada (mostra data/hora/usuário/notas por etapa, derivado de `inventory_operation_events` filtrado por `reservation_status_changed`).
- **Checklist de saída** (componente `ReservationDispatchChecklist`): visível em `confirmed`/`in_preparation`. Lista de alocações com tipo, quantidade, `operational_status`, ações rápidas (v1: derivado da transição em massa; placeholder para overrides individuais).
- **Checklist de retorno** (`ReservationReturnChecklist`): visível em `returned`. Para cada alocação: select de condição (OK / Avariado / Perdido / Manutenção) + observações, salvo via `setReturnCondition`. Botão "Fechar reserva" só habilitado quando todas as condições preenchidas.
- **Histórico operacional** (`ReservationOperationHistory`): tabela com data, evento, item, quantidade, usuário, observação.

Ações rápidas no header do dialog conforme status atual (Iniciar preparação / Despachar / Marcar em operação / Marcar retorno / Fechar reserva / Cancelar).

### 4.2 `InventoryDefinitiveReservationsTab`
- Coluna de status operacional + ações rápidas inline respeitando transições válidas.
- Filtro por status operacional.

### 4.3 `ProposalInventoryPanel`
- Quando reserva existir, mostrar status operacional, contagem de itens, e pendências de saída/retorno.

### 4.4 `InventoryOverviewTab`
- Novos KPIs: Reservas em preparação, Itens despachados, Itens em operação, Itens aguardando conferência, Itens em manutenção, Itens perdidos.
- Banner de alertas: "X reservas retornadas aguardando conferência", "X itens marcados como perdidos", "X itens avariados aguardando ação".

### 4.5 Listas de itens (serializado / quantidade)
- Refletir os novos status/buckets nas badges e contadores existentes (sem quebrar layouts atuais).

## 5. Riscos e Mitigações
- **Conversão atual da INV 1.1**: passa a mexer em estoque físico → mitigar com validação atômica de `available_quantity >= 0` e cobertura via Sprint 1.1 não regredida (mantém RPC, só adiciona efeitos no final).
- **Dupla contagem de bloqueio**: `check_inventory_availability_for_period` deve usar `available_quantity` como fonte; revisar para evitar subtrair alocações já refletidas em buckets.
- **Status enums em `inventory_serialized_items`**: adicionar valores via `ALTER TYPE` somente se faltantes (verificar antes; se for check constraint, recriar).
- **RLS multi-tenant**: novas tabelas/RPCs validam `organization_id` via helper existente; nenhuma rota bypassa RLS.
- **Cache React Query**: invalidar reservas, alocações, itens serializados por SKU afetado, `inventory-overview`, `proposal-inventory`.
- **Operações em massa**: a RPC processa todas as alocações da reserva atomicamente; em caso de erro, transação completa abortada.

## 6. Critérios de Aceite
Cobertos: tabela `inventory_operation_events` criada; `operational_status` em alocações; transições `confirmed → in_preparation → dispatched → in_operation → returned → closed` com efeitos físicos corretos em serializados e buckets de quantidade; bloqueio do fechamento sem `return_condition` em todas as alocações; baixa correta para `available/damaged/lost/maintenance`; histórico operacional persistido e visível; UI com timeline, checklists, ações rápidas e KPIs; painel da proposta atualizado; typecheck/build sem regressões da INV 1.1.

## 7. Arquivos impactados (estimativa)
- Migration nova: `supabase/migrations/<timestamp>_inv_1_2_operational_flow.sql`
- `src/services/operations/inventoryReservations.ts` (edit)
- `src/hooks/operations/useInventoryReservations.ts` (edit)
- `src/lib/operations/inventoryReservations.ts` (edit)
- `src/components/operations/inventory/InventoryReservationDetailDialog.tsx` (edit)
- Novos: `ReservationOperationTimeline.tsx`, `ReservationDispatchChecklist.tsx`, `ReservationReturnChecklist.tsx`, `ReservationOperationHistory.tsx`
- `src/components/operations/inventory/InventoryDefinitiveReservationsTab.tsx` (edit)
- `src/components/operations/inventory/InventoryOverviewTab.tsx` (edit)
- `src/components/proposals/ProposalInventoryPanel.tsx` (edit)
- `src/integrations/supabase/types.ts` (auto)
