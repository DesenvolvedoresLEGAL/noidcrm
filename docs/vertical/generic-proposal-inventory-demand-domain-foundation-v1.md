# Generic Proposal Inventory Demand — Domain Foundation (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.2D-A`
**Status:** `VERT-01.2D-A VALIDATED WITH LEGACY REQUIREMENT NORMALIZER`
**Escopo:** apenas fundação de tipos + normalizer + capability. Sem migração de builder, snapshot, componentes, hooks ou persistência.

---

## 1. Pre-flight (Fase A)

Decisão: `VERT-01.2D PREFLIGHT READY`.

Consumidores atuais do domínio legado (mapeados por grep):

- `src/lib/proposals/inventoryDemandPreview.ts` — builder + tipos com `eventrix_*`.
- `src/lib/proposals/inventoryDemandSnapshot.ts` — summary, source_requirements, compare, hash.
- `src/hooks/proposals/useProposalInventoryDemandPreview.ts` — build inline por proposta.
- `src/hooks/proposals/useProposalInventoryDemandSnapshots.ts` — persistência v1.
- `src/components/proposals/ProposalInventoryDemandPreview.tsx` — UI preview.
- `src/components/proposals/ProposalInventoryDemandSnapshotDetails.tsx` — UI detalhes.
- `src/pages/ProposalEditor.tsx` — orquestração.
- `src/components/products/ProductInventoryRequirementsEditor.tsx` — editor (já usa adapter).
- `src/hooks/products/useProductInventoryRequirements.ts` + `src/schemas/productInventoryRequirement.ts` — colunas físicas `eventrix_*` (fora de escopo permanente da 01.2D).
- `src/pages/settings/NoidInventoryBackupPage.tsx` — leitor tabular apenas.

Verificações adicionais:

- `rg` em `supabase/functions/**` por `eventrix_category_id|eventrix_family_id|proposal_inventory_demand_snapshots` retornou vazio — nenhuma Edge Function consome payload de snapshot diretamente.
- Nenhum export ou PDF externo lê chaves `eventrix_*` dos snapshots.
- Contrato de `proposal_inventory_demand_snapshots` é JSONB livre (`summary`, `payload`, `lines`, `warnings`, `commercial_context`, `source_products`, `source_requirements`, `hash`) — schema v2 caberá sem migration.

Nenhum item de parada obrigatória foi atingido.

## 2. Problema anterior (recapitulação)

O runtime de Proposal Inventory Demand carrega nomes `eventrix_*` até a UI, o
snapshot e o hash. Isso impede que um novo provider (ou o Native) declare
suporte a `proposal_demand` sem duplicar tipos e cálculos.

## 3. Domínio genérico criado (Fase B)

Nova pasta:

```
src/inventory/demand/
  types.ts
  normalizeRequirement.ts
  index.ts
  __tests__/foundation.test.ts
```

Sem qualquer identificador Eventrix nos tipos exportados.

## 4. Tipos genéricos

- `InventoryRequirementReference` — provider-agnostic (`provider_type`, `category_ref`, `category_name`, `family_ref`, `family_name`, `item_kind`, `metadata?`).
- `NormalizedProductInventoryRequirement` — referência + `requirement_id`, `product_id`, `label`, `quantity`, `unit_basis`, `is_required`, `notes`, `sort_order`, `is_active`.
- `InventoryDemandLineSource` — contribuição de um produto para uma linha.
- `InventoryDemandLine` — linha agrupada, `status: 'calculated' | 'manual' | 'incomplete'`.
- `InventoryDemandCommercialContext` — `points | days | participants`.
- `InventoryDemandEventContext`, `InventoryDemandRequirementPayload`.
- `InventoryDemandPayload` (`schema_version: 2`).
- `InventoryDemandPreview` — status `ready | empty | incomplete | unsupported`.
- `InventoryDemandNormalizationError` — erro tipado (`missing_category`, `missing_family`, `invalid_quantity`, `invalid_unit_basis`, `missing_product`).

Nenhum dos tipos expõe: `eventrix_*`, IMEI, ICCID, SSID, WiFi, tokens, URLs de integração, tabelas de cache.

## 5. Fronteira de normalização (Fase C)

`normalizeProductInventoryRequirement(req, { providerType = 'eventrix', strict = true })`:

Mapeamento confinado exclusivamente aqui:

| Legado (coluna física)        | Genérico                          |
| ----------------------------- | --------------------------------- |
| `eventrix_category_id`        | `category_ref`                    |
| `eventrix_category_name`      | `category_name`                   |
| `eventrix_family_id`          | `family_ref`                      |
| `eventrix_family_name`        | `family_name`                     |
| `eventrix_item_kind`          | `item_kind`                       |
| (implícito)                   | `provider_type = 'eventrix'`      |

`normalizeProductInventoryRequirements(reqs)` faz batch defensivo, retornando `{ normalized, skipped }` para diagnóstico sem quebrar a UI. Este é o único ponto autorizado do código a ler `eventrix_*` de `product_inventory_requirements` no domínio genérico.

## 6. Capability (Fase D)

**Eventrix (`EventrixInventoryProvider`)** — capabilities passam a ser:

`categories`, `families`, `product_requirements`, `proposal_demand`.

Justificativa: o cálculo atual não faz chamada externa adicional; apenas usa
`quantity` × contexto comercial × referências já persistidas. Nenhuma URL
Eventrix, token ou tabela de cache adicional foi introduzida no adapter.

**Native (`NativeInventoryProvider`)** — capabilities permanecem `[]`. Não
declara `proposal_demand`, `availability`, `reservations`, `items` ou
`product_requirements`. Comportamento de "unsupported" da UI/builder será
implementado na D-B.

Nenhum método comercial (`per_point`, `per_event`, `per_day`, `per_participant`,
`per_unit`, `manual`) foi movido para o adapter — permanece futuro do domínio
genérico.

## 7. Comportamento Eventrix

Inalterado funcionalmente. Nenhum hook, componente, snapshot, hash ou
persistência muda nesta fase. A única mudança observável é o retorno de
`getCapabilities()` no adapter, usado hoje apenas pela Inventory Provider
Settings UI (VERT-01.2C).

## 8. Comportamento Native

Inalterado. `hasCapability('proposal_demand')` continua `false`; consumidores
da D-B terão a base para retornar `status: 'unsupported'` sem inventar demanda.

## 9. Testes novos (Fase N — subset D-A)

Arquivo: `src/inventory/demand/__tests__/foundation.test.ts` (10 casos).

1. Requisito Eventrix legado é normalizado para referência genérica.
2. Category id/nome preservados.
3. Family id/nome preservados.
4. `item_kind` preservado (inclui `null`).
5. `provider_type` default é `eventrix`.
6. Normalizer não cria IMEI/ICCID/SSID/WiFi (assert por regex no JSON).
7. Requisito inválido retorna `null` em `strict=false` / lança `InventoryDemandNormalizationError` em strict / lote captura em `skipped`.
8. Eventrix declara `proposal_demand`.
9. Native não declara `proposal_demand` (nem qualquer outra).
10. Objeto normalizado não expõe nenhuma chave `eventrix_*`.

Regressão: testes VERT-01.2A/B/C (adapters, registry, resolver, provider settings) permanecem verdes — o único diff funcional é a lista de capabilities do Eventrix, coberta por adaptação positiva do teste 8 e verificação inversa do teste 9.

## 10. Arquivos alterados

Novos:

- `src/inventory/demand/types.ts`
- `src/inventory/demand/normalizeRequirement.ts`
- `src/inventory/demand/index.ts`
- `src/inventory/demand/__tests__/foundation.test.ts`
- `docs/vertical/generic-proposal-inventory-demand-domain-foundation-v1.md`

Modificado (mínimo):

- `src/inventory/providers/EventrixInventoryProvider.ts` — adiciona `'proposal_demand'` a `CAPS` + comentário `NOID-VERTICAL-1.0-VERT-01.2D-A`.

Nenhuma alteração em: builder, hooks, componentes, snapshot, hash, persistência, migrations, RLS, policies, Edge Functions, Storage, Auth, Product BOM, Provider Settings UI.

## 11. Itens adiados explicitamente para D-B

- Builder genérico `buildInventoryDemandPreview`.
- Migração de `src/lib/proposals/inventoryDemandPreview.ts` para delegar.
- Snapshot format v2 + aliases legados Eventrix.
- Reader de snapshot v1/v2 (`normalizeInventoryDemandSnapshot`).
- Comparação/hash migrados para o domínio genérico.
- Migração de `buildSourceRequirements` para chaves genéricas.

## 12. Itens adiados explicitamente para D-C

- Migração de `ProposalInventoryDemandPreview.tsx` e `ProposalInventoryDemandSnapshotDetails.tsx`.
- Persistência via hook — envio do payload v2.
- Estado `unsupported` na UI.
- Testes de componente (35–44).
- Atualização final de `docs/vertical/inventory-provider-adapter-architecture-v1.md`, `docs/vertical/noid-eventrix-dependency-map-v1.md`, `docs/vertical/legal-hardcodes-register-v1.csv` (HC-011/HC-012).

## 13. Legal hardcodes register

Nesta fase, HC-011/HC-012 permanecem `PARTIALLY_DECOUPLED`. Marca-se
internamente apenas `DOMAIN_FOUNDATION_CREATED` (ver seção do próprio CSV a
ser atualizada na D-C).

## 14. Rollback

Rollback exclusivamente de código:

1. Excluir `src/inventory/demand/`.
2. Reverter `src/inventory/providers/EventrixInventoryProvider.ts` para
   `CAPS = ['categories', 'families', 'product_requirements']`.
3. Excluir `docs/vertical/generic-proposal-inventory-demand-domain-foundation-v1.md`.

Nenhuma reversão de banco, RLS, snapshot histórico ou Product BOM é necessária.

## 15. Riscos residuais

- Nenhum consumidor legado é afetado — o builder atual permanece inalterado.
- A única mudança observável para outros módulos é a Inventory Provider
  Settings UI (VERT-01.2C), que passará a exibir `proposal_demand` como
  capability do Eventrix. Esse é o efeito desejado.

## 16. Recomendação para VERT-01.2D-B

Iniciar migração do builder para o domínio genérico + serializer v2 + reader
v1/v2 + hash equivalente, mantendo `buildProposalInventoryDemandPreview` como
alias deprecated durante a transição. Componentes e persistência somente na
VERT-01.2D-C.
