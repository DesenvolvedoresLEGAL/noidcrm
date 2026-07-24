/**
 * LEGACY COMPATIBILITY BRIDGE — Sprint NOID-VERTICAL-1.0-VERT-01.3A.
 *
 * The authoritative implementation for router / SIM concepts now lives in the
 * Connectivity Vertical Pack at `src/vertical-packs/connectivity/inventory`.
 *
 * This file re-exports those symbols and preserves the legacy tri-value
 * `EquipmentProfile` union (`generic | router | sim_card`) plus the
 * `isAllocationConfigured` helper for consumers that have not been migrated
 * yet. Nothing here duplicates schemas — everything delegates to the Pack.
 *
 * @deprecated Prefer importing directly from
 * `@/vertical-packs/connectivity/inventory` for new code. This bridge exists
 * only so existing consumers keep compiling until VERT-01.3B migrates them.
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
