// NOID-VERTICAL-1.0-VERT-02.5
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createExtensionRegistry,
  defineExtensionSurface,
  declareExtensionContribution,
  createCompositionContext,
  parseCapabilityId,
  parsePackId,
  ExtensionRegistryError,
  ExtensionContributionValidationError,
  type ReadonlyCompositionAccessor,
} from '../index';

const CAP_A = parseCapabilityId('alpha.one');
const CAP_B = parseCapabilityId('beta.two');

const schemaA = z.object({ label: z.string().min(1) }).strict();
type ContribA = z.infer<typeof schemaA>;

function makeSurfaceA() {
  return defineExtensionSurface<ContribA>({
    capabilityId: CAP_A,
    contributionSchema: schemaA,
  });
}

function prov(packId: string, extra: Partial<{ packVersion: string; sourcePath: string }> = {}) {
  return {
    packId: parsePackId(packId),
    packVersion: extra.packVersion ?? '1.0.0',
    sourcePath: extra.sourcePath ?? `packs/${packId}/index.ts`,
  };
}

describe('VERT-02.5 registry — surface registration', () => {
  it('starts empty and instances are independent', () => {
    const r1 = createExtensionRegistry();
    const r2 = createExtensionRegistry();
    r1.registerSurface(makeSurfaceA());
    expect(r1.hasSurface(CAP_A)).toBe(true);
    expect(r2.hasSurface(CAP_A)).toBe(false);
  });

  it('preserves descriptor identity via getSurface', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    expect(r.getSurface(CAP_A)).toBe(s);
    expect(r.getSurface(CAP_B)).toBeNull();
  });

  it('rejects duplicate surface (same reference)', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    expect(() => r.registerSurface(s)).toThrow(ExtensionRegistryError);
  });

  it('rejects a second surface with the same capabilityId', () => {
    const r = createExtensionRegistry();
    r.registerSurface(makeSurfaceA());
    expect(() => r.registerSurface(makeSurfaceA())).toThrowError(
      /surface_already_registered|already registered/,
    );
  });

  it('rejects invalid descriptor input', () => {
    const r = createExtensionRegistry();
    expect(() => r.registerSurface({} as never)).toThrow(ExtensionRegistryError);
  });
});

describe('VERT-02.5 registry — contribution registration', () => {
  it('registers a valid contribution', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    const decl = declareExtensionContribution(s, prov('alpha_pack'), { label: 'x' });
    r.registerContribution(decl);
    const ctx = createCompositionContext({ organizationId: 'org', surface: s });
    expect(r.resolve(ctx).contributions).toHaveLength(1);
  });

  it('rejects contribution for unregistered surface', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    const decl = declareExtensionContribution(s, prov('alpha_pack'), { label: 'x' });
    expect(() => r.registerContribution(decl)).toThrowError(/not_registered|not registered/);
  });

  it('rejects contribution whose descriptor is a different instance', () => {
    const r = createExtensionRegistry();
    const registered = makeSurfaceA();
    r.registerSurface(registered);
    const other = makeSurfaceA();
    const decl = declareExtensionContribution(other, prov('alpha_pack'), { label: 'x' });
    expect(() => r.registerContribution(decl)).toThrowError(/descriptor_mismatch|does not match/);
  });

  it('re-validates contribution shape at boundary', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    // Forge a declaration that bypassed the type-level check.
    const bad = {
      surface: s,
      provenance: prov('alpha_pack'),
      contribution: { label: '' }, // fails min(1)
    } as never;
    expect(() => r.registerContribution(bad)).toThrow(
      ExtensionContributionValidationError,
    );
  });

  it('rejects duplicate same-pack contribution on same surface', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    r.registerContribution(declareExtensionContribution(s, prov('alpha_pack'), { label: 'a' }));
    expect(() =>
      r.registerContribution(
        declareExtensionContribution(s, prov('alpha_pack', { packVersion: '2.0.0' }), { label: 'b' }),
      ),
    ).toThrowError(/duplicate_pack_contribution|already contributes/);
  });

  it('allows same Pack to contribute to different surfaces', () => {
    const r = createExtensionRegistry();
    const sA = makeSurfaceA();
    const sB = defineExtensionSurface<ContribA>({
      capabilityId: CAP_B,
      contributionSchema: schemaA,
    });
    r.registerSurface(sA);
    r.registerSurface(sB);
    r.registerContribution(declareExtensionContribution(sA, prov('alpha_pack'), { label: 'a' }));
    r.registerContribution(declareExtensionContribution(sB, prov('alpha_pack'), { label: 'b' }));
    expect(r.resolve(createCompositionContext({ organizationId: 'o', surface: sA })).contributions).toHaveLength(1);
    expect(r.resolve(createCompositionContext({ organizationId: 'o', surface: sB })).contributions).toHaveLength(1);
  });

  it('allows multiple Packs on the same surface (ADR-02)', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    r.registerContribution(declareExtensionContribution(s, prov('alpha_pack'), { label: 'a' }));
    r.registerContribution(declareExtensionContribution(s, prov('beta_pack'), { label: 'b' }));
    r.registerContribution(declareExtensionContribution(s, prov('gamma_pack'), { label: 'g' }));
    const res = r.resolve(createCompositionContext({ organizationId: 'o', surface: s }));
    expect(res.contributions).toHaveLength(3);
  });
});

describe('VERT-02.5 registry — deterministic order', () => {
  function seed(order: string[]) {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    for (const p of order) {
      r.registerContribution(declareExtensionContribution(s, prov(p), { label: p }));
    }
    const ctx = createCompositionContext({ organizationId: 'o', surface: s });
    return r.resolve(ctx).contributions.map((c) => c.provenance.packId);
  }

  it('orders by ascending PackId regardless of registration order', () => {
    expect(seed(['gamma_pack', 'alpha_pack', 'beta_pack'])).toEqual([
      'alpha_pack', 'beta_pack', 'gamma_pack',
    ]);
    expect(seed(['beta_pack', 'gamma_pack', 'alpha_pack'])).toEqual([
      'alpha_pack', 'beta_pack', 'gamma_pack',
    ]);
  });

  it('packVersion / sourcePath do not affect order', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    r.registerContribution(
      declareExtensionContribution(s, prov('gamma_pack', { packVersion: '0.0.1', sourcePath: 'z/z' }), { label: 'g' }),
    );
    r.registerContribution(
      declareExtensionContribution(s, prov('alpha_pack', { packVersion: '9.9.9', sourcePath: 'a/a' }), { label: 'a' }),
    );
    const res = r.resolve(createCompositionContext({ organizationId: 'o', surface: s }));
    expect(res.contributions.map((c) => c.provenance.packId)).toEqual(['alpha_pack', 'gamma_pack']);
  });
});

describe('VERT-02.5 resolver', () => {
  it('empty registered surface resolves to []', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    const res = r.resolve(createCompositionContext({ organizationId: 'o', surface: s }));
    expect(res.contributions).toEqual([]);
    expect(res.capabilityId).toBe(CAP_A);
    expect(res.surface).toBe(s);
  });

  it('unregistered surface rejects', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    expect(() =>
      r.resolve(createCompositionContext({ organizationId: 'o', surface: s })),
    ).toThrowError(/surface_not_registered|not registered/);
  });

  it('rejects forged context whose surface descriptor mismatches registered', () => {
    const r = createExtensionRegistry();
    const registered = makeSurfaceA();
    r.registerSurface(registered);
    const other = makeSurfaceA();
    expect(() =>
      r.resolve(createCompositionContext({ organizationId: 'o', surface: other })),
    ).toThrowError(/descriptor_mismatch|does not match/);
  });

  it('rejects forged context with capabilityId/surface mismatch', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    const forged = { ...createCompositionContext({ organizationId: 'o', surface: s }), capabilityId: CAP_B };
    expect(() => r.resolve(forged as never)).toThrowError(/context_surface_mismatch/);
  });

  it('preserves context identity in result', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    const ctx = createCompositionContext({ organizationId: 'o', surface: s });
    const res = r.resolve(ctx);
    expect(res.context).toBe(ctx);
  });

  it('result and contributions are frozen', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    r.registerContribution(declareExtensionContribution(s, prov('alpha_pack'), { label: 'a' }));
    const res = r.resolve(createCompositionContext({ organizationId: 'o', surface: s }));
    expect(Object.isFrozen(res)).toBe(true);
    expect(Object.isFrozen(res.contributions)).toBe(true);
    expect(() => {
      (res.contributions as unknown as unknown[]).push({} as never);
    }).toThrow();
  });

  it('mutating returned array does not affect subsequent resolves', () => {
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    r.registerContribution(declareExtensionContribution(s, prov('alpha_pack'), { label: 'a' }));
    const ctx = createCompositionContext({ organizationId: 'o', surface: s });
    const first = r.resolve(ctx);
    try { (first.contributions as unknown as unknown[]).length = 0; } catch { /* frozen */ }
    const second = r.resolve(ctx);
    expect(second.contributions).toHaveLength(1);
  });

  it('does not invoke tenantConfig / sharedDomain accessors', () => {
    const tenantGet = vi.fn(() => null);
    const sharedGet = vi.fn(() => null);
    const tenantConfig: ReadonlyCompositionAccessor = { get: tenantGet };
    const sharedDomain: ReadonlyCompositionAccessor = { get: sharedGet };
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    r.registerContribution(declareExtensionContribution(s, prov('alpha_pack'), { label: 'a' }));
    const ctx = createCompositionContext({ organizationId: 'o', surface: s, tenantConfig, sharedDomain });
    r.resolve(ctx);
    expect(tenantGet).not.toHaveBeenCalled();
    expect(sharedGet).not.toHaveBeenCalled();
  });

  it('does not execute contribution payload functions', () => {
    const spy = vi.fn();
    type Fn = { run: () => void };
    const schemaFn: z.ZodType<Fn> = z.object({
      run: z.custom<() => void>((v) => typeof v === 'function'),
    }) as unknown as z.ZodType<Fn>;
    const s = defineExtensionSurface<Fn>({
      capabilityId: parseCapabilityId('exec.probe'),
      contributionSchema: schemaFn,
    });
    const r = createExtensionRegistry();
    r.registerSurface(s);
    r.registerContribution(declareExtensionContribution(s, prov('alpha_pack'), { run: spy }));
    r.resolve(createCompositionContext({ organizationId: 'o', surface: s }));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('VERT-02.5 registry — no payload leak', () => {
  it('duplicate error does not include contribution payload', () => {
    const marker = 'ZZ_SECRET_MARKER_ZZ';
    const r = createExtensionRegistry();
    const s = makeSurfaceA();
    r.registerSurface(s);
    r.registerContribution(declareExtensionContribution(s, prov('alpha_pack'), { label: marker }));
    try {
      r.registerContribution(declareExtensionContribution(s, prov('alpha_pack'), { label: marker }));
      throw new Error('should have thrown');
    } catch (e) {
      const err = e as ExtensionRegistryError;
      expect(err).toBeInstanceOf(ExtensionRegistryError);
      expect(err.message).not.toContain(marker);
      expect(JSON.stringify({ code: err.code, capabilityId: err.capabilityId, packId: err.packId })).not.toContain(marker);
    }
  });
});

describe('VERT-02.5 registry — internals not exposed', () => {
  it('has no default/singleton export', async () => {
    const mod = await import('../registry');
    expect((mod as Record<string, unknown>).default).toBeUndefined();
    expect((mod as Record<string, unknown>).registry).toBeUndefined();
  });

  it('does not expose a merge / priority API', () => {
    const r = createExtensionRegistry() as unknown as Record<string, unknown>;
    expect(r.merge).toBeUndefined();
    expect(r.mergeContribution).toBeUndefined();
    expect(r.priority).toBeUndefined();
    expect(r.unregister).toBeUndefined();
  });
});
