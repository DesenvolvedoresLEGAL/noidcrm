# Sprint INV 1.1 — Reserva Definitiva e Conversão de Pré Reserva

## Objetivo
Criar a camada de **reserva definitiva** que compromete oficialmente o estoque por período operacional, alimentada pela conversão de pré reservas (INV 0.9/1.0) com checagem de conflito e rastreabilidade ponta-a-ponta (proposta → pré reserva → reserva → alocações).

## Escopo

### 1. Migração de banco
Nova migração única contendo:

**Tabelas**
- `inventory_reservations` — header da reserva (proposta, oportunidade, conta, contato, código `RES-YYYY-NNNNN`, datas operacionais e do evento, status, risk_level, confirmation_trigger, confirmed_at/by, notes, audit).
- `inventory_reservation_items` — demandas reservadas (referência opcional ao `inventory_pre_reservation_items` de origem, tipo, ids serializado/quantity, categoria/família, requested/reserved_quantity, demand_label, demand_source, reservation_status, conflict_reason).
- `inventory_reservation_allocations` — alocações físicas comprometidas (referência opcional à alocação de pré reserva de origem, tipo, item serializado/quantity, allocated_quantity, allocation_status).

Constraints CHECK conforme spec (status, risk, source, trigger, datas, exclusividade serialized/quantity, quantidade > 0, unique `org_id + reservation_code`).

**Índices** conforme spec (org+status, pre_reservation, proposal, período, reservation, item, serialized, quantity).

**RLS** ativada nas três tabelas, usando helpers existentes do projeto (`user_belongs_to_organization`, `is_organization_admin_or_owner`).

**Funções e triggers**
- `generate_inventory_reservation_code(org_id)` — gera `RES-YYYY-NNNNN`.
- `set_inventory_reservation_code()` — BEFORE INSERT.
- `set_inventory_reservation_updated_at()` — BEFORE UPDATE nas 3 tabelas.
- `validate_inventory_reservation_item_org()` — valida org/parent.
- `validate_inventory_reservation_allocation_org()` — valida org + reservation_id consistente.
- `validate_inventory_reservation_allocation_inventory_item()` — valida item físico/org.
- `check_inventory_reservation_conflict(...)` — RPC SECURITY DEFINER (`set search_path = public`) retornando `conflict_status / available / reserved / count / message`. Bloqueia status `confirmed | in_preparation | dispatched | in_operation`.
- `convert_pre_reservation_to_reservation(p_pre_reservation_id, p_confirmation_trigger)` — RPC principal:
  - valida org, status `active`, ainda não convertida (sem reserva ativa filha).
  - exige todas demandas obrigatórias alocadas (ignora `service_no_stock`).
  - roda `check_inventory_reservation_conflict` para cada alocação ativa; se houver conflito, retorna `{success:false, reason:'reservation_conflict', conflicts:[...]}` sem criar nada.
  - cria header, copia items e alocações com `source_*_id`, define `reservation_status` por completude.
  - marca pré reserva como `converted`.
- `get_inventory_reservations_overview()` — KPIs (ativas, itens reservados, em preparação/despachadas/em operação, próxima operação) escopadas por org via helper.

**Atualizar `check_inventory_availability_for_period`** (criada na INV 0.9) para somar bloqueios de `inventory_reservation_allocations` cujas reservas estejam em `confirmed | in_preparation | dispatched | in_operation` e cujo período cruze com `daterange(...)`. Status `returned | closed | cancelled` não bloqueiam.

### 2. Camada de serviços (`src/services/operations/`)
- Novo `inventoryReservations.ts`: `listReservations`, `getReservation`, `convertPreReservationToReservation`, `getReservationsOverview`, `updateReservationStatus`, `cancelReservation`, `checkReservationConflict`. Validação de transições de status (matriz da spec §20).
- Atualizar `inventoryPreReservations.ts`: helper `convertToReservation(preReservationId, trigger)` chamando o serviço novo.
- Schemas Zod: `inventoryReservationSchema` e `inventoryReservationStatusUpdateSchema` em `src/lib/operations/inventoryReservations.ts`.

### 3. Hooks (`src/hooks/operations/`)
Novo `useInventoryReservations.ts` com:
`useInventoryReservations`, `useInventoryReservation`, `useConvertPreReservationToReservation`, `useInventoryReservationsOverview`, `useUpdateInventoryReservationStatus`, `useCancelInventoryReservation`, `useCheckInventoryReservationConflict`. Mantém o padrão React Query/invalidations já usado por pré reservas.

### 4. UI Inventário
- `src/pages/operations/Inventory.tsx`: aba **Reservas** ganha sub-tabs internos: `Pré reservas | Reservas definitivas | Calendário`.
- Novo `InventoryReservationsTab.tsx`:
  - KPI cards (Ativas, Itens reservados, Em preparação, Despachadas, Em operação, Próxima operação).
  - Tabela com colunas Código/Título/Cliente/Período/Status/Risco/Itens/Origem/Ações.
  - Filtros: status, risco, período, origem, busca.
  - Ações: Ver detalhes, Mudar status, Cancelar, Abrir proposta.
- Novo `InventoryReservationDetailDialog.tsx`: header com proposta/oportunidade/cliente/pré reserva de origem/datas/trigger/confirmação; tabela de itens; tabela de alocações; ações de transição de status conforme matriz.
- Atualizar `InventoryOverviewTab.tsx`: bloco "Reservas definitivas" com KPIs vindos da nova RPC.
- Atualizar listas de itens (serializados e por quantidade): coluna **Ocupação** mostrando pré reserva + reserva (ex: `3 pré-reservados / 7 reservados` para quantity; `Reservado até 12/06` para serializado). Reaproveita summary existente extendido com dados de `inventory_reservation_allocations`.

### 5. UI Pré reserva
- `InventoryPreReservationDetailDialog.tsx`: botão **Converter em reserva definitiva**, habilitado apenas se `status=active`, todas demandas alocadas e sem conflitos. Mostra motivo do bloqueio (pendências ou conflitos retornados pela RPC). Em sucesso, redireciona para o detalhe da reserva nova.

### 6. UI Proposta
- `ProposalInventoryPanel.tsx`: três estados visuais
  1. Sem pré reserva → CTA gerar (existente).
  2. Pré reserva ativa → KPIs + botões `Ver pré reserva | Converter em reserva definitiva | Recalcular`.
  3. Reserva definitiva criada → mostra código `RES-...`, status, período operacional, itens reservados; botões `Abrir reserva | Ver itens reservados`.

### 7. Gatilho automático (preparado, não ativado)
Helper exportado `tryAutoConvertOnProposalEvent({proposalId, trigger})` em `inventoryProposalBridge.ts`, pronto para ser invocado quando proposta vira `approved` ou pagamento `paid`. Não plugar no fluxo automático nesta sprint (apenas deixar testável e documentado).

### 8. Itens físicos
**Não alterar** `inventory_serialized_items.status` nem `inventory_quantity_items.available_quantity`. O bloqueio se dá exclusivamente via `check_inventory_availability_for_period` somando reservas definitivas. Mudança de status físico fica para sprint futura (preparação/expedição/retorno).

## Detalhes técnicos

- Todas as funções `SECURITY DEFINER` usam `SET search_path = public` (regra de segurança do projeto).
- RLS: SELECT/INSERT/UPDATE para membros da organização; DELETE somente admin/owner em `inventory_reservations`.
- Conversão é atômica: função plpgsql roda em transação implícita; falha em qualquer item faz rollback completo.
- React Query: invalidar `['inventory-reservations']`, `['inventory-pre-reservations']`, `['inventory-overview']`, `['inventory-availability']` após conversão/status/cancelamento.
- Após migração, `src/integrations/supabase/types.ts` é regerado automaticamente; serviços passam a usar os novos tipos.

## Arquivos previstos
**Criar (~7):**
- `supabase/migrations/<ts>_inv_1_1_definitive_reservations.sql`
- `src/services/operations/inventoryReservations.ts`
- `src/lib/operations/inventoryReservations.ts`
- `src/hooks/operations/useInventoryReservations.ts`
- `src/components/operations/inventory/InventoryReservationsTab.tsx`
- `src/components/operations/inventory/InventoryReservationDetailDialog.tsx`
- `src/components/operations/inventory/InventoryReservationItemsList.tsx`

**Editar (~8):**
- `src/services/operations/inventoryPreReservations.ts`
- `src/services/operations/inventoryProposalBridge.ts`
- `src/hooks/operations/useInventoryPreReservations.ts`
- `src/components/operations/inventory/InventoryPreReservationDetailDialog.tsx`
- `src/components/operations/inventory/InventoryOverviewTab.tsx`
- `src/components/operations/inventory/InventoryQuantityItemsTab.tsx`
- `src/components/operations/inventory/InventorySerializedItemsTab.tsx`
- `src/components/proposals/ProposalInventoryPanel.tsx`
- `src/pages/operations/Inventory.tsx`

## Riscos
- Atualização de `check_inventory_availability_for_period` precisa preservar assinatura/retorno usados pela INV 0.9/1.0 — adicionar bloqueio sem quebrar consumidores.
- Conversão pode falhar silenciosamente se status físico de um serializado mudou para `maintenance` entre alocação e conversão; tratado via `check_inventory_reservation_conflict` retornando `unavailable`.
- Geração de código `RES-YYYY-NNNNN` por contagem pode colidir em alta concorrência; suficiente para escala atual (mesmo padrão usado em outros códigos do projeto).

## Critérios de aceite
Conforme spec §26: tabelas/RLS/código automático/conversão completa com cópia de items+alocações, bloqueios de conflito e status de origem, painel de proposta atualizado, disponibilidade considera reserva definitiva, status físico inalterado, sem regressão em INV 0.9 e 1.0, typecheck e build verdes.
