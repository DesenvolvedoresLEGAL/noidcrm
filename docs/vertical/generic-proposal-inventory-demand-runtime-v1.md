# Generic Proposal Inventory Demand — Runtime Activation v1

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.2D-C`
**Decisão:** `VERT-01.2D-C VALIDATED — GENERIC PROPOSAL INVENTORY DEMAND ACTIVATED`
**Fechamento macro:** `VERT-01.2D COMPLETE — PROPOSAL INVENTORY DEMAND DECOUPLED WITH LEGACY SNAPSHOT ALIASES`

## 1. Baseline

- 91/91 testes verdes (foundation 12 + engine 36 + registry 5 + providers 7 +
  resolver 5 + resolver-canonical 8 + settings page 2 + hook/runtime novos).
- `tsgo --noEmit`: 0 erros.
- Suíte tenant-isolation: inalterada (nenhum arquivo desta sub-sprint toca
  banco, RLS, Edge Functions, Storage ou Auth).
- Nenhuma migration executada. Nenhuma alteração de RLS ou policies.
- Nenhum publish.

## 2. Arquitetura runtime final

```text
Proposal
  → useProposalInventoryDemandPreview
     → useInventoryProvider (resolver canonical → legacy → native)
        → capability `proposal_demand`
           → normalizeProductInventoryRequirements  (fronteira única)
              → buildInventoryDemandPreview        (domínio genérico)
                 → UI genérica (category_name / family_name / item_kind)
                    → serializeInventoryDemandSnapshotV2
                       → persistence (proposal_inventory_demand_snapshots)
```

O hook nunca mais lê colunas `eventrix_*` diretamente. A normalização das
colunas físicas legadas ocorre apenas na fronteira `normalizeProductInventoryRequirements`,
que só é chamada quando o provider ativo aceita esses requisitos.

## 3. Provider Eventrix

- Declara capability `proposal_demand`.
- Requisitos legados são normalizados na fronteira (colunas físicas
  `eventrix_*` viram `category_ref/family_ref/item_kind` em runtime).
- Não é domínio universal; permanece `OPTIONAL_INTEGRATION`.

## 4. Provider Native

- Não declara capability `proposal_demand`.
- Preview devolve `status = 'unsupported'`, `lines = []`, totals zerados e
  warning legível.
- Não consulta `product_inventory_requirements` desnecessariamente.
- Não presume disponibilidade nem inventário fictício.

## 5. Snapshot v2

- `payload.schema_version = 2`.
- `algorithm_version = 'inventory-demand-v2'` (coluna existente).
- Campos genéricos: `provider_type`, `category_ref`, `category_name`,
  `family_ref`, `family_name`, `item_kind`, `unit_basis`.
- Aliases `eventrix_*` continuam presentes **apenas** quando
  `provider_type === 'eventrix'`, exclusivamente no serializer, como bridge
  temporário para consumidores legados. Não vazam para hash ou compare.

## 6. Snapshot v1

- Formato histórico permanece intocado.
- Reader (`normalizeInventoryDemandSnapshot`) converte `eventrix_*` em
  referências genéricas em runtime.
- Nenhum backfill executado, nenhum rewrite de payload histórico.
- UI de detalhes rotula snapshots v1 como "Formato legado" sem quebrar leitura.

## 7. Histórico

- Independente do provider atualmente ativo.
- Snapshots Eventrix continuam legíveis mesmo após o tenant migrar para Native.
- Comparação (`compareInventoryDemand`) opera sobre o significado comercial
  normalizado e ignora aliases legados.

## 8. UI

- Exibe `category_name`, `family_name`, `item_kind` genéricos.
- Provider aparece apenas como contexto ("Provider ativo: …").
- Estado `unsupported` mostra card informativo quando o provider ativo não
  suporta `proposal_demand`.
- Nenhuma dependência universal em nomenclatura Eventrix.

## 9. Persistência

- Tabela `proposal_inventory_demand_snapshots` inalterada (DDL, RLS, grants).
- Coluna física `status` mantém a semântica existente.
- `schema_version` vive no JSONB `payload`.
- `algorithm_version` usa a coluna existente (default legado preservado
  para callers antigos).

## 10. Compatibilidade

- Bridges `src/lib/proposals/inventoryDemand{Preview,Snapshot}.ts` seguem
  `@deprecated` e delegam ao domínio genérico.
- Aliases Eventrix preservados no snapshot v2 durante janela de migração.
- Product BOM ainda **não** foi desacoplado (permanece legado Eventrix).
- Settings Eventrix (`useEventrixInventory`, página de configuração
  provider-specific) permanecem como estão.
- Colunas físicas `eventrix_*` em `product_inventory_requirements` continuam
  intactas.

## 11. Riscos residuais

- Aliases Eventrix no snapshot v2 são bridge; removê-los exige revalidar
  100% dos snapshots históricos.
- Product BOM (`ProductBOMEditor`, `ProductInventoryRequirementsEditor` e
  `useProductInventoryRequirements`) ainda leem/gravam colunas Eventrix.
- Pack Conectividade ainda não existe; Native permanece sem fonte real de
  requisitos.
- Rota canônica de settings continua com "eventrix" no path (preservada
  intencionalmente para não quebrar bookmarks).

## 12. Rollback

Exclusivamente de código:

1. `git revert` do commit desta sub-sprint.
2. Nenhuma alteração de banco a desfazer.
3. Snapshots v2 gravados permanecem legíveis pelo reader mesmo após rollback
   (payload é aditivo).

## 13. Próxima sprint recomendada

`VERT-01.2E — PRODUCT BOM & LEGACY EVENTRIX CONSUMER CLEANUP`
