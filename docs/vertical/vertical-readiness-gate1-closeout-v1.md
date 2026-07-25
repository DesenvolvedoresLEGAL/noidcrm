# Vertical Readiness — Gate 1 Closeout (v1)

**Change ID:** `NOID-VERTICAL-1.0-GATE-1-CLOSEOUT`
**Decision:** `GATE 1 — VERTICAL READINESS APPROVED WITH NON-BLOCKING RESIDUALS`
**Epic status:** `VERT-01 COMPLETE — CORE READY FOR VERTICAL FOUNDATION`

## 1. VERT-01 timeline
- VERT-01.1 — Read-only audit; 20 hardcodes identified, 6 HIGH.
- VERT-01.2A/B/C — Inventory Provider abstraction, settings foundation, canonical UI.
- VERT-01.2D — Generic Proposal Inventory Demand runtime (snapshot v2).
- VERT-01.2E-* — Canonical sync, BOM/legacy Eventrix consumer cleanup, generic Product Requirement façade + editor + proposal runtime.
- VERT-01.3A/B1/B2 — Connectivity Pack extraction (schemas, labels, inventory catalog, allocations).
- VERT-01.4A/B0/B1/B2 — Roleplay archetype foundation → DB migration readiness → enum → text → runtime generic activation.

## 2. Original blockers
6 HIGH: HC-002 (product/eventrix schema), HC-004/005 (archetype union+enum), HC-006/007 (connectivity schemas+labels in Core), HC-018 (generated Events enum).

## 3. Eventrix decoupling
Storage columns preserved; runtime moved to generic domain (`src/inventory/demand`, `src/inventory/requirements`). Eventrix code confined to the provider boundary; bridges marked `@deprecated`.

## 4. Inventory Provider abstraction
`InventoryProviderAdapter`, `NativeInventoryProvider`, `EventrixInventoryProvider`, `useInventoryProvider`, `inventory_provider_settings` table with RLS, canonical `/app/settings/inventory-provider` route + Eventrix redirect.

## 5. Product Requirements façade
`src/inventory/requirements/**` neutral contract with storage mapper; `useInventoryProductRequirements`; product editor + BOM operate on the generic façade. Legacy `eventrix_*` columns retained for storage compatibility only.

## 6. Proposal Demand generic runtime
`src/inventory/demand/**` snapshot v2 with backward-compatible reader for v1. Preview and snapshot UIs render generic `category_name/family_name/item_kind`; provider is context, not domain.

## 7. Connectivity Pack extraction
`src/vertical-packs/connectivity/inventory/**` owns router/sim_card profiles, schemas, field labels, custom-config helpers. Inventory catalog and allocation flows import directly from the Pack. Legacy Core bridge has zero active runtime consumers.

## 8. Roleplay archetype decoupling
Core generic type + factory (`src/roleplay/archetypes/**`), Events Pack canonical values (`src/vertical-packs/events/roleplay/**`), DB column migrated `enum → text`, runtime service and schema now generic, UI options fed by the Events Pack with meaning-preserving edit for unknown values.

## 9. Hardcode register — final (functional)
| ID | Status |
| --- | --- |
| HC-001 | IDENTIFIED (tenant template string, non-blocker) |
| HC-002 | FUNCTIONALLY_DECOUPLED_LEGACY_STORAGE (generic façade active; legacy columns retained) |
| HC-003 | RESOLVED |
| HC-004 | RESOLVED_GENERIC_ARCHETYPE_TYPE |
| HC-005 | RESOLVED_GENERIC_ARCHETYPE_SCHEMA |
| HC-006 | FUNCTIONALLY_EXTRACTED_TO_CONNECTIVITY_PACK |
| HC-007 | FUNCTIONALLY_EXTRACTED_TO_CONNECTIVITY_PACK |
| HC-008 | RECLASSIFIED_PROVIDER_SPECIFIC |
| HC-009 | LEGACY_ROUTE_ALIAS (canonical route active; redirect preserved) |
| HC-010 | RECLASSIFIED_PROVIDER_SPECIFIC |
| HC-011 | DECOUPLED_WITH_LEGACY_ALIAS |
| HC-012 | DECOUPLED_WITH_LEGACY_ALIAS |
| HC-013 | DECOUPLED_WITH_LEGACY_ALIAS |
| HC-014 | DECOUPLED_WITH_LEGACY_ALIAS |
| HC-015 | FUNCTIONALLY_DECOUPLED_LEGACY_STORAGE |
| HC-016 | IDENTIFIED (feature flag, non-blocker) |
| HC-017 | IDENTIFIED (i18n convention, non-blocker) |
| HC-018 | LEGACY_DB_ENUM_RETAINED_UNUSED |
| HC-019 | IDENTIFIED (Pack seed content, non-blocker) |
| HC-020 | IDENTIFIED (provider registry future, non-blocker) |

## 10. Residual non-blockers by class
- ACTIVE_CORE_BLOCKER: none.
- ACTIVE_VERTICAL_COUPLING_NON_BLOCKER: none.
- PROVIDER_SPECIFIC_LEGITIMATE: HC-008, HC-010, HC-020.
- LEGACY_COMPATIBILITY: HC-002, HC-011..HC-015, HC-018 (physical enum), Eventrix bridge modules `@deprecated`.
- TENANT_CONFIG_FUTURE: HC-001, HC-016, HC-019.
- VISUAL/COPY_RESIDUAL: HC-009 (route alias).
- GENERATED/HISTORICAL: HC-017.

Each residual has an explicit destination in the register and is not required to start VERT-02.

## 11. Gate criteria checklist
1. Zero HIGH ACTIVE_CORE_BLOCKER ✅
2. No hardcode blocks another vertical from consuming Core ✅
3. Inventory provider abstraction active ✅
4. Product Requirement Core generic ✅
5. Proposal Demand generic ✅
6. Connectivity domain outside Core ✅
7. Roleplay archetype type generic ✅
8. Provider-specific code confined ✅
9. Residuals have explicit destinations ✅
10. Nothing pending is a prerequisite for VERT-02 ✅

## 12. Gate decision
`GATE 1 — VERTICAL READINESS APPROVED WITH NON-BLOCKING RESIDUALS`.

## 13. What Gate 1 does NOT mean
Does NOT mean: multi-vertical product complete, Pack Engine complete, Tenant Configuration complete, Event Core complete, SaaS mass-onboarding ready, or external scale ready. It only means Core is decoupled enough to start Vertical Foundation work.

## 14. Rollback / legacy debt
- `public.client_type` enum retained (rollback anchor).
- `eventrix_*` product requirement columns retained (storage compatibility).
- Eventrix bridges `@deprecated` with zero runtime consumers.
- v1 snapshot reader retained for historical proposals.

## 15. Recommended next epic
`VERT-02 — VERTICAL FOUNDATION`. Before starting, revisit decomposition of VERT-02/03/04/05/06 (Vertical Foundation, Event Core, Tenant Configuration Engine, Vertical Pack Engine, Pack Versioning/Installation). Do NOT auto-start.
