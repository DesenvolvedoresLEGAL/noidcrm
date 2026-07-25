/**
 * LEGACY COMPATIBILITY BRIDGE — ZERO ACTIVE RUNTIME CONSUMERS.
 *
 * Sprints: NOID-VERTICAL-1.0-VERT-01.3A → VERT-01.3B1 → VERT-01.3B2.
 *
 * As of VERT-01.3B2, both the Inventory Catalog and Allocation flows import
 * the connectivity domain directly from the Connectivity Vertical Pack at
 * `src/vertical-packs/connectivity/inventory`. This bridge no longer has any
 * runtime consumer inside `src/` — only its own regression test file imports
 * from here to guarantee backwards-compatible re-exports for external callers.
 *
 * @deprecated Do NOT import from this module in new code. Import from
 * `@/vertical-packs/connectivity/inventory` instead. The bridge is kept
 * intentionally as a compatibility artifact and may be removed in a future
 * GREEN cleanup sprint.
 */

import {
  CONNECTIVITY_EQUIPMENT_PROFILE_LABELS,
  CONNECTIVITY_EQUIPMENT_PROFILE_OPTIONS,
  hasRouterCustom,
  hasSimCustom,
  isConnectivityEquipmentProfile,
  type ConnectivityEquipmentProfile,
} from '@/vertical-packs/connectivity/inventory';

// Re-export the Connectivity Pack surface verbatim.
export {
  SIM_CARRIERS,
  routerFactorySchema,
  simCardFactorySchema,
  routerCustomSchema,
  simCardCustomSchema,
  getRouterFactory,
  getSimCardFactory,
  getRouterCustom,
  getSimCardCustom,
  hasRouterCustom,
  hasSimCustom,
  mergeFactoryRouter,
  mergeFactorySim,
  isConnectivityProfileConfigured,
  isConnectivityEquipmentProfile,
  type RouterFactory,
  type SimCardFactory,
  type RouterCustom,
  type SimCardCustom,
  type ConnectivityEquipmentProfile,
} from '@/vertical-packs/connectivity/inventory';

/**
 * Legacy union: `generic` is the Core-neutral fallback; `router` / `sim_card`
 * are Connectivity Pack profiles kept in the union for backwards compatibility.
 * @deprecated New code should distinguish between the Core-generic case
 * (absence of a connectivity profile) and `ConnectivityEquipmentProfile`.
 */
export type EquipmentProfile = 'generic' | ConnectivityEquipmentProfile;

/** @deprecated Composed from Core-generic + Connectivity Pack labels. */
export const EQUIPMENT_PROFILE_LABELS: Record<EquipmentProfile, string> = {
  generic: 'Genérico',
  ...CONNECTIVITY_EQUIPMENT_PROFILE_LABELS,
};

/** @deprecated Composed from Core-generic + Connectivity Pack options. */
export const EQUIPMENT_PROFILE_OPTIONS: { value: EquipmentProfile; label: string }[] = [
  { value: 'generic', label: EQUIPMENT_PROFILE_LABELS.generic },
  ...CONNECTIVITY_EQUIPMENT_PROFILE_OPTIONS,
];

/**
 * @deprecated Preserve behaviour: anything that is not a connectivity profile
 * collapses to the Core-generic bucket.
 */
export function getEquipmentProfile(value: unknown): EquipmentProfile {
  return isConnectivityEquipmentProfile(value) ? value : 'generic';
}

/**
 * @deprecated Mixed Core+Pack helper kept for legacy consumers. Prefer
 * `isConnectivityProfileConfigured` from the Connectivity Pack and treat the
 * generic branch at the call site.
 */
export function isAllocationConfigured(
  profile: EquipmentProfile,
  customConfig: unknown,
): boolean {
  if (profile === 'router') return hasRouterCustom(customConfig);
  if (profile === 'sim_card') return hasSimCustom(customConfig);
  return true;
}
