# Generic Product Inventory Requirement Facade — Foundation (VERT-01.2E-B1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.2E-B1`
**Decisão:** `VERT-01.2E-B1 VALIDATED WITH LEGACY STORAGE BRIDGE`

## 1. Contexto
Após E-A, o inventário está desacoplado do Eventrix exceto por um resíduo
estrutural: `product_inventory_requirements` ainda usa colunas físicas
`eventrix_*`, expostas como contrato público pelo hook/schema atuais.

## 2. Problema
Core, schema e hook ainda vazam `eventrix_category_id`, `eventrix_family_id`,
etc. como contrato, apesar de o runtime de Proposal Demand já operar
genericamente via normalizer.

## 3. Storage legado (intocado)
Colunas físicas permanecem: `eventrix_category_id`, `eventrix_category_name`,
`eventrix_family_id`, `eventrix_family_name`, `eventrix_item_kind`,
`metadata jsonb`. Nenhuma migration nesta sprint.

## 4. Façade
```
CORE / UI / HOOK
        ↓
Generic Product Inventory Requirement Domain (src/inventory/requirements)
        ↓
Legacy Storage Mapper
        ↓
product_inventory_requirements  →  eventrix_* physical columns
```

## 5. Domínio genérico
`src/inventory/requirements/types.ts` — `InventoryProductRequirement`,
`InventoryProductRequirementInput`, `INVENTORY_PROVIDER_METADATA_KEY`,
`InventoryRequirementProviderNotSupportedError`. Zero `eventrix_*`.

## 6. Schema genérico
`src/inventory/requirements/schema.ts` — `inventoryProductRequirementSchema`
com `category_ref`, `family_ref`, `provider_type`. Reutiliza
`UNIT_BASIS_VALUES` do schema legado.

## 7. Storage → domain
`mapProductInventoryRequirementFromStorage`:
- `eventrix_category_id → category_ref`
- `eventrix_category_name → category_name`
- `eventrix_family_id → family_ref`
- `eventrix_family_name → family_name`
- `eventrix_item_kind → item_kind`

## 8. Domain → storage
`mapInventoryRequirementCreateToStorage` e
`mapInventoryRequirementUpdateToStorage` fazem a rota inversa,
sempre mesclando metadata (nunca substituindo).

## 9. Provider metadata
Chave: `metadata.inventory_provider_type` (constante
`INVENTORY_PROVIDER_METADATA_KEY`).

## 10. Fallback histórico Eventrix
Registros sem metadata (ou com valor inválido) → `provider_type = 'eventrix'`.
Nunca inferir Native de histórico. Não consultar settings atuais para
interpretar dados antigos.

## 11. Provider unsupported
Write com `provider_type` diferente de `eventrix` lança
`InventoryRequirementProviderNotSupportedError`. Native/desconhecido nunca
são gravados nas colunas `eventrix_*`.

## 12. Hook genérico
`src/inventory/hooks/useInventoryProductRequirements.ts` — query + create +
update + deactivate. Nunca expõe `eventrix_*`. Ainda não conectado à UI.

## 13. Tenant scoping
Todas as queries filtram por `organization_id` e `product_id` (defesa em
profundidade sobre a RLS). UPDATE/DEACTIVATE incluem o mesmo escopo no
WHERE.

## 14. Create / Update / Deactivate
- Create: mapper → INSERT → domain.
- Update parcial: se input traz `metadata` sem `provider_type`, o hook lê
  metadata atual e mescla; caso contrário aplica merge direto.
- Deactivate: apenas `is_active=false`. Sem DELETE.

## 15. Legacy hook / schema
`src/hooks/products/useProductInventoryRequirements.ts` e
`src/schemas/productInventoryRequirement.ts` preservados intactos
funcionalmente, apenas com JSDoc `@deprecated` apontando para os novos.

## 16. Runtime não migrado
`ProductInventoryRequirementsEditor`, `RequirementDialog`, Proposal Demand,
snapshots, Product BOM e Eventrix adapter permanecem intocados.

## 17. Testes
`src/inventory/requirements/__tests__/storageMapper.test.ts` — 23 casos
verdes cobrindo storage→domain (fallback histórico, metadata explícita,
metadata inválida, imutabilidade, ausência de chaves `eventrix_*`),
domain→storage create/update (merge de metadata, rejeição de provider
não suportado, imutabilidade) e schema (validação de campos, ausência de
chaves `eventrix_*`).

## 18. Riscos
- Duplicação temporária de contrato (legado + genérico) até E-B2 migrar UI.
- Update com metadata parcial exige extra read; documentado.
- HC-015 permanece pendente até colunas físicas serem reencapsuladas.

## 19. Rollback
Somente código: remover `src/inventory/requirements/**`, remover novo hook
genérico, remover comentários `@deprecated`. Banco intocado.

## 20. Próxima sprint
`VERT-01.2E-B2 — ACTIVATE GENERIC PRODUCT INVENTORY REQUIREMENT FACADE`:
migrar editor/dialog para o hook genérico; converter hook/schema legados
em bridges reais; reavaliar HC-015 (colunas físicas + snapshots).
