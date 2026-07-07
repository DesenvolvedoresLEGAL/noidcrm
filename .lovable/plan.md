# Sprint NOID-INV-CONNECT 0.2 — Configuração & Cache Eventrix

## Objetivo
Preparar o NOID para conexão futura com o Eventrix, sem chamada real. Adicionar duas tabelas, UI de configuração/teste/sync mockado e cache local read-only.

---

## 1. Migration (primeiro, precisa aprovação e regenera types)

Tabelas em `public`:

**`eventrix_inventory_integration_settings`** — 1 linha por organization
- `organization_id` (UNIQUE)
- `environment` ('sandbox'|'production', default 'sandbox')
- `base_url`, `api_key_secret_name` (só referência, nunca token real)
- `status` ('not_configured'|'configured'|'connected'|'error'|'disabled')
- `last_connection_check_at`, `last_connection_status`, `last_connection_message`
- `last_sync_at`, `last_sync_status`, `last_sync_message`
- `is_enabled` boolean default false
- `created_by`, `updated_by`, `created_at`, `updated_at`
- Trigger `update_updated_at_column`

**`eventrix_inventory_sync_cache`**
- `organization_id`, `eventrix_entity_id`, `entity_type` ('category'|'family')
- `name`, `description`, `parent_eventrix_entity_id`, `control_mode`, `item_kind`
- `is_active`, `payload` jsonb, `synced_at`
- UNIQUE `(organization_id, entity_type, eventrix_entity_id)`
- Índices por org, tipo, parent

**RLS + GRANT**:
- GRANT SELECT/INSERT/UPDATE ao `authenticated` (sem DELETE — soft only)
- GRANT ALL ao `service_role`
- Policies: leitura para membros da organização; write só owner/admin/operations (via `has_role`/organization_members). commercial_manager/sales_manager: read-only.
- Sem DELETE policy → previne remoção.

## 2. Zod schema
`src/schemas/eventrixInventorySettings.ts` com o schema do brief.

## 3. Hooks TanStack
`src/hooks/settings/useEventrixInventory.ts`:
- `useEventrixInventorySettings()` — maybeSingle por org
- `useUpsertEventrixInventorySettings()` — upsert por organization_id
- `useTestEventrixInventoryConnection()` — atualiza status local, nenhum fetch externo
- `useEventrixInventorySyncCache(entityType)`
- `useTriggerEventrixInventorySync()` — só marca last_sync_* pending

Invalidação após cada mutation.

## 4. UI — atualizar `EventrixInventorySettings.tsx`
Nova ordem:
1. Header (mantém)
2. Card **Configuração da conexão** (form: ambiente/URL/token-ref/switch/Salvar)
3. Card **Teste de conexão** (botão)
4. Card **Status da integração** (badge + último teste/msg/sync)
5. Card **Sincronização de categorias e famílias** (botão)
6. Card **Cache local do Eventrix** (Tabs: Categorias/Famílias, estados vazios)
7. Card **Próximas etapas**
8. Blocos informativos anteriores (responsabilidades, dados consumidos, composição, fator demanda, fluxo, endpoints)

Read-only para commercial_manager/sales_manager (form desabilitado).

## 5. Não fazer
Sem edge function, sem chamada externa, sem token em texto claro, sem service_role no client, sem mudanças em produtos/proposta/tabela dinâmica.

## 6. Verificação
- Migration aprovada
- `tsgo` limpo
- Página abre, salva, testa conexão, sync mockado, cache vazio renderiza estado vazio
- Seller/SDR: AccessDenied (já existe na página)

## Arquivos
- Migration (via tool)
- `src/schemas/eventrixInventorySettings.ts` (novo)
- `src/hooks/settings/useEventrixInventory.ts` (novo)
- `src/pages/settings/EventrixInventorySettings.tsx` (expandir)
