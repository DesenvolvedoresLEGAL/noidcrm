// NOID-VERTICAL-1.0-VERT-02.6
import { describe, expect, it, vi } from 'vitest';
import {
  InventoryProductRequirementsCompositionError,
  resolveInventoryProductRequirementsComposition,
} from '../inventoryProductRequirementsComposition';
import {
  declareExtensionContribution,
  EMPTY_COMPOSITION_ACCESSOR,
  parsePackId,
} from '@/vertical/foundation';
import { inventoryProductRequirementsSurface } from '@/vertical/hosts/inventoryProductRequirementsSurface';

describe('resolveInventoryProductRequirementsComposition', () => {
  it('returns providerSupported=true for eventrix + baseline copy', () => {
    const policy = resolveInventoryProductRequirementsComposition({
      organizationId: 'org-1',
      activeProviderType: 'eventrix',
    });
    expect(policy.providerSupportedByPack).toBe(true);
    expect(policy.defaultUnitBasis).toBe('per_point');
    expect(policy.presentation.consumptionExample).toBe(
      'A quantidade representa o consumo físico por base comercial. Ex.: 1 roteador por ponto.',
    );
    expect(policy.presentation.requirementLabelPlaceholder).toBe(
      'Ex: Roteador 5G Indoor',
    );
    expect(policy.presentation.notesPlaceholder).toBe(
      'Ex: Usado em pontos de conectividade indoor.',
    );
  });

  it('returns providerSupported=false for native provider', () => {
    const policy = resolveInventoryProductRequirementsComposition({
      organizationId: 'org-1',
      activeProviderType: 'native',
    });
    expect(policy.providerSupportedByPack).toBe(false);
    // presentation still available for layout stability
    expect(policy.presentation.consumptionExample.length).toBeGreaterThan(0);
  });

  it('returns providerSupported=false when active provider is null/loading', () => {
    const policy = resolveInventoryProductRequirementsComposition({
      organizationId: 'org-1',
      activeProviderType: null,
    });
    expect(policy.providerSupportedByPack).toBe(false);
  });

  it('accepts null userId', () => {
    expect(() =>
      resolveInventoryProductRequirementsComposition({
        organizationId: 'org-1',
        userId: null,
        activeProviderType: 'eventrix',
      }),
    ).not.toThrow();
  });

  it('freezes the returned policy', () => {
    const policy = resolveInventoryProductRequirementsComposition({
      organizationId: 'org-1',
      activeProviderType: 'eventrix',
    });
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.presentation)).toBe(true);
  });

  it('rejects >1 applicable contributions with a sanitized error (no silent precedence)', () => {
    const alpha = declareExtensionContribution(
      inventoryProductRequirementsSurface,
      {
        packId: parsePackId('alpha_pack'),
        packVersion: 'v1',
        sourcePath: 'test/alpha.ts',
      },
      {
        supportedProviderTypes: ['eventrix'],
        defaultUnitBasis: 'per_event',
        presentation: {
          consumptionExample: 'a',
          requirementLabelPlaceholder: 'b',
          notesPlaceholder: 'c',
        },
      },
    );
    expect(() =>
      resolveInventoryProductRequirementsComposition({
        organizationId: 'org-1',
        activeProviderType: 'eventrix',
        _extraContributions: [alpha],
      }),
    ).toThrowError(InventoryProductRequirementsCompositionError);
  });

  it('multiple-applicable error carries only PackId identifiers (no payload leak)', () => {
    const alpha = declareExtensionContribution(
      inventoryProductRequirementsSurface,
      {
        packId: parsePackId('alpha_pack'),
        packVersion: 'v1',
        sourcePath: 'test/alpha.ts',
      },
      {
        supportedProviderTypes: ['eventrix'],
        defaultUnitBasis: 'per_event',
        presentation: {
          consumptionExample: 'SECRET-a',
          requirementLabelPlaceholder: 'SECRET-b',
          notesPlaceholder: 'SECRET-c',
        },
      },
    );
    try {
      resolveInventoryProductRequirementsComposition({
        organizationId: 'org-1',
        activeProviderType: 'eventrix',
        _extraContributions: [alpha],
      });
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as InventoryProductRequirementsCompositionError;
      expect(e.code).toBe(
        'multiple_applicable_product_requirement_contributions',
      );
      expect([...e.packIds].sort()).toEqual(['alpha_pack', 'connectivity']);
      expect(e.message).not.toContain('SECRET');
    }
  });

  it('creates a fresh Registry per call (no shared state between invocations)', () => {
    // Two consecutive calls succeed independently — no "already registered".
    resolveInventoryProductRequirementsComposition({
      organizationId: 'org-1',
      activeProviderType: 'eventrix',
    });
    expect(() =>
      resolveInventoryProductRequirementsComposition({
        organizationId: 'org-2',
        activeProviderType: 'eventrix',
      }),
    ).not.toThrow();
  });
});
