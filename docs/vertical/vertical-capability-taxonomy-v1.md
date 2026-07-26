# Vertical Capability Taxonomy (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.0`
**Parent:** [Vertical Foundation Architecture](./vertical-foundation-architecture-v1.md)

Freezes the naming convention for capability identifiers used across Vertical Foundation, Event Core, Vertical Packs, Tenant Configuration, Pack Engine, and Pack Lifecycle.

## 1. Format

```
<domain>.<capability>
```

- Lowercase ASCII, `[a-z0-9_]` per segment, single dot separator.
- Exactly two segments in v1; future nested capabilities may extend to `<domain>.<capability>.<subcapability>` but MUST remain backward-compatible.
- Stable across renames; a capability ID is a contract.
- Semantically clear — a human reading the ID should infer intent.
- **Provider-neutral, Pack-neutral, tenant-neutral.**

## 2. Reserved Domains

| Domain | Meaning |
|---|---|
| `inventory` | Inventory primitives, requirements, demand, equipment profiles |
| `proposal` | Proposal composition, sections, public view |
| `pricing` | Pricing engine rules |
| `opportunity` | Opportunity/deal lifecycle extensions |
| `roleplay` | Roleplay archetypes, rubrics, sessions |
| `academy` | Academy content and progression |
| `operations` | Operational workflows and tooling |
| `ai` | AI context, prompt layers, cadence |
| `navigation` | UI navigation contributions |
| `forms` | Form composition contributions |
| `reports` | Reporting / analytics contributions |
| `automation` | Automation triggers/actions |
| `import_export` | Import / export bindings |
| `events` | Event Core domain (reserved for VERT-03) |

Domains are additive; new domains require an ADR extension in [Foundation ADRs](./vertical-foundation-adrs-v1.md).

## 3. Canonical IDs (v1 catalog)

```
inventory.product_requirements
inventory.proposal_demand
inventory.equipment_profiles

roleplay.archetype_types

proposal.vertical_sections

pricing.vertical_rules

opportunity.handoff_extensions

academy.vertical_content

operations.vertical_workflows

ai.vertical_context

navigation.vertical_entries

forms.vertical_fields

reports.vertical_metrics

automation.vertical_triggers

import_export.vertical_bindings
```

## 4. Forbidden Patterns

| Pattern | Reason |
|---|---|
| `eventrix.product_requirements` | Provider name in capability ID |
| `connectivity.router_profile` as a Core capability | Pack name in capability ID for a Core-hosted surface |
| `client_acme.custom_flow` | Tenant name in capability ID |
| `PROPOSAL.Vertical_Sections` | Case / punctuation violation |
| `pack_v2.inventory_demand` | Version encoded in ID |

## 5. Declaration vs. Consumption

- **Core hosts** a capability by declaring an extension surface bound to a capability ID.
- **A Pack declares support** for a capability by contributing a value that matches the surface contract.
- **A provider implements** a capability inside a Pack or inside a Core-native primitive (e.g. `NativeInventoryProvider` implements `inventory.product_requirements` natively; a hypothetical `EventrixInventoryProvider` implements the same capability via the provider adapter).

A capability ID never encodes who implements it. Ownership is recorded elsewhere (manifest, registry, provider settings).

## 6. Capability vs. Adjacent Concepts

See [Vertical Foundation Architecture §13](./vertical-foundation-architecture-v1.md). Capability is neither a feature flag, nor an entitlement, nor a tenant setting, nor a Pack installation state.

## 7. Governance

- Adding a capability ID requires updating this document and referencing it from the corresponding entry in [Extension Surfaces](./vertical-extension-surfaces-v1.md).
- Removing or renaming a capability ID requires an ADR and a migration plan for historical records that reference it.
