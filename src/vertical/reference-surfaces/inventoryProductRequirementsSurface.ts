// NOID-VERTICAL-1.0-VERT-02.2
// Reference-only Extension Surface declaration for the
// `inventory.product_requirements` capability.
//
// This file lives OUTSIDE `src/vertical/foundation/**` on purpose: it may
// import Foundation and reference the Inventory Product Requirements domain
// shape, but Foundation must never import from here (ADR-01 / ADR-10).
//
// This declaration is intentionally minimal. It is NOT registered anywhere
// and no runtime consumer reads from it. Its sole purpose is to prove that
// the Foundation surface contract can type a real capability without
// dragging domain knowledge back into Foundation.

import {
  CAPABILITY_IDS,
  defineExtensionSurface,
  type ExtensionSurfaceDescriptor,
} from '@/vertical/foundation';
import type { InventoryProviderType } from '@/inventory/providers/types';
import type { UnitBasis } from '@/inventory/requirements/unitBasis';

/**
 * Reference contribution shape a future Pack could contribute to the
 * `inventory.product_requirements` surface. Deliberately narrow — enough to
 * exercise the generic; not intended to replace the existing runtime domain.
 */
export interface InventoryProductRequirementsContribution {
  /** Provider whose requirement records this contribution applies to. */
  readonly providerType: InventoryProviderType;
  /** Requirement categories the contributor accepts (opaque to Foundation). */
  readonly acceptedCategoryRefs: readonly string[];
  /** Requirement families the contributor accepts (opaque to Foundation). */
  readonly acceptedFamilyRefs: readonly string[];
  /** Default unit basis this contributor advertises. */
  readonly defaultUnitBasis: UnitBasis;
  /** Optional human-readable label bundle keyed by field. */
  readonly labels?: Readonly<Record<string, string>>;
}

export const inventoryProductRequirementsSurface: ExtensionSurfaceDescriptor<InventoryProductRequirementsContribution> =
  defineExtensionSurface<InventoryProductRequirementsContribution>({
    capabilityId: CAPABILITY_IDS.INVENTORY_PRODUCT_REQUIREMENTS,
    description:
      'Reference host for Pack contributions describing product inventory requirements (provider, accepted categories/families, unit basis defaults, labels).',
  });
