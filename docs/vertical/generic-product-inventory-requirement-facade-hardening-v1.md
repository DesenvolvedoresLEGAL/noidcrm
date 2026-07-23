# Generic Product Inventory Requirement Facade — Safety Hardening (VERT-01.2E-B1.1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.2E-B1.1`
**Decisão:** `VERT-01.2E-B1.1 VALIDATED — GENERIC REQUIREMENT FACADE SAFE TO ACTIVATE`

## 1. Revisão B1
A foundation (B1) já expõe `InventoryProductRequirement` genérico, hook
dedicado e storage mapper que confina as colunas `eventrix_*`. Antes de
ativar a façade no editor (E-B2), uma revisão detectou três riscos.

## 2. Bug de metadata encontrado
`useUpdateInventoryProductRequirement` só carregava metadata existente
quando `input.metadata !== undefined && input.provider_type === undefined`.

## 3. Causa
O mapper `mapInventoryRequirementUpdateToStorage` também recompõe metadata
quando `input.provider_type` é enviado. Um submit vindo do formulário da
E-B2 traz `provider_type` sempre, o que faria o mapper reescrever
`metadata` sem conhecer as chaves persistidas.

## 4. Correção
`shouldReadExistingMetadata = input.metadata !== undefined || input.provider_type !== undefined`.
Quando verdadeiro, o hook lê `metadata` filtrando por `id + organization_id + product_id`
e repassa ao mapper.

## 5. Regra de merge
`{ ...existing, ...incoming, [inventory_provider_type]: provider }`. Chaves
desconhecidas de origens legadas permanecem intactas.

## 6. Metadata ausente
Chave `inventory_provider_type` inexistente = registro histórico legítimo.
Interpretação canônica: `eventrix`.

## 7. Metadata inválida
Chave presente com valor fora de `eventrix|native` = corrupção. Sempre lança
`InventoryRequirementMetadataError`. Nunca reinterpreta como Eventrix.

## 8. `InventoryRequirementMetadataError`
Definida em `src/inventory/requirements/types.ts` desde B1; agora efetivamente
lançada pelo parser em `storageMapper.readProviderFromMetadata`.

## 9. UnitBasis canônico
Novo módulo neutro `src/inventory/requirements/unitBasis.ts` exporta
`UNIT_BASIS_VALUES`, `UnitBasis`, `UNIT_BASIS_LABELS`. Valores idênticos
aos legados; nenhum comportamento novo.

## 10. Dependency inversion
`inventory/requirements/{types,schema,storageMapper}.ts` agora importam
UnitBasis do módulo canônico. Zero import de
`@/schemas/productInventoryRequirement` dentro de `src/inventory/requirements/`.

## 11. Legacy schema bridge
`src/schemas/productInventoryRequirement.ts` reexporta
`UNIT_BASIS_VALUES`, `UNIT_BASIS_LABELS`, `UnitBasis` a partir da fonte
canônica. Contrato legado (`eventrix_*`, `ProductInventoryRequirementInput`,
mensagens de validação) preservado — editor legado segue compilando sem
alterações.

## 12. Testes do mapper
Casos adicionados/atualizados: metadata `{}` → eventrix; metadata com
`inventory_provider_type` desconhecido/`number`/`boolean`/`object`/`array`
→ erro tipado; update com `provider_type` preserva `foo`/`custom`.

## 13. Testes do hook
`src/inventory/hooks/__tests__/useInventoryProductRequirements.test.tsx`
com Supabase mockado cobre: escopo tenant em query, mapping storage→domain,
create com scope correto, rejeição de provider Native antes do write,
ausência de read extra em update simples, leitura de metadata em update
com `metadata` parcial, leitura + preservação em update com `provider_type`,
deactivate como UPDATE `is_active=false` (nunca DELETE) tenant-scoped.

## 14. Regressão
Editor legado, Proposal Inventory Demand, snapshots, Product BOM,
Eventrix provider/settings, Inventory Provider Settings intocados.
Suítes B1 + B1.1 verdes.

## 15. Banco intocado
Zero migration, zero SQL, zero mudança em RLS/policies/triggers/RPCs/edge
functions. Colunas `eventrix_*` preservadas.

## 16. Riscos residuais
- HC-015 (colunas físicas) permanece aberto até E-B2/E-B3 reencapsularem.
- Duplicação de contrato (legado + genérico) segue até editor migrar.

## 17. Readiness E-B2
Façade genérica agora é segura para consumo runtime: metadata nunca é
sobrescrita, provider inválido explode cedo, UnitBasis vive fora do schema
deprecated. `VERT-01.2E-B2 — ACTIVATE GENERIC PRODUCT INVENTORY REQUIREMENT FACADE`
liberado.
