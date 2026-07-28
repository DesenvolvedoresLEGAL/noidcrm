// NOID-VERTICAL-1.0-VERT-02.6
import { describe, expect, it } from 'vitest';
import { connectivityInventoryProductRequirementsContribution } from '../productRequirementsContribution';
import { inventoryProductRequirementsSurface } from '@/vertical/hosts/inventoryProductRequirementsSurface';

describe('Connectivity Pack — inventory.product_requirements contribution', () => {
  const decl = connectivityInventoryProductRequirementsContribution;

  it('binds to the canonical host surface descriptor identity', () => {
    expect(decl.surface).toBe(inventoryProductRequirementsSurface);
  });

  it('has PackId = connectivity and packVersion = v1', () => {
    expect(decl.provenance.packId).toBe('connectivity');
    expect(decl.provenance.packVersion).toBe('v1');
  });

  it('has a stable sourcePath pointing to this file', () => {
    expect(decl.provenance.sourcePath).toBe(
      'src/vertical-packs/connectivity/inventory/productRequirementsContribution.ts',
    );
  });

  it('supports only the eventrix provider (Native has no product_requirements capability)', () => {
    expect(decl.contribution.supportedProviderTypes).toEqual(['eventrix']);
  });

  it('defaults to unit basis per_point', () => {
    expect(decl.contribution.defaultUnitBasis).toBe('per_point');
  });

  it('preserves baseline UI copy byte-for-byte (VERT-02.6 no regression)', () => {
    expect(decl.contribution.presentation.consumptionExample).toBe(
      'A quantidade representa o consumo físico por base comercial. Ex.: 1 roteador por ponto.',
    );
    expect(decl.contribution.presentation.requirementLabelPlaceholder).toBe(
      'Ex: Roteador 5G Indoor',
    );
    expect(decl.contribution.presentation.notesPlaceholder).toBe(
      'Ex: Usado em pontos de conectividade indoor.',
    );
  });

  it('declaration and provenance are frozen', () => {
    expect(Object.isFrozen(decl)).toBe(true);
    expect(Object.isFrozen(decl.provenance)).toBe(true);
  });

  it('does not encode acceptedCategoryRefs / acceptedFamilyRefs (dynamic tenant data)', () => {
    const c = decl.contribution as Record<string, unknown>;
    expect(c.acceptedCategoryRefs).toBeUndefined();
    expect(c.acceptedFamilyRefs).toBeUndefined();
  });
});
