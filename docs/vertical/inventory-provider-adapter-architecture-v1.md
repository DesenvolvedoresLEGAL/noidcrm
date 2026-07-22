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

## 7. Regra transitória de resolução

```
if (eventrix_inventory_integration_settings.is_enabled === true)  → eventrix
else                                                               → native
```

- Falha ao consultar settings → fallback `native` com status `available` e detail do erro.
- Eventrix ativo com `status='error'` → adapter Eventrix é escolhido mas retorna status `error` normalizado.
- Nenhum organization_id, slug, domínio, nome ou UUID da LEGAL é hardcoded.
- A regra definitiva (tabela `inventory_provider_settings` própria) fica para VERT-01.2B.

## 8. Compatibilidade legada

- `useEventrixInventoryCache` marcado como `@deprecated`, ainda exportado.
- Tabela `eventrix_inventory_integration_settings` intocada.
- Tabela `eventrix_inventory_sync_cache` intocada.
- Rota `/app/settings/eventrix-inventory` preservada.
- Colunas `eventrix_category_id/name/family_id/name/item_kind` de
  `product_inventory_requirements` intocadas. O payload persiste o mesmo,
  apenas a origem dos IDs vem via adapter.

## 9. Consumidores migrados

- `src/components/products/ProductInventoryRequirementsEditor.tsx`

## 10. Consumidores ainda legados

- `src/hooks/settings/useEventrixInventory.ts` (tela de configuração).
- `src/pages/settings/EventrixInventorySettings.tsx` (configuração canônica).
- `src/components/proposals/ProposalInventoryDemand*.tsx` (snapshot/preview).
- `src/lib/proposals/inventoryDemand*.ts`.
- `src/services/operations/inventory*.ts` (BOM Editor, etc).

Estes permanecem para preservar compatibilidade da LEGAL e serão avaliados
individualmente em VERT-01.2B.

## 11. Comportamento da LEGAL

- Continua com Eventrix ativo (settings `is_enabled=true`).
- Editor mostra "Provider ativo: Eventrix".
- Categorias/famílias carregam da mesma tabela cache.
- Cadastro/edição/desativação de composição idênticos.

## 12. Comportamento de tenant sem Eventrix

- Provider resolvido: `native`.
- Editor mostra card informativo "Provider de inventário nativo ativo",
  sem mensagem de erro pedindo integração Eventrix.
- Botão "Nova composição" fica oculto (capacidade `product_requirements` ausente).
- Cadastro de produto (não relacionado a inventário) continua funcionando.

## 13. Testes

- `__tests__/registry.test.ts` — 5 casos.
- `__tests__/resolver.test.ts` — 5 casos.
- `__tests__/providers.test.ts` — 7 casos (native + eventrix normalization).

## 14. Riscos

- Consumidores de proposal demand ainda acoplados ao Eventrix.
- Rota canônica ainda tem "eventrix" no path (intencionalmente preservada).
- Native provider ainda não oferece capacidades reais — quando o Pack
  Conectividade existir, o native poderá receber sua própria fonte.

## 15. Próxima sprint (VERT-01.2B)

1. Criar tabela `inventory_provider_settings` (organization-scoped).
2. Migrar consumidores de Proposal Inventory Demand.
3. Introduzir alias de rota `/app/settings/inventory-provider`.
4. Deprecar oficialmente `useEventrixInventoryCache`.
5. Iniciar planejamento do Pack Conectividade (equipment profile).

## 16. Rollback

Rollback exclusivamente de código:

1. `git revert` do commit da sprint.
2. Nenhuma alteração de banco a desfazer.
3. Rota, tabelas e configurações legadas permanecem intactas.
