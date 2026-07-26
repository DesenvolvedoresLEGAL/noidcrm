# Vertical Layer Responsibility Matrix (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.0`
**Parent:** [Vertical Foundation Architecture](./vertical-foundation-architecture-v1.md)

Normative responsibility matrix for VERT-02 through VERT-06. Each epic's mission, ownership, non-ownership, inputs, outputs, dependencies, first deliverable, and gate to the next epic are frozen here.

---

## VERT-02 — Vertical Foundation

| Field | Value |
|---|---|
| Mission | Universal infrastructure that lets Packs plug into Core without Core knowing them. |
| Owns | Vertical/pack ID types; capability ID naming contract; extension point + contribution contract types; composition context types; static resolution primitives; dependency-direction assertions; namespacing rules; contribution shape validation. |
| Does NOT own | Event Core domain; Pack content; Pack installation state; tenant overrides persisted; version upgrade workflows; runtime remote loading. |
| Inputs | Core primitives; validated Gate 1 patterns (Inventory Provider adapter, generic Requirements façade, generic Demand snapshot, Connectivity Pack extraction, Roleplay archetype decoupling). |
| Outputs | `src/vertical/foundation/**` with types, contracts, static registry; test suite proving Foundation is industry-neutral. |
| Dependencies | Core Universal only. |
| First deliverable | VERT-02.1 (Core Vertical Types & Namespaced Capability Contract). |
| Gate to next epic | `GATE 2A — VERTICAL FOUNDATION CONTRACT READY`. |

---

## VERT-03 — Event Core

| Field | Value |
|---|---|
| Mission | Shared domain of the event industry (event, venue, pavilion, stand, dates, participation relationships). |
| Owns | Structural entities and relationships common to all event-industry tenants; event-linked context for opportunities/proposals/orders. |
| Does NOT own | Supplier-discipline specifics (Connectivity, AV, Stands, Rental); tenant configuration; Pack Engine; Events Pack content. |
| Inputs | Vertical Foundation contracts (VERT-02). |
| Outputs | Event Core module with schemas, RLS-aware tables, generic hooks; Event Core context contribution for extension surfaces. |
| Dependencies | Vertical Foundation, Core. |
| First deliverable | Event entity + event-linked opportunity context. |
| Gate to next epic | `GATE 2B — EVENT CORE READY`. |

---

## VERT-04 — Tenant Configuration Engine

| Field | Value |
|---|---|
| Mission | Company-specific choices without code changes. `CONFIG BEFORE CUSTOMIZATION`. |
| Owns | Configuration schema per capability; overrides; terminology; enabled capabilities; allowed archetype types; custom fields registry; per-tenant defaults. |
| Does NOT own | Feature flags (operational rollout); entitlements (commercial); Pack installation state; Pack Engine composition. |
| Inputs | Foundation capability contracts (VERT-02); Event Core (VERT-03) where applicable. |
| Outputs | Tenant config tables (RLS), config resolver hook, admin UI for allowed surfaces. |
| Dependencies | Vertical Foundation, Core. |
| First deliverable | Terminology & defaults overrides. |
| Gate to next epic | `GATE 2C — TENANT CONFIG READY`. |

---

## VERT-05 — Vertical Pack Engine

| Field | Value |
|---|---|
| Mission | Runtime composition of installed Packs. "How to compose". |
| Owns | `PackDescriptor`, `PackManifest`, capabilities exposed, contributions declared, dependency declarations, conflict declarations, resolver, installed-pack composition context, extension resolution. |
| Does NOT own | Content of any Pack; lifecycle/version history; tenant configuration; business rules specific to any Pack. |
| Inputs | Vertical Foundation (VERT-02); Tenant Configuration (VERT-04) for enabled-capabilities filter. |
| Outputs | Pack manifest schema; resolver; composition hooks. |
| Dependencies | Vertical Foundation, Core. |
| First deliverable | Pack manifest schema + static composition resolver. |
| Gate to next epic | `GATE 2D — PACK ENGINE READY`. |

---

## VERT-06 — Pack Versioning / Installation

| Field | Value |
|---|---|
| Mission | Lifecycle governance of Packs. "How to manage lifecycle". |
| Owns | Install, uninstall, activation, version, Pack migrations, compatibility, dependencies, upgrade, rollback, history, tenant pack state. |
| Does NOT own | Runtime composition (VERT-05); Pack content; tenant configuration. |
| Inputs | Pack Engine (VERT-05) manifests; Tenant Configuration (VERT-04). |
| Outputs | Tenant pack state tables, install/upgrade workflows, rollback tooling. |
| Dependencies | Pack Engine, Vertical Foundation. |
| First deliverable | Tenant pack state table + install RPC. |
| Gate to next epic | `GATE 2 COMPLETE — MULTI-PACK PLATFORM READY`. |

---

## Current Code → Target Layer Mapping

| Current module | Target layer |
|---|---|
| `src/inventory/providers/InventoryProviderAdapter.ts` | CORE_UNIVERSAL (provider-adapter primitive) |
| `src/inventory/providers/NativeInventoryProvider.ts` | PROVIDER_IMPLEMENTATION |
| `src/inventory/providers/EventrixInventoryProvider.ts` | PROVIDER_IMPLEMENTATION |
| `src/inventory/requirements/**` | CORE_UNIVERSAL (generic façade) |
| `src/inventory/demand/**` | CORE_UNIVERSAL (generic demand runtime) |
| `src/vertical-packs/connectivity/inventory/**` | VERTICAL_PACK (Connectivity) |
| `src/roleplay/archetypes/**` | CORE_UNIVERSAL (generic archetype primitives) |
| `src/vertical-packs/events/roleplay/**` | VERTICAL_PACK (Events Pack content) — some concepts may migrate to EVENT_CORE in VERT-03 |
| `src/lib/operations/inventoryEquipmentProfile.ts` (@deprecated) | LEGACY_BRIDGE (to be removed) |
| `src/components/**/AppSidebar.tsx` | CORE_UNIVERSAL host — HC-016 future contribution surface |
| Academy modules | CORE_UNIVERSAL (primitives) + VERTICAL_PACK (content) + TENANT_CONFIGURATION (overrides) |
| Operations (inventory allocations, occupancy, locations) | CORE_UNIVERSAL primitives; Pack-specific extensions via contributions |
| Pricing engine | CORE_UNIVERSAL primitives; Pack-specific rules via extension surface `pricing.vertical_rules` |
| Proposal (public view, sections, snapshot) | CORE_UNIVERSAL; vertical sections via `proposal.vertical_sections` |
| AI (agents, prompts, cadence) | CORE_UNIVERSAL primitives; per-Pack context via `ai.vertical_context` |
| Event entities (candidate) | EVENT_CORE (to be created in VERT-03) — TO_BE_CLASSIFIED until then |
| Tenant preferences / terminology | TENANT_CONFIGURATION (VERT-04) |
| Pack manifest / registry | PACK_ENGINE (VERT-05) |
| Tenant pack state, install history | PACK_LIFECYCLE (VERT-06) |

Anything not in this table is classified `TO_BE_CLASSIFIED` and must be triaged before it is touched by VERT-02+ code.
