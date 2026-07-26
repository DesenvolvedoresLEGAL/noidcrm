// NOID-VERTICAL-1.0-VERT-02.1
// Canonical Vertical Foundation capability catalog (v1).
//
// This is a CATALOG of known contract identifiers — not a runtime registry.
// It does not know which capabilities are installed, enabled, entitled, or
// configured for a tenant. Those concerns belong to later sprints
// (VERT-02.5 / VERT-04 / VERT-05 / VERT-06).
//
// Every entry is constructed through `parseCapabilityId`, so any drift from
// the frozen syntax fails at module load, not at first use.
//
// The keys below intentionally use platform-neutral capability names. They do
// not reference any concrete Pack, provider, or industry concept.

import { parseCapabilityId, type CapabilityId } from './ids';

/**
 * Frozen canonical map of capability ids (v1, exactly 15 entries).
 * Keys are stable UPPER_SNAKE aliases for ergonomic import; values are the
 * canonical `<domain>.<capability>` strings.
 */
export const CAPABILITY_IDS = Object.freeze({
  INVENTORY_PRODUCT_REQUIREMENTS: parseCapabilityId('inventory.product_requirements'),
  INVENTORY_PROPOSAL_DEMAND: parseCapabilityId('inventory.proposal_demand'),
  INVENTORY_EQUIPMENT_PROFILES: parseCapabilityId('inventory.equipment_profiles'),
  ROLEPLAY_ARCHETYPE_TYPES: parseCapabilityId('roleplay.archetype_types'),
  PROPOSAL_VERTICAL_SECTIONS: parseCapabilityId('proposal.vertical_sections'),
  PRICING_VERTICAL_RULES: parseCapabilityId('pricing.vertical_rules'),
  OPPORTUNITY_HANDOFF_EXTENSIONS: parseCapabilityId('opportunity.handoff_extensions'),
  ACADEMY_VERTICAL_CONTENT: parseCapabilityId('academy.vertical_content'),
  OPERATIONS_VERTICAL_WORKFLOWS: parseCapabilityId('operations.vertical_workflows'),
  AI_VERTICAL_CONTEXT: parseCapabilityId('ai.vertical_context'),
  NAVIGATION_VERTICAL_ENTRIES: parseCapabilityId('navigation.vertical_entries'),
  FORMS_VERTICAL_FIELDS: parseCapabilityId('forms.vertical_fields'),
  REPORTS_VERTICAL_METRICS: parseCapabilityId('reports.vertical_metrics'),
  AUTOMATION_VERTICAL_TRIGGERS: parseCapabilityId('automation.vertical_triggers'),
  IMPORT_EXPORT_VERTICAL_BINDINGS: parseCapabilityId('import_export.vertical_bindings'),
} as const);

/** Union of the canonical capability id string literals derived from the map. */
export type CanonicalCapabilityId =
  (typeof CAPABILITY_IDS)[keyof typeof CAPABILITY_IDS];

/** Readonly ordered collection of canonical capability ids, derived from the map. */
export const CANONICAL_CAPABILITY_IDS: readonly CanonicalCapabilityId[] =
  Object.freeze(Object.values(CAPABILITY_IDS) as CanonicalCapabilityId[]);

/** True when `id` is one of the canonical capability ids. */
export function isCanonicalCapabilityId(
  id: CapabilityId | string,
): id is CanonicalCapabilityId {
  return (CANONICAL_CAPABILITY_IDS as readonly string[]).includes(id);
}
