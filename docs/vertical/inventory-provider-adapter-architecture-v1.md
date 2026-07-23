# Inventory Provider Adapter — Arquitetura v1

Sprint: `NOID-VERTICAL-1.0-VERT-01.2A`
Data: 2026-07-22
Escopo: camada de compatibilidade sem migration, sem alteração de banco, sem publish.

## 1. Contexto

O NOID historicamente consome inventário diretamente do Eventrix nos módulos
Products, Inventory e Proposal Inventory Demand. A auditoria VERT-01.1
classificou o Eventrix como `OPTIONAL_INTEGRATION` e proibiu dependência
obrigatória no Core.

## 2. Problema anterior

- Editor de produto importava `useEventrixInventoryCache` e consultava
  `eventrix_inventory_integration_settings` diretamente.
- Componentes conheciam colunas `eventrix_entity_id`, `parent_eventrix_entity_id`.
- Tenants sem Eventrix recebiam mensagem de erro "Configure Eventrix".

## 3. Arquitetura nova

```text
Products / Proposals
        ↓
useInventoryProvider (hook genérico)
        ↓
resolveInventoryProvider  ──► InventoryProviderRegistry
                                    ├── NativeInventoryProvider
                                    └── EventrixInventoryProvider
```

Arquivos:

- `src/inventory/providers/types.ts` — tipos genéricos normalizados.
- `src/inventory/providers/InventoryProviderAdapter.ts` — contrato.
- `src/inventory/providers/NativeInventoryProvider.ts` — fallback seguro.
- `src/inventory/providers/EventrixInventoryProvider.ts` — encapsula Eventrix.
- `src/inventory/providers/InventoryProviderRegistry.ts` — registry singleton, default `native`.
- `src/inventory/providers/resolveInventoryProvider.ts` — resolver transitório.
- `src/inventory/hooks/useInventoryProvider.ts` — hooks React.

## 4. Contrato

Métodos: `getType`, `getDisplayName`, `getCapabilities`, `hasCapability`,
`getStatus`, `listCategories`, `listFamilies`, `listItems`, `getItem`,
`checkAvailability`, `validateProductRequirements`.

Capacidades declaráveis: `categories`, `families`, `items`, `availability`,
`reservations`, `kits`, `serialized_items`, `quantity_items`,
`product_requirements`, `proposal_demand`.

Status normalizados: `available | not_configured | unavailable | degraded | unauthorized | error`.

## 5. Providers

| Provider  | Capacidades declaradas                              | Fonte                                                    |
| --------- | --------------------------------------------------- | -------------------------------------------------------- |
| native    | (vazio)                                             | nenhuma. Não presume disponibilidade.                    |
| eventrix  | `categories`, `families`, `product_requirements`    | `eventrix_inventory_sync_cache` + settings.              |

O native NUNCA declara `availability` ou `items` — evita inventário fictício.

## 6. Registry

- Singleton com `native` + `eventrix` registrados.
- `getDefault()` retorna sempre `native`.
- `get(type)` retorna `null` para tipos desconhecidos (não cai silenciosamente para Eventrix).
- Registro duplicado lança erro.

## 7. Regra de resolução (atualizada em VERT-01.2B)

Precedência oficial:

```
1. inventory_provider_settings (canonical, tenant-aware)  → source=canonical_provider_settings
2. eventrix_inventory_integration_settings.is_enabled=true → source=legacy_eventrix_settings  (fallback transitório)
3. Native default                                          → source=native_default
```

Dual-write: ativar/desativar Eventrix pela UI legada sincroniza a row canônica automaticamente (`selection_source='legacy_eventrix_settings'`).

- `provider_type` canônico desconhecido → native com status `error` (nunca cai silenciosamente para Eventrix).
- Falha ao consultar canonical + legado ativo → usa legado durante a janela de transição.
- Nenhum organization_id, slug, domínio, nome ou UUID da LEGAL é hardcoded.
- Detalhes completos em `inventory-provider-settings-foundation-v1.md`.


## 8. Compatibilidade legada

- `useEventrixInventoryCache` marcado como `@deprecated`, ainda exportado.
- Tabela `eventrix_inventory_integration_settings` intocada.
- Tabela `eventrix_inventory_sync_cache` intocada.
- Rota `/app/settings/eventrix-inventory` preservada.
- Colunas `eventrix_category_id/name/family_id/name/item_kind` de
  `product_inventory_requirements` intocadas. O payload persiste o mesmo,
  apenas a origem dos IDs vem via adapter.

## 9. Consumidores migrados

- `src/components/products/ProductInventoryRequirementsEditor.tsx` (VERT-01.2A).
- `src/hooks/proposals/useProposalInventoryDemandPreview.ts` (VERT-01.2D-C).
- `src/components/proposals/ProposalInventoryDemandPreview.tsx` (VERT-01.2D-C).
- `src/components/proposals/ProposalInventoryDemandSnapshotDetails.tsx`
  (VERT-01.2D-C — via compatibility reader).

## 10. Consumidores ainda legados

- `src/hooks/settings/useEventrixInventory.ts` (tela de configuração).
- `src/pages/settings/EventrixInventorySettings.tsx` (configuração canônica,
  encapsulada como painel provider-specific).
- `src/lib/proposals/inventoryDemand*.ts` — bridges `@deprecated` mantidos
  apenas para consumidores não migrados; delegam ao domínio genérico.
- `src/services/operations/inventory*.ts` (BOM Editor, etc).
- `src/hooks/products/useProductInventoryRequirements.ts` (Product BOM lê
  colunas físicas `eventrix_*`).

Estes permanecem para preservar compatibilidade da LEGAL e serão avaliados
em VERT-01.2E.

## 11. Comportamento da LEGAL

- Continua com Eventrix ativo (settings `is_enabled=true`).
- Editor mostra "Provider ativo: Eventrix".
- Categorias/famílias carregam da mesma tabela cache.
- Cadastro/edição/desativação de composição idênticos.
- Proposal Inventory Demand roda pelo domínio genérico; requisitos Eventrix
  são normalizados na fronteira.

## 12. Comportamento de tenant sem Eventrix

- Provider resolvido: `native`.
- Editor de produto mostra card informativo "Provider de inventário nativo
  ativo", sem mensagem de erro pedindo integração Eventrix.
- Botão "Nova composição" fica oculto (capacidade `product_requirements`
  ausente).
- Proposal Inventory Demand retorna `status='unsupported'` (capability
  `proposal_demand` ausente) sem consultar requisitos.
- Cadastro de produto (não relacionado a inventário) continua funcionando.

## 13. Testes

- `__tests__/registry.test.ts` — 5 casos.
- `__tests__/resolver.test.ts` — 5 casos.
- `__tests__/resolver-canonical.test.ts` — 8 casos.
- `__tests__/providers.test.ts` — 7 casos (native + eventrix normalization).
- `demand/__tests__/foundation.test.ts` — 12 casos.
- `demand/__tests__/engine.test.ts` — 36 casos.
- Settings page smoke — 2 casos.
- Total: 91/91 verdes.

## 14. Capabilities declaradas

| Provider  | Capabilities                                                                | Fonte                                          |
| --------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| native    | (vazio)                                                                     | nenhuma; nunca presume disponibilidade         |
| eventrix  | `categories`, `families`, `product_requirements`, **`proposal_demand`**     | `eventrix_inventory_sync_cache` + settings     |

`proposal_demand` (declarada na VERT-01.2D-A e efetivamente consumida na
VERT-01.2D-C) é a capability que habilita o Proposal Inventory Demand
genérico. Native não a declara e a UI de proposta apresenta estado
`unsupported`.

## 15. Riscos

- Rota canônica ainda tem "eventrix" no path (intencionalmente preservada).
- Native provider ainda não oferece capacidades reais — quando o Pack
  Conectividade existir, o native poderá receber sua própria fonte.
- Colunas físicas `eventrix_*` em `product_inventory_requirements` continuam
  como fonte legada; a normalização vive apenas na fronteira.
- Product BOM ainda acoplado ao provider Eventrix; snapshots históricos
  continuam legíveis independentemente do provider ativo, mas o cadastro
  de requisitos ainda depende do provider legado.

## 16. Próxima sprint (VERT-01.2E)

1. Desacoplar Product BOM do provider Eventrix.
2. Reavaliar remoção dos aliases `eventrix_*` do snapshot v2 após
   revalidação dos snapshots históricos.
3. Iniciar Pack Conectividade (equipment profile) como fonte nativa.
4. Avaliar depreciação real de `useEventrixInventoryCache` e do painel
   provider-specific.

## 17. Rollback

Rollback exclusivamente de código:

1. `git revert` do commit da sprint.
2. Nenhuma alteração de banco a desfazer.
3. Rota, tabelas e configurações legadas permanecem intactas.
