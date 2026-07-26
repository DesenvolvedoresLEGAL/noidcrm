# Vertical Foundation Architecture (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.0`
**Classification:** GREEN — Architecture / Read-only / Documentation
**Status:** `VERT-02.0 VALIDATED — VERTICAL FOUNDATION ARCHITECTURE CONTRACT FROZEN`
**Predecessor:** [Gate 1 Closeout](./vertical-readiness-gate1-closeout-v1.md)

This document is the normative architectural contract that governs epics VERT-02 through VERT-06. It freezes boundaries, responsibilities, dependency direction, and extension surfaces BEFORE any Foundation code is written. It does not implement anything.

---

## 1. Principle

```text
CORE UNIVERSAL
    ↓
VERTICAL FOUNDATION            (shared extension contracts)
    ↓
EVENT CORE                     (shared event-industry domain)
    ↓
VERTICAL PACKS                 (Connectivity / AV / Stands / Rental / …)
    ↓
TENANT CONFIGURATION           (tenant-specific choices & overrides)
    ↓
PACK ENGINE                    (runtime resolution / composition)
    ↓
PACK INSTALLATION & VERSIONING (lifecycle / governance)
```

Lower layers never depend on the implementation of upper layers. Higher layers may depend only on the contracts (not implementations) of the layers immediately beneath them, according to the dependency rules in §11.

---

## 2. Core Universal

**Mission.** Provide industry-neutral primitives that every NOID tenant needs regardless of vertical.

**Owns (illustrative, non-exhaustive):**
- organization / tenant, users, roles, permissions, memberships
- accounts, contacts
- opportunities, pipelines, stages, activities
- products (generic), proposals, commercial workflows
- inventory primitives (categories, families, items, quantities, allocations — neutral)
- Revenue intelligence primitives (forecast math, win/loss engine, revenue SoT)
- Academy primitives (course, module, lesson, assessment, progression)
- Roleplay primitives (session, rubric, archetype as generic type)
- generic AI infrastructure (agent runtime, prompt layers, cadence, approvals)
- generic configuration infrastructure (settings tables, secrets, RLS scaffolding)

**Does NOT know:**
- router, SIM, APN, SSID, IMEI, ICCID
- AV equipment, stands, catering, pavilions
- exhibitor / organizer semantics
- Eventrix, ExpoFP, Apollo, Umma, Human ERP (as domain concepts)
- any vendor/provider-specific field, enum, or workflow

**Rule.** Core must remain compilable and runnable with zero Packs installed.

---

## 3. Vertical Foundation (VERT-02)

**Mission.** Universal infrastructure for vertical composition. Foundation is the layer that lets Packs plug into Core without Core knowing they exist.

**Owns:**
- vertical identifiers and pack identifiers (string types + validation)
- capability identifiers (naming convention, registry contract — not the registry state)
- extension point contracts (host declaration + contribution declaration types)
- contribution contract shapes (Zod/TS schemas contributions must satisfy)
- composition context types (what a contribution receives at runtime)
- static resolution primitives (deterministic lookup, no persistence)
- dependency-direction assertions and namespacing rules
- shape validation of contributions

**Does NOT own:**
- Events business rules
- Connectivity rules
- installed-pack state, tenant overrides, or version history
- upgrade / rollback workflows
- runtime pack loading of remote code

---

## 4. Event Core (VERT-03)

**Mission.** Shared domain of the event industry. Concepts common to essentially every operator in the events ecosystem, independent of which supplier vertical they run.

**Candidate concepts (boundary intent, not implementation list):**
- event, venue, pavilion, stand
- event dates (setup / event / teardown windows)
- organizer relationship, exhibitor relationship, event participation
- event-linked opportunity / proposal / order context

**Rule.** Event Core is domain shared by the events market. Vertical Packs specialise it for a specific supplier discipline.

| Layer | Owns |
|---|---|
| Event Core | `Evento` |
| Connectivity Pack | Rede / Roteador / SIM / instalação |
| AV Pack | Som / luz / vídeo / potência / canais |
| Stand Pack | estrutura / acabamento / montagem |
| Rental Pack | reservas / asset requirements / logística |

---

## 5. Events Pack ≠ Event Core

`src/vertical-packs/events/**` created in VERT-01.4 is the boundary for **Events-context content/configuration** (archetypes, vocabulary, playbooks, defaults). It is NOT a dumping ground for every events-related concept. During VERT-03, structural domain concepts migrate to Event Core; Events Pack retains content, defaults, terminology, archetype options, playbooks, and Academy content specific to the Events context.

---

## 6. Vertical Pack

**Mission.** First-party specialisation of the product for a supplier discipline.

**Owns:** domain schemas, field labels, custom-config helpers, Pack-specific UI hosts, Pack-specific validation, Pack-specific defaults, integration with providers.

**Reference implementation.** `src/vertical-packs/connectivity/inventory/**` (see [Connectivity Pack Boundary](./connectivity-pack-boundary-v1.md)).

---

## 7. Tenant Configuration Engine (VERT-04)

**Mission.** Company-specific choices WITHOUT code changes. `CONFIG BEFORE CUSTOMIZATION`.

**Owns:** terminology, defaults, enabled capabilities, allowed archetype types, custom fields, proposal behaviors, workflow preferences, pack configuration, tenant-specific overrides.

**Is NOT:** forks, per-client code, per-client tables, per-client React components, per-client migrations.

---

## 8. Vertical Pack Engine (VERT-05)

**Mission.** Runtime composition of installed Packs.

**Owns (future):** `PackDescriptor`, `PackManifest`, capabilities exposed, contributions declared, dependency declarations, conflict declarations, resolver, installed-pack context, extension resolution.

**Does NOT own:** the content of any specific Pack, tenant overrides, Event Core domain, or lifecycle/version history.

---

## 9. Pack Versioning / Installation (VERT-06)

**Mission.** Lifecycle governance of Packs.

**Owns:** install, uninstall, activation, version, Pack migrations, compatibility checks, dependencies, upgrade, rollback, history, tenant pack state.

**Separation from VERT-05.** VERT-05 answers "how to compose". VERT-06 answers "how to manage lifecycle". They must not merge.

---

## 10. Provider ≠ Pack

- **Pack** — vertical specialisation of the product (e.g. Connectivity Pack).
- **Provider** — a specific implementation/integrator of a capability (e.g. `EventrixInventoryProvider`, `NativeInventoryProvider`).

A Pack may use one or more providers. A provider is never a Pack. Provider-specific settings stay confined to the provider adapter (see `src/inventory/providers/**`).

---

## 11. Dependency Direction (normative)

**Allowed:**

| From | → | To |
|---|---|---|
| Core module | → | (nothing above it) |
| Vertical Foundation | → | Core |
| Event Core | → | Vertical Foundation, Core |
| Vertical Pack | → | Vertical Foundation, Core |
| Vertical Pack | → | Event Core (when explicitly necessary) |
| Tenant Configuration Engine | → | Vertical Foundation, Core |
| Pack Engine | → | Vertical Foundation, Core |
| Pack Installation | → | Pack Engine, Vertical Foundation |

**Forbidden:**

- Core → Connectivity Pack
- Core → Events Pack
- Vertical Foundation → any concrete Pack
- Event Core → Connectivity Pack (or any concrete Pack)
- Tenant Configuration → hardcoded reference to a concrete Pack
- Pack Engine → business rule specific to any Pack

Legacy bridges (e.g. `src/lib/operations/inventoryEquipmentProfile.ts`) that violate this direction must remain `@deprecated` with zero active runtime consumers and a scheduled removal.

---

## 12. Capability Taxonomy

**Format:** `<domain>.<capability>` — stable lowercase string, semantically clear, independent of Pack / tenant / provider.

**Illustrative IDs (convention, not implementation):**

```
inventory.product_requirements
inventory.proposal_demand
inventory.equipment_profiles
roleplay.archetype_types
proposal.vertical_sections
pricing.vertical_rules
academy.vertical_content
operations.vertical_workflows
ai.vertical_context
navigation.vertical_entries
```

**Forbidden:** `eventrix.product_requirements` as a Core capability. The provider/Pack *declares support for* `inventory.product_requirements`; the capability name never encodes a provider.

---

## 13. Capability ≠ Feature Flag / Entitlement / Config / Installation

| Concept | Meaning |
|---|---|
| Capability | Architectural capacity provided by an implementation, Pack, or provider. |
| Feature flag | Operational control of rollout / exposure. |
| Entitlement | Commercial right (plan / SKU). |
| Tenant configuration | Tenant-specific choice within allowed capabilities. |
| Pack installation | Presence and lifecycle state of a Pack for a tenant. |

These are five distinct concerns and must not be conflated in code, tables, or UI.

---

## 14. Multi-Pack Tenant (CRITICAL)

A tenant MAY have more than one Pack installed simultaneously (e.g. Connectivity + AV + Rental). Architecture, tables, types, and UI must NEVER model:

```
tenant.vertical = <single-enum>
```

Pack presence is a set, never a scalar. This decision blocks any future modeling that assumes one vertical per tenant.

---

## 15. Historical Semantics

Changes to Pack, configuration, label, defaults, pricing, or proposal behavior **must not automatically reinterpret historical records**.

**Reference positive pattern.** `proposal_inventory_demand_snapshots` v2 (see [Generic Proposal Inventory Demand Runtime](./generic-proposal-inventory-demand-runtime-v1.md)) — resolved values, algorithm version, and source records are snapshotted at write time.

**Acceptable patterns:** snapshot, `schema_version`, `pack_version`, resolved values embedded in the record, immutable semantic aliases.

---

## 16. Resolution Precedence (conceptual)

Future resolvers should compose values in this default order, with per-surface exceptions documented explicitly:

```
Core defaults
  → Event Core defaults
    → Pack defaults
      → Tenant configuration
        → Record-specific override
```

Not implemented in VERT-02.0.

---

## 17. Conflict Policy

Two Packs must never silently overwrite the same contribution. Conflicts must be:

- deterministically resolved by declared precedence, OR
- explicitly permitted via a merge contract, OR
- rejected at composition time with a diagnostic.

Not implemented in VERT-02.0.

---

## 18. No Third-Party Plugin System

NOID Vertical Packs are **first-party, governed, type-safe, versioned, and known to NOID**. This architecture explicitly does NOT design:

- a public plugin marketplace
- execution of third-party code
- dynamic remote module loading

---

## 19. AI Context Composition

Future AI context is a composition:

```
NOID global context
  + Core record context
  + Event Core context
  + Pack context
  + Tenant configuration
  + user permissions
```

The AI must never infer vertical by scanning strings scattered across records. Not implemented in VERT-02.0.

---

## 20. Navigation & Forms & Academy

- **Navigation.** Pack-specific menu entries will be contributions, not permanent hardcodes in `AppSidebar`. HC-016 is the future destination.
- **Forms.** Pack-specific fields enter via extension points / composition hosts. Positive references: Connectivity Equipment Profiles, Events Roleplay Archetype options.
- **Academy.** Core owns course/module/lesson/assessment/progression. Pack contributes content, defaults, playbooks, terminology, vertical-specific training. Tenant Config supplies company-specific overrides. Respects the existing NOID Revenue Academy PRD.

Not implemented in VERT-02.0.

---

## 21. Companion Documents

- [Layer Responsibility Matrix](./vertical-layer-responsibility-matrix-v1.md)
- [Extension Surfaces Catalog](./vertical-extension-surfaces-v1.md)
- [Capability Taxonomy](./vertical-capability-taxonomy-v1.md)
- [Foundation ADRs](./vertical-foundation-adrs-v1.md)
- [VERT-02 Sprint Decomposition](./vert-02-sprint-decomposition-v1.md)

---

## 22. Decision

`VERT-02.0 VALIDATED — VERTICAL FOUNDATION ARCHITECTURE CONTRACT FROZEN`.

Zero runtime code changed. Zero DB changes. Zero migrations. Zero publish.

## 23. Recommended Next Sprint

`VERT-02.1 — CORE VERTICAL TYPES & NAMESPACED CAPABILITY CONTRACT` (see decomposition doc). Do NOT auto-start.
