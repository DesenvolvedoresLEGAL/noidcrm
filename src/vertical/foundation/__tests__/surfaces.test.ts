// NOID-VERTICAL-1.0-VERT-02.2
import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  CAPABILITY_IDS,
  defineExtensionSurface,
  declareExtensionContribution,
  parseCapabilityId,
  type ContributionOf,
  type ExtensionSurfaceDescriptor,
  type ExtensionContributionDeclaration,
} from '../index';

interface AlphaContribution {
  readonly kind: 'alpha';
  readonly value: number;
}

interface BetaContribution {
  readonly kind: 'beta';
  readonly label: string;
}

const alphaCapability = parseCapabilityId('demo.alpha');
const betaCapability = parseCapabilityId('demo.beta');

const alphaSurface = defineExtensionSurface<AlphaContribution>({
  capabilityId: alphaCapability,
  description: 'Synthetic alpha surface for tests',
});

const betaSurface = defineExtensionSurface<BetaContribution>({
  capabilityId: betaCapability,
});

describe('defineExtensionSurface', () => {
  it('returns a descriptor bound to the capability id', () => {
    expect(alphaSurface.capabilityId).toBe(alphaCapability);
    expect(alphaSurface.description).toBe('Synthetic alpha surface for tests');
  });

  it('descriptor is frozen at runtime', () => {
    expect(Object.isFrozen(alphaSurface)).toBe(true);
    expect(() => {
      // @ts-expect-error readonly property
      alphaSurface.capabilityId = betaCapability;
    }).toThrow();
  });

  it('preserves generic contribution type', () => {
    expectTypeOf(alphaSurface).toEqualTypeOf<
      ExtensionSurfaceDescriptor<AlphaContribution>
    >();
  });

  it('rejects a raw invalid string as capabilityId', () => {
    expect(() =>
      defineExtensionSurface<AlphaContribution>({
        // @ts-expect-error not a CapabilityId
        capabilityId: 'Not.Valid',
      }),
    ).toThrow();
  });

  it('descriptor does not carry PackId, version, or provenance fields', () => {
    const keys = Object.keys(alphaSurface);
    expect(keys).not.toContain('packId');
    expect(keys).not.toContain('packVersion');
    expect(keys).not.toContain('sourcePath');
    expect(keys).not.toContain('priority');
  });
});

describe('ContributionOf', () => {
  it('extracts the contribution type from a surface descriptor', () => {
    type X = ContributionOf<typeof alphaSurface>;
    expectTypeOf<X>().toEqualTypeOf<AlphaContribution>();
    type Y = ContributionOf<typeof betaSurface>;
    expectTypeOf<Y>().toEqualTypeOf<BetaContribution>();
  });
});

describe('declareExtensionContribution', () => {
  it('infers TContribution from the surface without restating the generic', () => {
    const decl = declareExtensionContribution(alphaSurface, {
      kind: 'alpha',
      value: 1,
    });
    expectTypeOf(decl.contribution).toEqualTypeOf<AlphaContribution>();
    expectTypeOf(decl.surface).toEqualTypeOf<
      ExtensionSurfaceDescriptor<AlphaContribution>
    >();
    // Runtime shape check — the declaration itself is an
    // ExtensionContributionDeclaration<AlphaContribution> at the type level,
    // even though Object.freeze wraps it as Readonly at the value level.
    const _typed: ExtensionContributionDeclaration<AlphaContribution> = decl;
    void _typed;
    expect(decl.surface).toBe(alphaSurface);
    expect(decl.contribution).toEqual({ kind: 'alpha', value: 1 });
    expect(Object.isFrozen(decl)).toBe(true);
  });

  it('rejects payloads whose shape does not match the surface', () => {
    // @ts-expect-error beta payload cannot bind to an alpha surface
    declareExtensionContribution(alphaSurface, { kind: 'beta', label: 'x' });
    // @ts-expect-error missing required alpha field
    declareExtensionContribution(alphaSurface, { kind: 'alpha' });
  });


  it('declaration does not carry provenance fields', () => {
    const decl = declareExtensionContribution(alphaSurface, {
      kind: 'alpha',
      value: 1,
    });
    const keys = Object.keys(decl);
    expect(keys.sort()).toEqual(['contribution', 'surface']);
  });
});

describe('capability binding', () => {
  it('binds surfaces to canonical Foundation capability ids', () => {
    const surface = defineExtensionSurface<{ readonly ok: true }>({
      capabilityId: CAPABILITY_IDS.INVENTORY_PROPOSAL_DEMAND,
    });
    expect(surface.capabilityId).toBe(CAPABILITY_IDS.INVENTORY_PROPOSAL_DEMAND);
  });
});
