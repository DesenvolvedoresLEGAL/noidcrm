## Sprint INV 0.2 — Schema base do Inventário

Cria a fundação de banco do módulo Inventário (5 tabelas + 4 enums + RLS + triggers). Sem CRUD, sem UI nova, sem reservas/kits/chips/tabela dinâmica.

### 1. Enums (criar)

- `inventory_item_kind`: `serialized`, `quantity`
- `inventory_item_status`: `available`, `blocked`, `maintenance`, `damaged`, `retired`, `lost`
- `inventory_location_type`: `internal`, `external`, `maintenance`, `event`, `technician`, `lost`, `retired`, `other`
- `inventory_movement_type`: `initial_entry`, `manual_adjustment`, `location_change`, `status_change`, `maintenance_entry`, `maintenance_exit`, `damage_report`, `loss_report`, `retirement`, `release`

### 2. Tabelas (todas com `organization_id NOT NULL` + RLS)

1. **`inventory_categories`** — name, description, item_kind (default `serialized`), is_active, sort_order, created_by/updated_by, timestamps. Unique `(organization_id, lower(name))`.
2. **`inventory_locations`** — name, description, location_type (default `internal`), is_active, sort_order, created_by/updated_by, timestamps. Unique `(organization_id, lower(name))`.
3. **`inventory_items`** — category_id, location_id, item_kind, status (default `available`), name, description, asset_code, serial_number, brand, model, unit_of_measure (default `'un'`), quantity_total/available/minimum, acquisition_date/cost, notes, metadata jsonb, created_by/updated_by, timestamps.
   - **Check constraints:**
     - `quantity_total >= 0 AND quantity_available >= 0 AND quantity_available <= quantity_total`
     - `(item_kind='serialized' AND quantity_total=1 AND quantity_available IN (0,1)) OR (item_kind='quantity')`
   - **Unique parciais por org:** `lower(asset_code)` quando preenchido; `lower(serial_number)` quando preenchido.
4. **`inventory_movements`** — item_id (FK SET NULL), movement_type, quantity, from/to_location_id, from/to_status, reason, notes, related_entity_type/id, metadata jsonb, created_by, created_at. Sem updated_at.
5. **`inventory_status_history`** — item_id (FK CASCADE), from_status, to_status, reason, metadata jsonb, created_by, created_at. Sem updated_at.

Índices conforme spec (org, category, location, status, kind, created_at desc, related_entity).

### 3. RLS — usar helpers existentes

Já existem: `get_user_organization_id()`, `user_is_org_admin(org_id)`, `user_is_org_member(org_id)`. Sem helpers novos.

Função nova mínima e segura para checar acesso ao módulo:

```sql
CREATE FUNCTION public.user_can_access_inventory(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND status = 'active'
      AND deleted_at IS NULL
      AND org_role IN ('owner','admin','operations')
  );
$$;
```

**Policies em todas as 5 tabelas:**
- `SELECT` / `INSERT` / `UPDATE`: `user_can_access_inventory(organization_id)`.
- **Sem `DELETE` policy** (delete físico bloqueado nesta sprint; soft delete via `is_active=false` ou status `retired`/`lost`).
- Comercial/SDR/finance/cs/manager/viewer ficam fora automaticamente.

### 4. Triggers

- `update_updated_at_column` (já existe) em `inventory_categories`, `inventory_locations`, `inventory_items`.
- **`trg_inventory_items_status_history`** — `AFTER UPDATE OF status` em `inventory_items`: se `OLD.status IS DISTINCT FROM NEW.status`, insere em `inventory_status_history` (org, item, from/to status, `auth.uid()` como created_by).
- **`trg_inventory_items_initial_entry`** — `AFTER INSERT` em `inventory_items`: insere `inventory_movements` com `movement_type='initial_entry'`, `quantity=quantity_total`, `to_location_id=location_id`, `to_status=status`, `reason='Cadastro inicial do item'`, `created_by=auth.uid()`. Lógica simples e idempotente por linha nova.

### 5. Frontend

Nenhuma alteração funcional. Opcional: pequeno texto discreto no rodapé do card de empty state em `src/pages/operations/Inventory.tsx`: "Schema base preparado para categorias, locais, itens, movimentações e histórico." — única edição de UI permitida pela sprint.

### Entrega

- 1 migration SQL única com enums + tabelas + índices + RLS + triggers.
- 1 edição mínima em `Inventory.tsx` (texto técnico discreto).
- Sem CRUD, sem types manuais (regen automático), sem edge functions, sem mexer em proposta/preço/reservas/chips/kits.

### Riscos

- Baixo. Tabelas novas, isoladas. RLS restritiva por padrão (só owner/admin/operations leem ou escrevem).
- Trigger de `initial_entry` cria 1 row em `inventory_movements` por item — comportamento desejado.
