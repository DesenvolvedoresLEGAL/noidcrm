# Generic Proposal Inventory Demand Engine — v1 (VERT-01.2D-B)

Change ID: `NOID-VERTICAL-1.0-VERT-01.2D-B`
Decisão: `VERT-01.2D-B VALIDATED WITH LEGACY BUILDER BRIDGE`

## Baseline
- D-A regressão: `foundation.test.ts` 12/12 (`describe` 1..12, sendo 7b/7c sub-casos).
- Reconciliação: documento D-A anterior citava “10 casos”; contagem real de `it/test` é 12. Corrigido no doc D-A.
- Regressão VERT-01.2A/B/C: 25/25 (registry 5, providers 7, resolver 5, resolver-canonical 8) + Settings page 2 → **75 verdes ao todo**.
- Typecheck (`tsgo --noEmit`): 0 erros.
- Tenant-isolation baseline: inalterado (nenhum novo arquivo do domínio toca banco/RLS).

## Arquivos alterados
- `src/inventory/demand/buildInventoryDemandPreview.ts` (novo)
- `src/inventory/demand/sources.ts` (novo)
- `src/inventory/demand/snapshotSerializer.ts` (novo)
- `src/inventory/demand/snapshotCompatibility.ts` (novo)
- `src/inventory/demand/compareInventoryDemand.ts` (novo)
- `src/inventory/demand/index.ts` (exports)
- `src/inventory/demand/__tests__/engine.test.ts` (novo, 36 testes)
- `src/lib/proposals/inventoryDemandPreview.ts` (bridge deprecated)
- `src/lib/proposals/inventoryDemandSnapshot.ts` (bridge deprecated)
- `docs/vertical/generic-proposal-inventory-demand-engine-v1.md` (este)
- `docs/vertical/generic-proposal-inventory-demand-domain-foundation-v1.md` (correção contagem)
- `docs/vertical/inventory-provider-adapter-architecture-v1.md` (nota `ENGINE_READY_NOT_CONNECTED`)

## Arquitetura do builder
`buildInventoryDemandPreview({ proposal, proposalItems, requirements, providerType, supportsProposalDemand })`:
- puro, determinístico, sem I/O;
- normaliza `requirements` previamente via `normalizeProductInventoryRequirement` (D-A);
- resolve `commercial_context` via `resolveInventoryDemandCommercialContext`
  (mesma prioridade do legado: pontos/dias explícitos → inferidos por `point_day` → datas);
- agrupa por chave técnica `provider_type|category_ref|family_ref|unit_basis|required_flag`;
- ordena `is_required desc, family_name asc, key asc`;
- filtra requisitos cujo `provider_type` diverge do provider ativo.

### Regras preservadas (equivalência determinística)
`per_point`, `per_event`, `per_day`, `per_participant`, `per_unit`, `manual` — cálculo,
labels, status calculated/manual/incomplete e warnings copiados ipsis literis do legado.

### Status
- `ready` — linhas calculáveis existem;
- `incomplete` — participantes ausentes em `per_participant`;
- `empty` — sem itens ou sem requisitos aplicáveis;
- `unsupported` — provider ativo não declara capability `proposal_demand`
  (Native retorna aqui; totals zerados, `lines: []`, warning legível).

### Compatibilidade legada (bridge)
`buildProposalInventoryDemandPreview` continua exportado; delega ao builder genérico
assumindo `providerType='eventrix'` + `supportsProposalDemand=true` e converte a
saída de volta para o shape antigo (`eventrix_*` na `line` e no `payload`). A
resolução real do provider ativo entra na D-C.

## Snapshot v2
- `INVENTORY_DEMAND_SCHEMA_VERSION = 2`
- `INVENTORY_DEMAND_ALGORITHM_VERSION = 'inventory-demand-v2'`
- `serializeInventoryDemandSnapshotV2` produz payload lógico com campos genéricos
  (`provider_type`, `category_ref`, `family_ref`, `item_kind`, …).
- Aliases Eventrix (`eventrix_category_id`, `eventrix_category_name`,
  `eventrix_family_id`, `eventrix_family_name`, `eventrix_item_kind`) são
  adicionados **apenas** quando `provider_type === 'eventrix'` e **apenas** no
  serializer — não vazam para o domínio, para o hash ou para a comparação.
- Native jamais recebe aliases Eventrix.

## Reader v1/v2
`normalizeInventoryDemandSnapshot(raw)`:
- v1 (sem `schema_version` ou apenas `eventrix_*`): mapeia
  `eventrix_category_id → category_ref`, `eventrix_family_id → family_ref` etc.
  e assume `provider_type='eventrix'`;
- v2: preserva `schema_version=2` e provider_type;
- híbrido: campos genéricos têm prioridade;
- malformado: retorna `{ valid:false, error_code:'malformed', lines:[], warnings:[…] }`;
- nunca lança; nunca escreve no banco.

## Compare + hash
- `normalizeInventoryDemandPreviewForCompare` e
  `normalizeInventoryDemandSnapshotForCompare` extraem apenas o significado
  comercial: `provider_type`, `commercial_context`, `requirements` ordenados por
  chave (`provider_type|category_ref|family_ref|unit_basis`).
- Ignoram: aliases Eventrix, `schema_version` isolada, `algorithm_version`,
  ordem de propriedades, timestamps, IDs de snapshot.
- `compareInventoryDemand(preview, snapshot)` retorna
  `no_snapshot | aligned | changed`.
- `computeInventoryDemandHash(preview)`: djb2 XOR estável — **não criptográfico**;
  serve apenas para detecção de mudança.

## Source products / source requirements
- `buildInventoryDemandSourceProducts`: preserva `product_id`, `product_name`,
  `proposal_item_id`, `quantity`.
- `buildInventoryDemandSourceRequirements`: matching genérico
  `provider_type|category_ref|family_ref|unit_basis`; requisitos legados
  entram normalizados; providers diferentes nunca casam.

## Testes novos (`engine.test.ts`)
36 casos cobrindo cálculo (1..23), snapshot v2 (24..33), reader v1/v2/híbrido/malformado
(34..39), compare + hash (41..55), source products/requirements (56..60) e o bridge
legado.

## Escopo intocado
Componentes (`ProposalInventoryDemandPreview.tsx`,
`ProposalInventoryDemandSnapshotDetails.tsx`, `ProposalEditor.tsx`), hooks
(`useProposalInventoryDemandPreview`, `useProposalInventoryDemandSnapshots`),
persistência, tabela `proposal_inventory_demand_snapshots`, RLS, RPCs,
Edge Functions, Product BOM, `ProductInventoryRequirementsEditor`,
Inventory Provider Settings UI, colunas físicas `eventrix_*`, snapshots
históricos, Forecast, Revenue Command, Revenue SSoT, OTE, Auth, Storage,
secrets, Event Core, Pack Engine, Pack Conectividade — **nada alterado**.
Nenhum publish.

## Riscos residuais
- Wrapper legado hardcoda `provider_type='eventrix'` até a D-C ligar o resolver
  ao hook de preview — comportamento observável não muda.
- Aliases Eventrix ainda presentes no snapshot v2 (por design, temporários);
  removíveis quando 100% dos snapshots históricos forem revalidados.

## Rollback
Somente código: restaurar as duas libs legadas via git, remover os arquivos
novos do domínio, manter D-A e providers. Nenhum rollback de banco necessário.

## Recomendação D-C

Prosseguir com `VERT-01.2D-C` — conectar `useProposalInventoryDemandPreview`
ao provider resolver, exibir `unsupported` na UI, gravar snapshot v2 real
mantendo aliases legados durante janela de migração.

---

## Update — VERT-01.2D-C (2026-07-23)

Estado anterior `ENGINE_READY_NOT_CONNECTED` **substituído** por
`ENGINE_CONNECTED_RUNTIME_ACTIVE`. Registro histórico da D-B preservado
acima; a nota abaixo passa a valer como estado corrente.

- Engine `buildInventoryDemandPreview` foi conectado ao runtime real via
  `useProposalInventoryDemandPreview` (`src/hooks/proposals/`).
- Persistência **v2** ativa: `useProposalInventoryDemandSnapshots` grava
  `algorithm_version = 'inventory-demand-v2'` e `payload.schema_version = 2`.
- Runtime usa `useInventoryProvider` (resolver canonical → legacy → native)
  em vez do hardcode `provider_type='eventrix'` do bridge legado.
- Native retorna `status='unsupported'` (capability `proposal_demand`
  ausente); Eventrix continua funcionando via normalização na fronteira.
- Bridges em `src/lib/proposals/inventoryDemand{Preview,Snapshot}.ts`
  permanecem `@deprecated` **apenas** para compatibilidade com consumidores
  não migrados; wrapper `provider_type='eventrix'` mantido apenas nesse
  bridge, não no runtime real.
- Aliases Eventrix no snapshot v2 preservados por design (bridge temporário).

Ver `docs/vertical/generic-proposal-inventory-demand-runtime-v1.md`.
