// NOID-VERTICAL-1.0-VERT-02.2 (evolved by VERT-02.3)
import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  CAPABILITY_IDS,
  parsePackId,
  validateExtensionContribution,
  type ContributionOf,
  type ContributionProvenance,
} from '@/vertical/foundation';
import {
  inventoryProductRequirementsSurface,
  inventoryProductRequirementsContributionSchema,
  type InventoryProductRequirementsContribution,
} from '../inventoryProductRequirementsSurface';

const provenance: ContributionProvenance = Object.freeze({
  packId: parsePackId('alpha_pack'),
  packVersion: 'v1',
  sourcePath: 'packs/alpha/inventory-requirements.ts',
});

const validPayload: InventoryProductRequirementsContribution = {
  providerType: 'native',
  acceptedCategoryRefs: ['cat-1'],
  acceptedFamilyRefs: ['fam-1'],
  defaultUnitBasis: 'per_unit',
  labels: { title: 'Requirements' },
};

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

  it('exposes a runtime contributionSchema', () => {
    expect(inventoryProductRequirementsSurface.contributionSchema).toBe(
      inventoryProductRequirementsContributionSchema,
    );
  });

  it('accepts a valid contribution payload', () => {
    const res = validateExtensionContribution(
      inventoryProductRequirementsSurface,
      { provenance, contribution: validPayload },
    );
    expect(res.ok).toBe(true);
  });

  it.each([
    [
      'invalid providerType',
      { ...validPayload, providerType: 'nonexistent' as unknown as 'native' },
    ],
    [
      'invalid defaultUnitBasis',
      { ...validPayload, defaultUnitBasis: 'per_hour' as unknown as 'per_unit' },
    ],
    [
      'invalid acceptedCategoryRefs (empty entry)',
      { ...validPayload, acceptedCategoryRefs: [''] },
    ],
    [
      'invalid acceptedFamilyRefs (not array)',
      {
        ...validPayload,
        acceptedFamilyRefs: 'nope' as unknown as string[],
      },
    ],
    [
      'invalid labels (non-string values)',
      {
        ...validPayload,
        labels: { title: 42 } as unknown as Record<string, string>,
      },
    ],
  ])('rejects contribution with %s', (_desc, bad) => {
    const res = validateExtensionContribution(
      inventoryProductRequirementsSurface,
      { provenance, contribution: bad },
    );
    expect(res.ok).toBe(false);
  });
});
