## Problema

A página **Backup Inventário NOID** hoje exporta apenas dados **comerciais** ligados a inventário (produtos, requisitos, snapshots de propostas). Ela **não expõe** o inventário físico real de equipamentos — que é onde estão os 264 equipamentos cadastrados com serial number, IMEI, marca, modelo, família, categoria, localização e status operacional.

## O que existe no banco (confirmado)

| Tabela | Registros | Conteúdo |
|---|---|---|
| `inventory_items` | **264** | Equipamentos: nome, serial_number, brand, model, item_kind, status, quantidades operacionais, `metadata.router` (IMEI, SSID, senhas) |
| `inventory_families` | 9 | Famílias de equipamento |
| `inventory_categories` | 2 | Categorias |
| `inventory_locations` | 1 | Locais/depósitos |
| `inventory_movements` | ? | Histórico de movimentações |
| `inventory_status_history` | ? | Histórico de status |
| `inventory_reservations` + `inventory_reservation_items` + `inventory_reservation_allocations` | ? | Reservas |
| `inventory_pre_reservations` + itens/allocations | ? | Pré-reservas |
| `inventory_pricing_rules` | ? | Regras de preço |
| `inventory_operation_events` | ? | Eventos operacionais |

Sobre **ICCID**: não existe coluna dedicada. Nos itens atuais (roteadores Intelbras GX3000) o campo equivalente é o **IMEI**, que está em `metadata.router.imei`. Se você usa ICCID para chips SIM, ele estaria também em `metadata` — será incluído automaticamente porque o export leva a coluna `metadata` inteira.

## Plano de mudança

**Escopo:** só a página `src/pages/settings/NoidInventoryBackupPage.tsx`. Read-only, sem migração, sem edge function.

1. **Reordenar e expandir a lista `TARGET_TABLES`** dando prioridade ao inventário físico:

   Essenciais (inventário de equipamentos):
   - `inventory_items` — Equipamentos (serial, IMEI, marca, modelo, status)
   - `inventory_families` — Famílias
   - `inventory_categories` — Categorias
   - `inventory_locations` — Locais
   - `inventory_movements` — Movimentações
   - `inventory_status_history` — Histórico de status

   Apoio (operação/reservas):
   - `inventory_reservations`, `inventory_reservation_items`, `inventory_reservation_allocations`
   - `inventory_pre_reservations`, `inventory_pre_reservation_items`, `inventory_pre_reservation_allocations`
   - `inventory_pricing_rules`
   - `inventory_operation_events`

   Contexto (mantidos, mas rebaixados):
   - `products`, `product_inventory_requirements`, `proposal_inventory_demand_snapshots`, `proposals`, `proposal_items`, `eventrix_inventory_integration_settings`, `eventrix_inventory_sync_cache`
   - Remover `tenants` (não existe neste projeto — hoje mostra "Não encontrada").

2. **Flatten do `metadata` no CSV de `inventory_items`**: gerar colunas derivadas `metadata_router_imei`, `metadata_router_ssid_factory`, `metadata_router_admin_user`, `metadata_router_admin_password`, `metadata_router_wifi_password_factory` para o CSV abrir direto no Excel com IMEI visível em coluna própria. O JSON continua com `metadata` completo (não perde nada). Aplicar só a essa tabela; demais mantêm o comportamento atual.

3. **Atualizar o resumo de migração** ("Resumo para futura migração Eventrix") para mostrar totais de equipamento físico: total de itens, por status (available/reserved/in_operation/maintenance/damaged/lost), famílias distintas em uso, categorias distintas em uso.

4. **Ajustar o texto do topo** para deixar claro que agora exporta **inventário de equipamentos + dados comerciais correlatos**, e que os dados são read-only.

5. **Backup Completo (JSON)** passa a incluir todas as novas tabelas automaticamente (já itera sobre `TARGET_TABLES`).

## Fora de escopo

- Nenhuma alteração de schema, RLS, edge function ou fluxo de escrita.
- Sem PDF (não faz sentido para bater dado-a-dado com outro sistema).
- Não mexer no menu/rota — a página continua em `/app/settings/noid-inventory-backup`.

## Resultado esperado

Ao entrar na página você verá cards para `inventory_items` (264), `inventory_families` (9), `inventory_categories` (2), `inventory_locations` (1) e demais tabelas operacionais, cada uma com **Exportar CSV** (com IMEI/serial em colunas) e **Exportar JSON**, além do **Backup Completo (JSON)** consolidando tudo.
