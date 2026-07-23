# Generic Product Inventory Requirement Editor — Runtime Activation (VERT-01.2E-B2A)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.2E-B2A`
**Decisão:** `VERT-01.2E-B2A VALIDATED WITH LEGACY STORAGE`

## 1. Contexto
Após B1/B1.1, a façade genérica de Product Inventory Requirements estava
homologada mas não conectada ao runtime. O editor de produto continuava
importando o schema legado (`@/schemas/productInventoryRequirement`), o hook
legado (`@/hooks/products/useProductInventoryRequirements`) e trabalhava
diretamente com chaves físicas `eventrix_*` no formulário.

## 2. Pre-flight
- Leitura integral do editor, hooks genéricos, storage mapper, schema, tipos
  e provider adapter.
- Baseline B1.1 (117 testes) verde, typecheck limpo.
- Nenhuma migration/RLS/RPC/edge function necessária.
- Decisão: `VERT-01.2E-B2A PREFLIGHT READY`.

## 3. Arquitetura anterior
```
Editor
  ↓ schema legado (eventrix_*)
  ↓ hook legado (eventrix_*)
  → product_inventory_requirements (colunas eventrix_*)
```

## 4. Arquitetura nova
```
ProductInventoryRequirementsEditor
  ↓ InventoryProductRequirement / Input
  ↓ inventoryProductRequirementSchema
  ↓ useInventoryProductRequirements (scope {organizationId, productId})
  ↓ storageMapper
  → product_inventory_requirements (colunas eventrix_* preservadas)
```

Editor não conhece mais `eventrix_*`. O binding legado está confinado ao
storage mapper (VERT-01.2E-B1/B1.1).

## 5. Generic hook ativado
- `useInventoryProductRequirements({ organizationId, productId })` — leitura.
- `useCreateInventoryProductRequirement(scope)` — create.
- `useUpdateInventoryProductRequirement(scope)` — update com preservação de
  metadata (VERT-01.2E-B1.1).
- `useDeactivateInventoryProductRequirement(scope)` — soft delete.

Nenhuma query/mutation Supabase criada no componente.

## 6. Generic schema ativado
`inventoryProductRequirementSchema` (`@/inventory/requirements`). Campos:
`label`, `provider_type`, `category_ref`, `category_name`, `family_ref`,
`family_name`, `item_kind`, `quantity`, `unit_basis`, `is_required`, `notes`,
`sort_order`, `is_active`, `metadata`. UnitBasis e ITEM_KIND_LABELS agora
canônicos em `src/inventory/requirements/unitBasis.ts` (schema legado apenas
re-exporta).

## 7. Provider resolution
- `useInventoryProvider(organizationId)` retorna `providerType`, `provider`,
  `status`, `providerName`.
- `providerSupportsRequirements = provider.hasCapability('product_requirements')`.
- Criação só habilita quando: provider carregado, `providerType` presente,
  capability declarada, integração não `not_configured`/`unavailable`, cache
  de categorias não vazio.
- Nenhum `providerType === 'eventrix'` como regra de negócio.

## 8. Create
- `provider_type` = `providerType` resolvido (nunca hardcoded).
- Payload = `InventoryProductRequirementInput` puro. Storage/metadata é
  responsabilidade exclusiva do mapper.
- Bloqueado sem provider ou sem capability.

## 9. Edit
- `provider_type` vem de `initial.provider_type`, nunca reinterpretado.
- Botão de edição desabilitado (tooltip explicativo) quando
  `initial.provider_type !== providerType` — row segue visível, histórico
  preservado, nenhuma conversão automática.

## 10. Deactivate
- Mutation genérica `useDeactivateInventoryProductRequirement`.
- Semântica preservada: `is_active=false`, toast, sem DELETE, histórico
  intacto.

## 11. Metadata
- Nunca montada no componente.
- Preservação garantida pelo hook (read-then-merge de B1.1).

## 12. Provider mismatch
- Row de outro provider aparece normalmente na listagem.
- Edição bloqueada; deactivate ainda permitido (não destrói dados).
- Nenhuma migração automática de provider durante edição.

## 13. Native
- Nenhuma criação de composição.
- Card informativo indicando que composição depende de integração externa.
- Não promete `product_requirements` no Native.

## 14. Eventrix
- Continua o único provider com capability `product_requirements`.
- Fluxo funcional preservado.

## 15. Copy
- Removida promessa universal de "disponibilidade, ocupação e reservas".
- Nova copy: "cálculo de demanda e poderá alimentar recursos de
  disponibilidade e operação quando suportados pelo provider ativo".

## 16. Error states
- `useInventoryProductRequirements` pode falhar quando
  `InventoryRequirementMetadataError` é lançada pelo mapper (metadata
  corrompida). Editor exibe card destrutivo controlado:
  "Não foi possível carregar a composição de inventário deste produto."
- Nenhum fallback silencioso; row nunca é apagada; metadata nunca é
  reinterpretada como Eventrix.

## 17. Links de configuração
- Rota canônica `/app/settings/inventory-provider`.
- Quando `providerType` presente, query param `?provider=${providerType}`
  (não mais hardcoded `eventrix`).

## 18. Static decoupling
```
rg -n "eventrix_(category_id|category_name|family_id|family_name|item_kind)" \
  src/components/products/ProductInventoryRequirementsEditor.tsx
→ 0
rg -n "productInventoryRequirementSchema|ProductInventoryRequirementInput|useProductInventoryRequirements|useCreateProductInventoryRequirement|useUpdateProductInventoryRequirement|useDeactivateProductInventoryRequirement|from '@/schemas/productInventoryRequirement'|from '@/hooks/products/useProductInventoryRequirements'" \
  src/components/products/ProductInventoryRequirementsEditor.tsx
→ 0 (apenas o nome genérico InventoryProductRequirementInput permanece)
```

## 19. Testes novos
`src/components/products/__tests__/ProductInventoryRequirementsEditor.test.tsx`
(8 casos), hooks mockados, sem Supabase real:
1. Scope `{organizationId, productId}` propagado ao hook genérico.
2. Rows renderizadas com `category_name`/`family_name`/`item_kind`.
3. Native oculta botão "Nova composição".
4. Eventrix configurado habilita o botão.
5. Provider mismatch desabilita edição.
6. Deactivate chama mutation genérica com id correto.
7. Erro de leitura exibe card destrutivo controlado.
8. Output renderizado não contém string `eventrix_`.

## 20. Regressão
- 125/125 testes verdes (inventory requirements, provider, demand engine,
  canonical sync, editor). Baseline B1.1 (117) mantido + 8 novos.
- Typecheck (`tsgo --noEmit`) limpo.
- Nenhuma regressão em Proposal Demand / Product BOM / Settings.

## 21. Banco intocado
Nenhuma migration, RLS, policy, RPC, trigger, edge function, Supabase
generated type ou coluna alterada.

## 22. Rollback
Somente código:
1. Restaurar imports legacy no editor.
2. Restaurar RequirementDialog legacy com chaves `eventrix_*`.
3. Restaurar mutations legacy.
4. Façade B1/B1.1 permanece intacta.

## 23. Residual — Proposal Demand
`useProposalInventoryDemandPreview` e o demand normalizer ativo permanecem
intocados nesta sprint (regressão isolada). Serão migrados em E-B2B.

## 24. Legacy hook/schema preservados
`src/hooks/products/useProductInventoryRequirements.ts` e
`src/schemas/productInventoryRequirement.ts` seguem disponíveis como
bridges (o schema legado agora apenas re-exporta ITEM_KIND_LABELS do módulo
canônico). Auditoria completa e retirada ficam para E-B2B.

## 25. HC-015
Evoluído de `FACADE_FOUNDATION_READY` → `GENERIC_EDITOR_ACTIVE_LEGACY_STORAGE`
no registro `docs/vertical/legal-hardcodes-register-v1.csv`. Não marcado
como RESOLVED — colunas físicas `eventrix_*`, Proposal Demand legacy e
bridges permanecem.

## 26. Publish
Nenhum publish executado.

## 27. Riscos residuais
- Colunas físicas `eventrix_*` ainda presentes no schema.
- Proposal Demand runtime continua consumindo storage legado.
- Legacy hook/schema ainda existem como bridges.
- Nenhuma bulk query genérica ainda para multiproduct demand.

## 28. Próxima sprint
`VERT-01.2E-B2B — ACTIVATE GENERIC REQUIREMENTS IN PROPOSAL DEMAND + RETIRE
ACTIVE LEGACY BRIDGES`. Não iniciar automaticamente.
