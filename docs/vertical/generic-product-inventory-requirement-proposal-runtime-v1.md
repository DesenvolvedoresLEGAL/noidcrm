# VERT-01.2E-B2B — Generic Requirements activated in Proposal Inventory Demand

- Change ID: `NOID-VERTICAL-1.0-VERT-01.2E-B2B`
- Classificação: YELLOW controlada
- Decisão: `VERT-01.2E-B2B VALIDATED WITH LEGACY STORAGE BRIDGE`
- Fechamento formal: `VERT-01.2E COMPLETE — EVENTRIX CORE COUPLING REMOVED WITH LEGACY STORAGE BRIDGE`

## 1. Contexto

Após `VERT-01.2E-B2A`, o `ProductInventoryRequirementsEditor` já operava
sobre a façade genérica. O único `ACTIVE_CORE_CONSUMER` remanescente do
contrato físico `eventrix_*` era `useProposalInventoryDemandPreview`, que
consultava `product_inventory_requirements` diretamente e alimentava o
normalizer legado. Esta sprint fecha esse último acoplamento.

## 2. Pre-flight

Buscas estáticas confirmaram, antes de qualquer edição:

- `ProductInventoryRequirementsEditor` não é mais ACTIVE_CORE_CONSUMER.
- `useProposalInventoryDemandPreview.ts` era o consumer ativo esperado.
- Consumers legados restantes:
  - `src/lib/proposals/inventoryDemandPreview.ts` — bridge `@deprecated`.
  - `src/lib/proposals/inventoryDemandSnapshot.ts` — bridge `@deprecated`.
  - `src/inventory/demand/__tests__/foundation.test.ts` e `engine.test.ts`
    (TEST_COMPATIBILITY: exercem o bridge legado).
- Baseline typecheck limpo; 117/117 testes dentro do escopo (inventário,
  proposals demand, editor) verdes. Falhas pré-existentes em
  `useTeamVisibility`/`useSupabaseAuth` são baseline não relacionado.

## 3. Último ACTIVE_CORE_CONSUMER

`src/hooks/proposals/useProposalInventoryDemandPreview.ts`
(query direta + tipo `ProductInventoryRequirement` legado).

## 4. Generic repository

Criado `src/inventory/requirements/repository.ts`:

- `listInventoryProductRequirements({organizationId, productId?, productIds?, activeOnly?})`.
- Sempre exige `organizationId`.
- `productIds` deduplicados e ordenados; `productId` único também suportado.
- `activeOnly` filtra `is_active = true`.
- Nunca chama `.in()` com array vazio (retorna `[]`).
- Storage → domínio via `mapProductInventoryRequirementFromStorage`.
- ZERO React. Reutilizável por hooks e futuras camadas.

Reexport em `src/inventory/requirements/index.ts`.

## 5. Bulk query hook

Criado `useInventoryProductRequirementsForProducts({organizationId, productIds, activeOnly, enabled})`
em `src/inventory/hooks/useInventoryProductRequirements.ts`. Query key
provider-neutral: `['inventory-product-requirements-bulk', orgId, activeOnly, sortedIdsCsv]`.
`enabled` só quando organização + productIds > 0 + caller habilitado. Não
executa quando lista de produtos é vazia.

O hook single-product `useInventoryProductRequirements` foi refatorado
para reutilizar o mesmo repository — `ONE STORAGE READ BOUNDARY`.

## 6. Storage mapper

`src/inventory/requirements/storageMapper.ts` permanece a única fronteira
física autorizada a ler/escrever colunas `eventrix_*`. Nenhuma nova
fronteira foi criada.

## 7. Generic normalizer

`src/inventory/demand/normalizeRequirement.ts` foi reescrito para
receber `InventoryProductRequirement` (domínio genérico). Nunca lê
`eventrix_*`. Nomes públicos:

- `normalizeInventoryProductRequirement`
- `normalizeInventoryProductRequirements`

Regras defensivas preservadas: `missing_category`, `missing_family`,
`missing_product`, `invalid_quantity`, `invalid_unit_basis`.

## 8. Provider semantics

- `provider_type` do resultado vem SEMPRE do requirement de entrada.
- `expectedProviderType` (opcional) apenas VALIDAÇÃO; nunca sobrescreve.
- Divergência produz novo diagnóstico `provider_mismatch`
  (`InventoryDemandNormalizationError.code`), incluído em `skipped` pelo
  collection normalizer.

## 9. UnitBasis desacoplado

`src/inventory/demand/types.ts` e `buildInventoryDemandPreview.ts` agora
importam `UnitBasis` de `@/inventory/requirements/unitBasis`. Nenhum
arquivo de `src/inventory/demand/**` depende mais de
`@/schemas/productInventoryRequirement`.

## 10. Legacy normalizer bridge

Criado `src/inventory/demand/legacyRequirementCompatibility.ts` — bridge
que aceita `LegacyProductInventoryRequirementStorageRow`, delega ao
`storageMapper` (única fronteira física) e chama o normalizer genérico.
Preserva aliases `normalizeProductInventoryRequirement` e
`normalizeProductInventoryRequirements` para testes/consumers históricos.
Sem duplicar mapeamento nem validação.

## 11. Proposal Demand — fluxo novo

```
useProposalInventoryDemandPreview
  → useInventoryProvider (canonical)
  → useInventoryProductRequirementsForProducts (bulk generic)
       → listInventoryProductRequirements
       → storageMapper (única fronteira física)
  → filter provider_type === activeProviderType
  → normalizeInventoryProductRequirements
  → buildInventoryDemandPreview (INTOCADO)
```

Contrato público alterado:
`productRequirements: InventoryProductRequirement[]` (antes:
`ProductInventoryRequirement[]` legado).

## 12. Eventrix

Rows legadas sem `metadata.inventory_provider_type` continuam sendo
lidas como `provider_type='eventrix'` (fallback histórico do mapper).
Cálculos comerciais (per_point / per_event / per_day / per_participant /
per_unit / manual / totals / warnings / grouping / hash / compare)
permanecem semanticamente idênticos.

## 13. Native

Native segue sem `product_requirements` e sem `proposal_demand`. Bulk
query não é executada; preview permanece `unsupported`. Nenhuma
referência Eventrix é carregada ou reinterpretada.

## 14. Provider mismatch

Requirements de provider diferente do ativo são filtrados ANTES da
normalização — semântica clara, nunca convertidos. O diagnóstico
`provider_mismatch` fica disponível para futuros consumers que optarem
por normalizar com `expectedProviderType`.

## 15. Metadata inválida

`metadata.inventory_provider_type` presente com valor inválido continua
propagando `InventoryRequirementMetadataError`. A bulk query NÃO
silencia — o erro chega ao React Query e é exposto no `error` do hook
`useProposalInventoryDemandPreview`.

## 16. Calculation parity

`buildInventoryDemandPreview` NÃO foi alterado. Testes de regra de
cálculo (`src/inventory/demand/__tests__/engine.test.ts`) permanecem
verdes sem alteração.

## 17. Legacy hook / legacy schema

- `src/hooks/products/useProductInventoryRequirements.ts` — cabeçalho
  atualizado para `LEGACY STORAGE BRIDGE — ZERO ACTIVE CORE CONSUMERS`.
  Preservado por compatibilidade enquanto colunas físicas existirem.
- `src/schemas/productInventoryRequirement.ts` — cabeçalho atualizado
  refletindo B2B; editor e Proposal Demand já migrados. Novos consumers
  proibidos.

## 18. Static scans

- `src/hooks/proposals/useProposalInventoryDemandPreview.ts`: zero
  ocorrências de `eventrix_*`, `ProductInventoryRequirement` legado ou
  `supabase.from('product_inventory_requirements')`.
- `src/inventory/demand/normalizeRequirement.ts`: zero `eventrix_*`.
- `src/inventory/demand/types.ts` e `buildInventoryDemandPreview.ts`:
  não importam mais `@/schemas/productInventoryRequirement`.
- `src/inventory/requirements/storageMapper.ts` permanece a única
  fronteira física autorizada.

## 19. Tests

Todos os testes de `src/inventory/**`, `src/hooks/proposals/**` e
`src/components/products/**` passam (117/117). Os testes históricos
`foundation.test.ts` / `engine.test.ts` exercem agora o bridge legado
sem alteração de código de teste, garantindo compatibilidade.

## 20. Regressão

- Typecheck (`tsgo --noEmit`): limpo.
- Suíte completa: 350/354 passing; 4 falhas em
  `useTeamVisibility`/`useSupabaseAuth` são baseline pré-existente
  (mock de `supabase.auth`), fora do escopo desta sprint.

## 21. Banco intocado

Nenhuma migration, RLS, policy, trigger, RPC ou Edge Function foi
alterada. Colunas físicas `eventrix_*` permanecem.

## 22. Residual physical storage

`product_inventory_requirements` continua fisicamente com
`eventrix_category_id/name`, `eventrix_family_id/name`,
`eventrix_item_kind`. Confinados ao `storageMapper`.

## 23. Residual snapshot aliases

`src/inventory/demand/snapshotSerializer.ts` e `snapshotCompatibility.ts`
mantêm aliases `eventrix_*` na representação v2 por compatibilidade
histórica dos snapshots persistidos. Fora do escopo desta sprint.

## 24. Rollback

Exclusivamente de código:

1. Restaurar query Supabase direta em
   `useProposalInventoryDemandPreview.ts`.
2. Restaurar normalizer legado como implementação principal.
3. Manter façade B1/B1.1/B2A intacta.
4. Banco não é tocado; nenhum DELETE.

## 25. HC-015

Status atualizado em `docs/vertical/legal-hardcodes-register-v1.csv`
para `FUNCTIONALLY_DECOUPLED_LEGACY_STORAGE`.

Evidence:
- Editor genérico (B2A).
- Proposal Demand genérico (B2B).
- Bulk repository + storageMapper como única fronteira física.
- Colunas físicas permanecem apenas por compatibilidade — dívida de
  storage, não acoplamento de Core.

Physical migration NÃO foi realizada.

## 26. Fechamento VERT-01.2E

`VERT-01.2E COMPLETE — EVENTRIX CORE COUPLING REMOVED WITH LEGACY STORAGE BRIDGE`.

- Eventrix não está mais embutido no Core.
- Eventrix é `OPTIONAL_INTEGRATION`.
- Product BOM, Product Requirements editor, Proposal Demand e provider
  settings Core são genéricos.
- Configurações Eventrix-specific permanecem confinadas como
  provider-specific legítimas.
- Colunas físicas `eventrix_*` permanecem como dívida de storage.
- Snapshot aliases permanecem por compatibilidade histórica.

## 27. Próxima sprint

Recomendação: `VERT-01.3 — CONNECTIVITY PACK EXTRACTION` (HC-006 / HC-007).
Não iniciar automaticamente.
