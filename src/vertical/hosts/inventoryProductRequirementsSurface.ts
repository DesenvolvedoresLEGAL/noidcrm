// NOID-VERTICAL-1.0-VERT-02.6
// Canonical runtime host for the `inventory.product_requirements` capability.
//
// Lives OUTSIDE `src/vertical/foundation/**` on purpose (ADR-01 / ADR-10):
// the host may import Foundation and Inventory domain shapes; Foundation
// must never import from here.
//
// Contract (v1):
// - supportedProviderTypes: providers this Pack knows how to serve (at
//   least one, unique, subset of InventoryProviderType).
// - defaultUnitBasis: default UnitBasis for newly created requirements.
// - presentation: three vertical-specific UI strings (consumption example,
//   requirement label placeholder, notes placeholder). These are the ONLY
//   copies the Core view may render from the Pack.
//
// The previous reference contract (acceptedCategoryRefs / acceptedFamilyRefs
// / labels) has been removed: category/family IDs are dynamic tenant data
// and MUST NOT be frozen into a code-level Pack contribution.

import { z } from 'zod';
import {
  CAPABILITY_IDS,
  defineExtensionSurface,
  type ExtensionSurfaceDescriptor,
} from '@/vertical/foundation';
import { UNIT_BASIS_VALUES } from '@/inventory/requirements/unitBasis';

// Provider identity validation is scoped locally to the host — Foundation
// must not know about providers. Values kept in sync with
// `src/inventory/providers/types.ts::InventoryProviderType`.
const INVENTORY_PROVIDER_TYPE_VALUES = ['native', 'eventrix'] as const;

const unitBasisSchema = z.enum(
  UNIT_BASIS_VALUES as unknown as [
    (typeof UNIT_BASIS_VALUES)[number],
    ...(typeof UNIT_BASIS_VALUES)[number][],
  ],
);

const providerTypeSchema = z.enum(INVENTORY_PROVIDER_TYPE_VALUES);

const presentationSchema = z
  .object({
    consumptionExample: z.string().min(1),
    requirementLabelPlaceholder: z.string().min(1),
    notesPlaceholder: z.string().min(1),
  })
  .strict();

export const inventoryProductRequirementsContributionSchema = z
  .object({
    supportedProviderTypes: z
      .array(providerTypeSchema)
      .min(1, 'supportedProviderTypes must contain at least one provider')
      .refine(
        (arr) => new Set(arr).size === arr.length,
        'supportedProviderTypes must not contain duplicate providers',
      ),
    defaultUnitBasis: unitBasisSchema,
    presentation: presentationSchema,
  })
  .strict();

export type InventoryProductRequirementsContribution = z.infer<
  typeof inventoryProductRequirementsContributionSchema
>;

/**
 * Canonical descriptor for the `inventory.product_requirements` capability.
 * There MUST be exactly one object reference of this descriptor in the
 * application — Foundation Registry identity depends on it.
 */
export const inventoryProductRequirementsSurface: ExtensionSurfaceDescriptor<InventoryProductRequirementsContribution> =
  defineExtensionSurface<InventoryProductRequirementsContribution>({
    capabilityId: CAPABILITY_IDS.INVENTORY_PRODUCT_REQUIREMENTS,
    description:
      'Runtime host for Pack contributions describing product inventory requirements (supported providers, default unit basis, presentation copy).',
    contributionSchema: inventoryProductRequirementsContributionSchema,
  });
