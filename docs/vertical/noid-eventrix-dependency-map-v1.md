# NOID ↔ Eventrix — Dependency Map v1

**Sprint:** `NOID-VERTICAL-1.0-VERT-01.1`
**Data:** 2026-07-22

## 1. Escopo

Mapear todas as dependências, referências textuais e acoplamentos entre o NOID RevenueOS e o Eventrix identificados por busca estática no repositório.

## 2. Método

- `rg -l -i "eventrix" src/` → 17 arquivos, 258 ocorrências.
- `rg -l -i "eventrix" supabase/functions/` → verificação backend.
- Cruzamento com schema (`eventrix_inventory_integration_settings`, `eventrix_inventory_sync_cache`).

## 3. Decisão arquitetural a validar

> **Eventrix deve ser `OPTIONAL_INTEGRATION` e nunca dependência obrigatória do `CORE_UNIVERSAL`.**

Estado atual: **violação parcial confirmada em Produtos e em Propostas (inventory demand)**. Não há acoplamento em Auth, CRM Core (accounts/opps/activities), Forecast, Revenue Command, OTE, Win/Loss, Automation ou GTM dashboards.

## 4. Superfícies acopladas

| # | Origem NOID | Destino Eventrix | Tipo | Obrigatória | Síncrono | Tenant-aware | Idempotente | Impacto se indisponível | Classificação recomendada |
|---|---|---|---|---|---|---|---|---|---|
| E01 | `src/pages/settings/EventrixInventorySettings.tsx` | Config UI | UI de settings | Não | Sync (form) | Sim | Sim | Nenhum (tela de config) | OPTIONAL_INTEGRATION |
| E02 | `src/hooks/settings/useEventrixInventory.ts` | R/W settings | Hook | Não | Sync | Sim | Sim | Config indisponível | OPTIONAL_INTEGRATION |
| E03 | `src/schemas/eventrixInventorySettings.ts` | Schema Zod | Contrato | Sim (para provider Eventrix) | n/a | n/a | n/a | Bloqueia integração | OPTIONAL_INTEGRATION |
| E04 | `src/components/products/ProductInventoryRequirementsEditor.tsx` | Categoria/Família Eventrix | Read + FK conceitual | **Sim (hoje)** | Sync | Sim | Sim | **BLOQUEIA cadastro de produto com requisitos de inventário** | Deve virar OPTIONAL_INTEGRATION com adapter |
| E05 | `src/hooks/products/useProductInventoryRequirements.ts` | R/W FKs Eventrix | Hook | Sim (hoje) | Sync | Sim | Sim | Idem E04 | OPTIONAL_INTEGRATION |
| E06 | `src/components/products/ProductBOMEditor.tsx` | Texto BOM | UI hint | Não | n/a | n/a | n/a | Nenhum (só texto) | OPTIONAL_INTEGRATION |
| E07 | `src/schemas/productInventoryRequirement.ts` | Schema Zod | Contrato | Sim (hoje) | n/a | n/a | n/a | Bloqueia validação | OPTIONAL_INTEGRATION |
| E08 | `src/lib/proposals/inventoryDemandSnapshot.ts` | Cálculo demanda | Lógica de snapshot | Não (proposal roda sem) | Sync | Sim | Sim | Snapshot fica vazio | OPTIONAL_INTEGRATION |
| E09 | `src/lib/proposals/inventoryDemandPreview.ts` | Preview demanda | Lógica preview | Não | Sync | Sim | Sim | Preview vazio | OPTIONAL_INTEGRATION |
| E10 | `src/components/proposals/ProposalInventoryDemandPreview.tsx` | UI preview | UI | Não | Sync | Sim | Sim | UI oculta | OPTIONAL_INTEGRATION |
| E11 | `src/components/proposals/ProposalInventoryDemandSnapshotDetails.tsx` | UI details | UI | Não | Sync | Sim | Sim | UI oculta | OPTIONAL_INTEGRATION |
| E12 | `src/pages/settings/SettingsPageV3.tsx` | Link para /eventrix-inventory | Nav | Não | n/a | n/a | n/a | Item de menu ausente | OPTIONAL_INTEGRATION |
| E13 | `src/pages/ProductEditorPage.tsx` | Editor produto | Composição | Não (guarda por feature) | Sync | Sim | Sim | Sub-form oculto | OPTIONAL_INTEGRATION |
| E14 | `src/pages/settings/NoidInventoryBackupPage.tsx` | Export backup | Consulta backend | Não | Sync | Sim | Sim | Backup vazio para eventrix | OPTIONAL_INTEGRATION |
| E15 | Tabela `eventrix_inventory_integration_settings` | Persistência config | DB | Sim (para provider) | n/a | Sim (RLS + 3 policies) | n/a | Config indisponível | OPTIONAL_INTEGRATION |
| E16 | Tabela `eventrix_inventory_sync_cache` | Cache sync | DB | Sim (para provider) | n/a | Sim (RLS + 3 policies) | n/a | Sync param | OPTIONAL_INTEGRATION |
| E17 | `src/integrations/supabase/types.ts` | Tipos gerados | Read-only | n/a | n/a | n/a | n/a | Nenhum | OPTIONAL_INTEGRATION |

## 5. Superfícies **não** acopladas (evidência de que Core está limpo)

Buscas por "eventrix" retornaram zero matches em:

- `src/services/supabase/{accounts,contacts,opportunities,activities,proposals,contracts}.ts`
- `src/hooks/**` fora de `products/settings/inventory`
- `src/components/{accounts,contacts,opportunities,activities,revenue-command,forecast,intelligence,vibe,winloss,ote,gamification,notifications,workflows,sequences}/**`
- `supabase/functions/**` (0 matches em edges de CRM/proposals/forecast)
- `src/pages/{Dashboard,Opportunities,Accounts,Contacts,Activities,Forecast,RevenueCommandPage,ProposalPublicView}.tsx`
- Auth / Storage / Notifications

## 6. Fluxos

### 6.1 Cadastro de produto com requisito de inventário

```text
User → ProductEditorPage
  → ProductInventoryRequirementsEditor
     → useProductInventoryRequirements
        → SELECT/INSERT em product_inventory_requirements
           com FK conceitual para eventrix_category_id/family_id
              → useEventrixInventory (carrega famílias/categorias)
```

**Violação:** o produto CORE hoje exige valores Eventrix mesmo se o tenant não usar Eventrix. Deve haver bypass ou provider "native".

### 6.2 Snapshot de demanda em proposta

```text
Proposal save → inventoryDemandSnapshot.ts
  → resolve requirements a partir do produto
     → chama provider (Eventrix)
        → grava proposal_inventory_demand_snapshots
```

**Grau de opcionalidade:** proposta salva mesmo sem snapshot. Menor risco.

### 6.3 Settings de integração

```text
User → /app/settings/eventrix-inventory
  → EventrixInventorySettings
     → eventrix_inventory_integration_settings (upsert)
        → cache em eventrix_inventory_sync_cache
```

**Grau de opcionalidade:** tela puramente opcional.

## 7. Riscos

| ID | Risco | Severidade |
|---|---|---|
| ER-01 | Produto sem Eventrix não consegue definir requisitos de inventário → bloqueia catálogo de tenants não-conectividade | HIGH |
| ER-02 | Nomenclatura "Eventrix" exposta ao usuário (rotas, labels, hooks) → tenants estranham marca de terceiro | MEDIUM |
| ER-03 | Schema Zod acopla nomes Eventrix ao contrato → dificulta swap de provider | MEDIUM |
| ER-04 | Falta abstração `InventoryProvider` genérica com adapters (`eventrix`, `native`, `erp-x`) | HIGH |
| ER-05 | Rotas admin do tenant expõem provider name (`/eventrix-inventory`) sem redirect | LOW |

## 8. Recomendação de desacoplamento (não executar nesta sprint)

1. Criar contrato `InventoryProviderAdapter { listCategories, listFamilies, resolveDemand, syncCache }`.
2. Implementar adapters `NativeInventoryProvider` e `EventrixInventoryProvider`.
3. Renomear tabela `eventrix_inventory_integration_settings` → `inventory_provider_settings` (com coluna `provider_type`).
4. Renomear FKs `eventrix_category_id/family_id` → `inventory_category_ref/family_ref` (texto opaco).
5. Renomear rota `/app/settings/eventrix-inventory` → `/app/settings/inventory-provider` com redirect.
6. Feature flag por tenant escolhendo o provider ativo.
7. Fallback: se nenhum provider ativo, produto salva sem requisitos.

## 9. Violações da decisão arquitetural

- **VIOLAÇÃO-01** (HIGH): `ProductInventoryRequirementsEditor` trata Eventrix como obrigatório.
- **VIOLAÇÃO-02** (MEDIUM): nomes de rota, hook, componente, schema e tabela expõem marca Eventrix.
- **VIOLAÇÃO-03** (MEDIUM): lógica de inventory demand em propostas depende do provider Eventrix sem adapter genérico.

Todas endereçáveis no VERT-01.2/01.3 sem quebra de compatibilidade.

---

## Update — Sprint VERT-01.2A (2026-07-22)

Adapter `InventoryProviderAdapter` criado. Consumidor migrado:
`src/components/products/ProductInventoryRequirementsEditor.tsx`.

Novo pipeline:
`Component → useInventoryProvider → resolveInventoryProvider → EventrixInventoryProvider | NativeInventoryProvider`.

Eventrix classificado como `OPTIONAL_INTEGRATION` no runtime — Core não conhece mais detalhes de schema Eventrix. Dependências remanescentes (proposals demand, settings page, BOM editor) preservadas para VERT-01.2B.

Ver `docs/vertical/inventory-provider-adapter-architecture-v1.md`.
