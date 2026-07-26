// NOID-VERTICAL-1.0-VERT-02.2
import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  CAPABILITY_IDS,
  type ContributionOf,
} from '@/vertical/foundation';
import {
  inventoryProductRequirementsSurface,
  type InventoryProductRequirementsContribution,
} from '../inventoryProductRequirementsSurface';

describe('inventory.product_requirements reference surface', () => {
  it('binds to the canonical capability id constant', () => {
    expect(inventoryProductRequirementsSurface.capabilityId).toBe(
      CAPABILITY_IDS.INVENTORY_PRODUCT_REQUIREMENTS,
    );
  });

  it('exposes the reference contribution type via ContributionOf', () => {
    type X = ContributionOf<typeof inventoryProductRequirementsSurface>;
    expectTypeOf<X>().toEqualTypeOf<InventoryProductRequirementsContribution>();
  });

  it('is frozen', () => {
    expect(Object.isFrozen(inventoryProductRequirementsSurface)).toBe(true);
  });

  it('does not encode PackId or provenance on the descriptor', () => {
    const keys = Object.keys(inventoryProductRequirementsSurface);
    expect(keys).not.toContain('packId');
    expect(keys).not.toContain('packVersion');
    expect(keys).not.toContain('sourcePath');
    expect(keys).not.toContain('priority');
  });
});
