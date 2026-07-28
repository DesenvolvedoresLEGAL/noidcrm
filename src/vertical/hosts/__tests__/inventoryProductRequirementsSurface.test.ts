// NOID-VERTICAL-1.0-VERT-02.6
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
  supportedProviderTypes: ['eventrix'],
  defaultUnitBasis: 'per_point',
  presentation: {
    consumptionExample: 'ex',
    requirementLabelPlaceholder: 'label',
    notesPlaceholder: 'notes',
  },
};

describe('inventory.product_requirements host surface (canonical)', () => {
  it('binds to the canonical capability id constant', () => {
    expect(inventoryProductRequirementsSurface.capabilityId).toBe(
      CAPABILITY_IDS.INVENTORY_PRODUCT_REQUIREMENTS,
    );
  });

  it('exposes the contribution type via ContributionOf', () => {
    type X = ContributionOf<typeof inventoryProductRequirementsSurface>;
    expectTypeOf<X>().toEqualTypeOf<InventoryProductRequirementsContribution>();
  });

  it('is frozen', () => {
    expect(Object.isFrozen(inventoryProductRequirementsSurface)).toBe(true);
  });

  it('exposes the runtime contributionSchema', () => {
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

  it('rejects the legacy reference contract (acceptedCategoryRefs / acceptedFamilyRefs)', () => {
    const legacy = {
      providerType: 'eventrix',
      acceptedCategoryRefs: ['cat-1'],
      acceptedFamilyRefs: ['fam-1'],
      defaultUnitBasis: 'per_point',
      labels: {},
    } as unknown;
    const res = validateExtensionContribution(
      inventoryProductRequirementsSurface,
      { provenance, contribution: legacy },
    );
    expect(res.ok).toBe(false);
  });

  it.each([
    [
      'empty supportedProviderTypes',
      { ...validPayload, supportedProviderTypes: [] },
    ],
    [
      'duplicate supportedProviderTypes',
      { ...validPayload, supportedProviderTypes: ['eventrix', 'eventrix'] },
    ],
    [
      'invalid provider inside supportedProviderTypes',
      { ...validPayload, supportedProviderTypes: ['nope'] as unknown as ['eventrix'] },
    ],
    [
      'invalid defaultUnitBasis',
      { ...validPayload, defaultUnitBasis: 'per_hour' as unknown as 'per_point' },
    ],
    [
      'missing consumptionExample',
      {
        ...validPayload,
        presentation: {
          requirementLabelPlaceholder: 'x',
          notesPlaceholder: 'y',
        } as unknown as InventoryProductRequirementsContribution['presentation'],
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
