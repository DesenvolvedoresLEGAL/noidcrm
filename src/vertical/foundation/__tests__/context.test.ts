// NOID-VERTICAL-1.0-VERT-02.4
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createCompositionContext,
  EMPTY_COMPOSITION_ACCESSOR,
  defineExtensionSurface,
  parseCapabilityId,
  type CompositionContext,
  type ContributionOfContext,
  type ReadonlyCompositionAccessor,
} from '../index';

const capabilityId = parseCapabilityId('test.context_surface');
const contributionSchema = z.object({ value: z.string() });
type Contribution = z.infer<typeof contributionSchema>;
const surface = defineExtensionSurface<Contribution>({
  capabilityId,
  contributionSchema,
});

const ORG = 'org-123';
const USER = 'user-456';

describe('CompositionContext factory', () => {
  it('creates context with valid ids', () => {
    const ctx = createCompositionContext({
      organizationId: ORG,
      userId: USER,
      surface,
    });
    expect(ctx.organizationId).toBe(ORG);
    expect(ctx.userId).toBe(USER);
  });

  it('defaults userId to null when omitted', () => {
    const ctx = createCompositionContext({ organizationId: ORG, surface });
    expect(ctx.userId).toBeNull();
  });

  it('defaults userId to null when null', () => {
    const ctx = createCompositionContext({
      organizationId: ORG,
      userId: null,
      surface,
    });
    expect(ctx.userId).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['surrounding whitespace', ' org '],
  ])('rejects organizationId: %s', (_label, value) => {
    expect(() =>
      createCompositionContext({ organizationId: value, surface }),
    ).toThrow(/organizationId/);
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['surrounding whitespace', ' user '],
  ])('rejects userId: %s', (_label, value) => {
    expect(() =>
      createCompositionContext({ organizationId: ORG, userId: value, surface }),
    ).toThrow(/userId/);
  });

  it('derives capabilityId from the surface', () => {
    const ctx = createCompositionContext({ organizationId: ORG, surface });
    expect(ctx.capabilityId).toBe(surface.capabilityId);
  });

  it('does not accept a caller-supplied capabilityId (type-level)', () => {
    // @ts-expect-error capabilityId is not part of the factory input
    createCompositionContext({ organizationId: ORG, surface, capabilityId });
  });

  it('preserves surface identity', () => {
    const ctx = createCompositionContext({ organizationId: ORG, surface });
    expect(ctx.surface).toBe(surface);
  });

  it('preserves the surface generic', () => {
    const ctx = createCompositionContext({ organizationId: ORG, surface });
    type Inferred = ContributionOfContext<typeof ctx>;
    const sample: Inferred = { value: 'x' };
    expect(sample.value).toBe('x');
    // Type-level assertion
    const _typed: CompositionContext<Contribution> = ctx;
    void _typed;
  });

  it('produces a frozen context', () => {
    const ctx = createCompositionContext({ organizationId: ORG, surface });
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(() => {
      (ctx as unknown as { organizationId: string }).organizationId = 'x';
    }).toThrow();
  });
});

describe('CompositionContext accessors', () => {
  it('provides a default tenantConfig that returns null', () => {
    const ctx = createCompositionContext({ organizationId: ORG, surface });
    expect(ctx.tenantConfig).toBe(EMPTY_COMPOSITION_ACCESSOR);
    expect(ctx.tenantConfig.get('anything')).toBeNull();
  });

  it('provides a default sharedDomain that returns null', () => {
    const ctx = createCompositionContext({ organizationId: ORG, surface });
    expect(ctx.sharedDomain).toBe(EMPTY_COMPOSITION_ACCESSOR);
    expect(ctx.sharedDomain.get('anything')).toBeNull();
  });

  it('EMPTY accessor is frozen and exposes no write API', () => {
    expect(Object.isFrozen(EMPTY_COMPOSITION_ACCESSOR)).toBe(true);
    expect(
      (EMPTY_COMPOSITION_ACCESSOR as unknown as { set?: unknown }).set,
    ).toBeUndefined();
  });

  it('accepts a custom tenantConfig accessor without invoking or mutating it', () => {
    let calls = 0;
    const custom: ReadonlyCompositionAccessor = {
      get(key) {
        calls += 1;
        return key === 'k' ? 'v' : null;
      },
    };
    const before = Object.getOwnPropertyNames(custom).slice();
    const ctx = createCompositionContext({
      organizationId: ORG,
      surface,
      tenantConfig: custom,
    });
    expect(ctx.tenantConfig).toBe(custom);
    expect(calls).toBe(0);
    expect(Object.getOwnPropertyNames(custom)).toEqual(before);
    expect(Object.isFrozen(custom)).toBe(false);
    expect(ctx.tenantConfig.get('k')).toBe('v');
    expect(calls).toBe(1);
  });

  it('accepts a custom sharedDomain accessor', () => {
    const custom: ReadonlyCompositionAccessor = { get: () => null };
    const ctx = createCompositionContext({
      organizationId: ORG,
      surface,
      sharedDomain: custom,
    });
    expect(ctx.sharedDomain).toBe(custom);
  });

  it('rejects a malformed accessor', () => {
    expect(() =>
      createCompositionContext({
        organizationId: ORG,
        surface,
        tenantConfig: {} as ReadonlyCompositionAccessor,
      }),
    ).toThrow(/tenantConfig/);
  });
});
