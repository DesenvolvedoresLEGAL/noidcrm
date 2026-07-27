// NOID-VERTICAL-1.0-VERT-02.2 (evolved by VERT-02.3)
// Reference-only Extension Surface declaration for the
// `inventory.product_requirements` capability.
//
// Lives OUTSIDE `src/vertical/foundation/**` on purpose: may import
// Foundation and Inventory domain shapes, but Foundation must never import
// from here (ADR-01 / ADR-10).
//
// VERT-02.3 adds a runtime contributionSchema. Still not registered anywhere,
// still no runtime consumer — proves that a real capability can be typed AND
// validated through the Foundation contract without dragging domain
// knowledge back into Foundation.

import { z } from 'zod';
import {
  CAPABILITY_IDS,
  defineExtensionSurface,
  type ExtensionSurfaceDescriptor,
} from '@/vertical/foundation';
import { UNIT_BASIS_VALUES } from '@/inventory/requirements/unitBasis';

// Provider identity validation is scoped locally to this reference surface —
// Foundation must not know about providers, and the existing provider type
// module intentionally exports only TypeScript types. Values kept in sync
// with `src/inventory/providers/types.ts::InventoryProviderType`.
const INVENTORY_PROVIDER_TYPE_VALUES = ['native', 'eventrix'] as const;

const unitBasisSchema = z.enum(
  UNIT_BASIS_VALUES as unknown as [
    (typeof UNIT_BASIS_VALUES)[number],
    ...(typeof UNIT_BASIS_VALUES)[number][],
  ],
);

const providerTypeSchema = z.enum(INVENTORY_PROVIDER_TYPE_VALUES);

export const inventoryProductRequirementsContributionSchema = z
  .object({
    providerType: providerTypeSchema,
    acceptedCategoryRefs: z.array(z.string().min(1)),
    acceptedFamilyRefs: z.array(z.string().min(1)),
    defaultUnitBasis: unitBasisSchema,
    labels: z.record(z.string(), z.string()).optional(),
  })
  .strict();

/**
 * Reference contribution shape a future Pack could contribute to the
 * `inventory.product_requirements` surface. Inferred from the runtime schema
 * to guarantee single-source-of-truth between type and validator.
 */
export type InventoryProductRequirementsContribution = z.infer<
  typeof inventoryProductRequirementsContributionSchema
>;

export const inventoryProductRequirementsSurface: ExtensionSurfaceDescriptor<InventoryProductRequirementsContribution> =
  defineExtensionSurface<InventoryProductRequirementsContribution>({
    capabilityId: CAPABILITY_IDS.INVENTORY_PRODUCT_REQUIREMENTS,
    description:
      'Reference host for Pack contributions describing product inventory requirements (provider, accepted categories/families, unit basis defaults, labels).',
    contributionSchema: inventoryProductRequirementsContributionSchema,
  });
