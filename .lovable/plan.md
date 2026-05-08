## Sprint INV 0.9 — Pré Reserva Operacional por Período

Conecta propostas do CRM ao Inventário criando pré reservas por período operacional (montagem → desmontagem → conferência), sem alterar o status real dos itens.

### Realidade do projeto vs. spec

Diferenças encontradas no banco que ajustam a spec sem mudar o objetivo:

- **Não existem** `inventory_serialized_items` / `inventory_quantity_items`. Tudo vive em `public.inventory_items` com `item_kind in ('serialized','quantity')`. Toda a checagem de disponibilidade vai usar essa tabela única (item serializado = `item_kind='serialized' and status='available'`; por quantidade = `quantity_available`).
- **Helpers existentes**: `user_can_access_inventory(p_org_id uuid)`, `user_is_org_admin(_org_id uuid)`, `is_tenant_admin_or_owner(_tenant_id uuid)`. Não existe `user_belongs_to_organization` nem `is_organization_admin_or_owner` da spec — vamos usar os reais (`user_can_access_inventory` para SELECT/INSERT/UPDATE, `user_is_org_admin` para DELETE), mantendo a coerência com o resto do módulo Inventário.
- **`opportunities` não tem `event_start_date/event_end_date`**, só `close_date_prevista`. O fluxo "gerar pré reserva a partir da proposta" vai abrir um diálogo onde o usuário confirma `event_start_date` e `event_end_date` (default = `close_date_prevista`). Período operacional = evento − 1 dia / + 1 dia (configurável depois).
- `proposal_items.product_id → products` já existe; adicionamos os campos `inventory_control_mode` etc. em `products` (spec ipsis litteris).

### Banco (uma migration)

1. **`inventory_pre_reservations`** (campos da spec) com triggers `set_updated_at`, `set_inventory_pre_reservation_code` (gera `PRERES-YYYY-NNNNN`).
2. **`inventory_pre_reservation_items`** (campos da spec) com check `inventory_item_type/availability_status/quantity/reference`, trigger `validate_pre_reservation_item_org` e `set_updated_at`. As FKs `serialized_item_id` e `quantity_item_id` apontam ambas para `public.inventory_items(id) on delete set null` (o `inventory_item_type` discrimina o uso); o check de referência permanece como na spec.
3. **Índices** da spec.
4. **RLS**:
   - SELECT/INSERT/UPDATE → `user_can_access_inventory(organization_id)`
   - DELETE → `user_is_org_admin(organization_id)`
5. **RPCs** (todas `security definer`, `set search_path = public`):
   - `check_inventory_availability_for_period(...)` — adaptada à tabela única `inventory_items` (filtros por `item_kind`), com overlap via `daterange(...,'[]') && daterange(...,'[]')`, ignorando opcionalmente uma reserva (para recálculo).
   - `recalculate_inventory_pre_reservation_status(p_pre_reservation_id)` — atualiza `availability_status`, `pre_reserved_quantity`, `conflict_reason` de cada item e `risk_level` da reserva, retorna JSON com totais.
   - `get_inventory_pre_reservations_overview()` — KPIs.
   - `get_inventory_item_pre_reservation_summary(...)` — ocupação por item para colunas das listas.
6. **Extensão de `products`** (spec literal): `inventory_control_mode` (`none|direct_quantity_item|direct_serialized_item|category_family_demand`), `default_inventory_item_type`, `default_serialized_item_id`, `default_quantity_item_id`, `default_inventory_category_id`, `default_inventory_family_id`, `inventory_quantity_multiplier numeric default 1`. Constraints + check `products_inventory_control_mode_check`.
7. **Status real do item NÃO é alterado** nesta sprint.

### Serviços (`src/services/operations/`)

- `inventoryPreReservations.ts` — `listPreReservations(filters)`, `getPreReservation(id)`, `createPreReservation(payload, items)`, `updatePreReservation`, `cancelPreReservation`, `recalculatePreReservation` (chama RPC), `checkAvailabilityForPeriod`, `getPreReservationsOverview`, `getItemPreReservationSummary`.
- `inventoryProposalBridge.ts` — `generatePreReservationFromProposal({ proposalId, eventStart, eventEnd })`: lê `proposals` + `proposal_items` + `products`, calcula período operacional (−1/+1 dia), monta itens conforme `inventory_control_mode` (none → ignora; direct_* → vincula item; `category_family_demand` → cria item com `inventory_item_type='sku'`, `category_id`/`family_id` setados, sem alocação real — placeholder para Sprint 1.0), insere reserva + itens, dispara `recalculatePreReservation`.

### Hooks (`src/hooks/operations/`)

- `useInventoryPreReservations.ts` expondo: `useInventoryPreReservations`, `useInventoryPreReservation`, `useCreate/Update/Cancel/RecalculateInventoryPreReservation`, `useInventoryPreReservationsOverview`, `useInventoryItemPreReservationSummary`. React Query, invalida `['inventory','pre-reservations']`, `['inventory','overview']` e a key do item afetado.

### Validações (`src/lib/operations/`)

- `inventoryPreReservations.ts` com `inventoryPreReservationSchema` e `inventoryPreReservationItemSchema` exatamente como na spec, e helper `computeOperationalPeriod(eventStart, eventEnd, { padDaysBefore=1, padDaysAfter=1 })`.

### UI — Inventário

- `src/pages/operations/Inventory.tsx`: nova subtab **Reservas** com sub-abas internas:
  - **Pré reservas** (completa) → `InventoryPreReservationsTab.tsx`
  - **Calendário de ocupação** → placeholder elegante (`InventoryReservationsCalendarPlaceholder.tsx`) com mensagem "será implementado na próxima sprint".
- `InventoryPreReservationsTab.tsx`: 5 KPI cards (Ativas / Itens / Conflitos / Críticas / Próxima operação), filtros (status, risco, período, busca), tabela com Código, Título, Cliente, Período, Status, Risco, #Itens, #Conflitos, Ações (Ver, Recalcular, Cancelar).
- `InventoryPreReservationDetailDialog.tsx`: cabeçalho (código, proposta/oportunidade/cliente, período operacional, evento, status, risco, notas) + tabela de itens (Item, Tipo, Categoria, Família, Solicitado, Pré-reservado, Status, Motivo) + ações (Recalcular, Cancelar, Abrir proposta).
- `InventoryPreReservationFormDialog.tsx`: criação/edição manual (sem proposta).
- `InventoryOverviewTab.tsx`: novo bloco **Pré reservas operacionais** (mesmos 5 KPIs + lista "Próximas pré reservas") + alertas (conflitos, reservas com itens indisponíveis, alta ocupação por categoria — derivada client-side da resposta dos KPIs).
- `InventorySerializedItemsTab.tsx` e `InventoryQuantityItemsTab.tsx`: nova coluna **Pré reservado** (consultando `getItemPreReservationSummary` em batch via hook) — formato "Sim/Não/Parcial · até dd/MM" para serializados; "X de Y pré reservados" para quantidade.

### UI — Proposta (CRM)

- Novo componente `ProposalInventoryPanel.tsx` montado na tela de detalhe da proposta (admin/owner/comercial via guard de role já existente). Estados:
  - **Sem pré reserva** → botão "Gerar pré reserva de inventário" → abre `GeneratePreReservationDialog` (campos: data início/fim do evento com default `close_date_prevista`, observações). Ao confirmar, chama `generatePreReservationFromProposal`.
  - **Ativa** → mostra código, período, risco, conflitos + ações (Ver no Inventário, Recalcular, Cancelar).
  - **Com conflito** → variante destrutiva, botões (Ver conflitos, Recalcular).

### Detalhes técnicos sensíveis

- Toda RLS usa helpers reais (`user_can_access_inventory` / `user_is_org_admin`).
- RPCs usam `security definer` + `set search_path = public` (regra de segurança do projeto).
- Status físico do item **não muda**; ocupação é puramente cálculo via `inventory_pre_reservation_items` × período.
- `pre_reserved_quantity` é alimentado pelo RPC de recálculo, nunca pelo cliente diretamente.
- Cancelamento = `update status='cancelled'` (sem delete) → libera disponibilidade no próximo recálculo.
- `inventoryProposalBridge` é fire-and-recalculate: cria reserva + itens, depois `recalculatePreReservation` em transação client-side (chamadas sequenciais; se recalc falhar, reserva permanece com `risk_level='low'` default e UI permite recálculo manual).
- `category_family_demand` nesta sprint → cria item com `inventory_item_type='sku'`, sem alocar item real; UI mostra "demanda não alocada" e `availability_status='no_stock_control'`.
- Cache React Query: invalidações cruzadas entre `['inventory','pre-reservations']`, `['inventory','overview']` e `['inventory','items']`.
- Multi-tenant: trigger `validate_pre_reservation_item_org` garante isolamento; toda criação no client passa `organization_id` do contexto atual (igual outros services do módulo).

### Critérios de aceite (cobertos)

Banco, RLS, criação manual e via proposta, período operacional ±1, checagem por período, conflito serializado, parcial em quantidade, status físico intacto, KPIs na Visão Geral, aba Reservas, detalhe com itens/conflitos, painel na proposta, recalcular, cancelar, "sem controle de estoque" tratado, typecheck/build, sem regressão das sprints 0.5–0.8.

### Fora de escopo (mantido)

Calendário de ocupação real (placeholder), reserva definitiva, alocação real de `category_family_demand`, edge functions, automação de expiração por cron (deixar `expired` apenas via recálculo manual ou ação futura).
