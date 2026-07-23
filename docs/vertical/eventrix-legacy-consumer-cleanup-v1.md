# Eventrix Legacy Consumer Cleanup — VERT-01.2E-A

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.2E-A`
**Decisão:** `VERT-01.2E-A VALIDATED — LEGACY EVENTRIX BOUNDARIES CLEAN`

## 1. Contexto
Após `VERT-01.2D COMPLETE` (Proposal Inventory Demand desacoplado) e
`VERT-01.2E-0 VALIDATED` (dual-write canônico consistente), Eventrix está
formalmente classificado como `OPTIONAL_INTEGRATION`. Esta sub-sprint
executa uma limpeza controlada de: (a) copy legado; (b) dead code sem
consumers; (c) reclassificação de itens erroneamente listados como
hardcode arquitetural.

## 2. Consumer inventory (busca real via rg)
| Símbolo | Consumers ativos | Classificação |
|---|---|---|
| `useEventrixInventoryCache` | Nenhum | UNUSED_DEPRECATED |
| `EventrixSyncCacheItem` | Nenhum | UNUSED_DEPRECATED |
| `useEventrixInventorySettings` | `EventrixInventorySettings.tsx` | ACTIVE_PROVIDER_SPECIFIC |
| `useUpsertEventrixInventorySettings` | `EventrixInventorySettings.tsx` + tests | ACTIVE_PROVIDER_SPECIFIC |
| `useTestEventrixInventoryConnection` | `EventrixInventorySettings.tsx` | ACTIVE_PROVIDER_SPECIFIC |
| `useTriggerEventrixInventorySync` | `EventrixInventorySettings.tsx` | ACTIVE_PROVIDER_SPECIFIC |
| `eventrixInventorySettingsSchema` | `useEventrixInventory.ts` + panel | ACTIVE_PROVIDER_SPECIFIC |
| `/app/settings/eventrix-inventory` | Redirect em `App.tsx` | LEGACY_COMPATIBILITY |

## 3. Product BOM
`ProductBOMEditor` consome apenas `inventory_categories`, `inventory_families`
e `product_bom_items` via IDs genéricos (`inventory_category_id`,
`inventory_family_id`). Nenhum import de Eventrix settings, cache ou API.

## 4. Por que Product BOM já é provider-neutral
- Serviços: `services/operations/inventoryCategories.ts` e
  `inventoryFamilies.ts` (genéricos).
- Tabela: `product_bom_items` (colunas genéricas).
- Contrato: `ProductBomItem`/`ProductBomItemInput` sem sufixo Eventrix.

## 5. Hardcode textual removido
`ProductBOMEditor.tsx:85` substituído por linguagem genérica; removida a
promessa não-garantida de "consultar disponibilidade, ocupação e reservas
no inventário operacional" — agora condicionada ao provider ativo.

## 6. Eventrix provider boundary
Confinado a:
- `src/inventory/providers/EventrixInventoryProvider.ts`
- `src/pages/settings/EventrixInventorySettings.tsx` (+ panel)
- `src/hooks/settings/useEventrixInventory.ts`
- `src/schemas/eventrixInventorySettings.ts`

## 7. Código provider-specific legítimo
Não renomeado. Regra: Core abstrai via `InventoryProviderAdapter` +
`useInventoryProvider`; integração Eventrix mantém nomenclatura própria.

## 8. Consumers Core encontrados
Nenhum vazamento de Eventrix hooks/schema para camadas Core.

## 9/10. Dead code
- Removido: `useEventrixInventoryCache`, `EventrixSyncCacheItem` em
  `src/hooks/products/useProductInventoryRequirements.ts`.
- Preservado: tabela `eventrix_inventory_sync_cache` (backing store do
  provider Eventrix); hooks Eventrix legítimos; adapter.

## 11. Rota legacy
`/app/settings/eventrix-inventory` permanece como redirect em `App.tsx`.
Nenhum link interno novo aponta para ela. Preservada por bookmarks.

## 12–15. Hardcode register
- HC-003 → `RESOLVED` (copy limpa; storage já genérico).
- HC-008 → `RECLASSIFIED_PROVIDER_SPECIFIC`.
- HC-010 → `RECLASSIFIED_PROVIDER_SPECIFIC`.
- HC-015 → `PENDING_GENERIC_FACADE` (colunas físicas intactas).

## 16. Residuais
- `product_inventory_requirements` mantém colunas `eventrix_*` físicas.
- `ProductInventoryRequirementsEditor` continua lendo essas colunas.
- Snapshots v2 mantêm aliases `eventrix_*` sob `provider_type='eventrix'`.

## 17. Adiado para E-B
Façade genérica de `product_inventory_requirements` (contrato Core
`category_ref/name`, `family_ref/name`, `item_kind`, `provider_type`) +
mapper storage↔domain, sem migration física obrigatória.

## 18. Testes
Sem novos testes obrigatórios. Suítes existentes cobrem:
- Inventory Provider resolver (5+8) e providers (7).
- Eventrix canonical sync (VERT-01.2E-0).
- Proposal Inventory Demand engine (36) + snapshots.

## 19. Rollback
Exclusivamente código/docs:
1. Restaurar copy anterior de `ProductBOMEditor.tsx`.
2. Restaurar `useEventrixInventoryCache`/`EventrixSyncCacheItem`.
3. Reverter CSV.
Nenhuma alteração de banco a desfazer.

## 20. Próxima sprint
`VERT-01.2E-B — GENERIC PRODUCT INVENTORY REQUIREMENT FACADE`.
