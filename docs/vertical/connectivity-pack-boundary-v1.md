# Connectivity Pack — Boundary Declaration (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.3A`

This document is normative for what belongs inside the Connectivity Vertical Pack
versus the Core Universal. It does **not** describe a runtime Pack Engine — the
Connectivity Pack is currently a code-level boundary only.

## Connectivity Pack owns

- Router equipment profile (`router`).
- SIM equipment profile (`sim_card`).
- Networking equipment factory metadata (SSID, Wi-Fi password, admin credentials,
  IMEI, ICCID, line number, carrier, APN, PIN).
- Networking operational configuration (custom SSID / Wi-Fi / APN on allocations).
- Connectivity-specific Zod schemas (`routerFactorySchema`, `simCardFactorySchema`,
  `routerCustomSchema`, `simCardCustomSchema`).
- Connectivity-specific field labels for form error feedback.
- Helpers that read/merge connectivity metadata and allocation custom config.

Location: `src/vertical-packs/connectivity/inventory/`.

## Core Universal owns

- Inventory item, category, family, location, status.
- Quantities (total / available / minimum), unit of measure.
- Serial number, asset code, brand, model, notes, description.
- Generic `metadata` and generic `custom_config` slots.
- Generic validation & error feedback infrastructure (`CORE_FIELD_LABELS`,
  `showFormErrors` with extension point).
- The neutral fallback expressed by absence of a connectivity profile.

## Direction rule

- Allowed: Connectivity Pack → Core extension points.
- Forbidden as permanent architecture: Core → Connectivity Pack.
- The legacy bridge at `src/lib/operations/inventoryEquipmentProfile.ts` is
  `@deprecated` and exists solely to keep un-migrated consumers compiling until
  VERT-01.3B.

## Not implemented in this sprint

- Pack Engine, tenant pack tables, install/uninstall, versioning, entitlements,
  provisioning, seed automation, migrations, Event Core.
