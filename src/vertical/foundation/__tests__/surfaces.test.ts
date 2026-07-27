// NOID-VERTICAL-1.0-VERT-02.2 (evolved by VERT-02.3)
import { describe, expect, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import {
  CAPABILITY_IDS,
  defineExtensionSurface,
  declareExtensionContribution,
  parseCapabilityId,
  parsePackId,
  type ContributionOf,
  type ContributionProvenance,
  type ExtensionSurfaceDescriptor,
  type ExtensionContributionDeclaration,
} from '../index';

const alphaCapability = parseCapabilityId('demo.alpha');
const betaCapability = parseCapabilityId('demo.beta');

const alphaSchema = z
  .object({
    kind: z.literal('alpha'),
    value: z.number(),
  })
  .strict();

const betaSchema = z
  .object({
    kind: z.literal('beta'),
    label: z.string(),
  })
  .strict();

type AlphaContribution = z.infer<typeof alphaSchema>;
type BetaContribution = z.infer<typeof betaSchema>;

const alphaSurface = defineExtensionSurface<AlphaContribution>({
  capabilityId: alphaCapability,
  description: 'Synthetic alpha surface for tests',
  contributionSchema: alphaSchema,
});

const betaSurface = defineExtensionSurface<BetaContribution>({
  capabilityId: betaCapability,
  contributionSchema: betaSchema,
});

const alphaProvenance: ContributionProvenance = Object.freeze({
  packId: parsePackId('alpha_pack'),
  packVersion: 'v1',
  sourcePath: 'packs/alpha/contribution.ts',
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
        contributionSchema: alphaSchema,
      }),
    ).toThrow();
  });

  it('exposes the contributionSchema on the descriptor', () => {
    expect(alphaSurface.contributionSchema).toBe(alphaSchema);
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
  it('infers TContribution from the surface and requires provenance', () => {
    const decl = declareExtensionContribution(alphaSurface, alphaProvenance, {
      kind: 'alpha',
      value: 1,
    });
    expectTypeOf(decl.contribution).toEqualTypeOf<AlphaContribution>();
    expectTypeOf(decl.surface).toEqualTypeOf<
      ExtensionSurfaceDescriptor<AlphaContribution>
    >();
    const _typed: ExtensionContributionDeclaration<AlphaContribution> = decl;
    void _typed;
    expect(decl.surface).toBe(alphaSurface);
    expect(decl.provenance).toEqual(alphaProvenance);
    expect(decl.contribution).toEqual({ kind: 'alpha', value: 1 });
    expect(Object.isFrozen(decl)).toBe(true);
  });

  it('rejects payloads whose shape does not match the surface (compile-time)', () => {
    // beta payload cannot bind to an alpha surface
    // @ts-expect-error mismatched literal kind
    declareExtensionContribution(alphaSurface, alphaProvenance, { kind: 'beta', value: 1 });
  });

  it('declaration carries surface, provenance, contribution only', () => {
    const decl = declareExtensionContribution(alphaSurface, alphaProvenance, {
      kind: 'alpha',
      value: 1,
    });
    const keys = Object.keys(decl).sort();
    expect(keys).toEqual(['contribution', 'provenance', 'surface']);
  });
});

describe('capability binding', () => {
  it('binds surfaces to canonical Foundation capability ids', () => {
    const schema = z.object({ ok: z.literal(true) }).strict();
    const surface = defineExtensionSurface<z.infer<typeof schema>>({
      capabilityId: CAPABILITY_IDS.INVENTORY_PROPOSAL_DEMAND,
      contributionSchema: schema,
    });
    expect(surface.capabilityId).toBe(CAPABILITY_IDS.INVENTORY_PROPOSAL_DEMAND);
  });
});
