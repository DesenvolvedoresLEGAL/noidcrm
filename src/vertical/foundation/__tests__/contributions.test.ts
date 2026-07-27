// NOID-VERTICAL-1.0-VERT-02.3
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  defineExtensionSurface,
  declareExtensionContribution,
  validateExtensionContribution,
  safeDeclareExtensionContribution,
  parseContributionProvenance,
  safeParseContributionProvenance,
  contributionProvenanceSchema,
  ExtensionContributionValidationError,
  parseCapabilityId,
  parsePackId,
  type ContributionProvenance,
  type ContributionValidationDiagnostic,
  type ExtensionContributionValidationResult,
} from '../index';

// TS discriminated-union narrowing on `!res.ok` is unreliable for the
// generic result shape, so tests pull the diagnostic through a small helper.
function expectFailure<T>(
  res: ExtensionContributionValidationResult<T>,
): ContributionValidationDiagnostic {
  if (res.ok) throw new Error('expected validation failure');
  return (
    res as { readonly ok: false; readonly diagnostic: ContributionValidationDiagnostic }
  ).diagnostic;
}

function expectSuccess<T>(res: ExtensionContributionValidationResult<T>) {
  if (!res.ok) throw new Error('expected validation success');
  return (res as { readonly ok: true; readonly declaration: never & { surface: unknown; provenance: ContributionProvenance; contribution: T } }).declaration;
}

const capability = parseCapabilityId('demo.contrib');

const schema = z
  .object({
    kind: z.literal('sample'),
    value: z.number().int().nonnegative(),
    tags: z.array(z.string().min(1)),
  })
  .strict();
type Sample = z.infer<typeof schema>;

const surface = defineExtensionSurface<Sample>({
  capabilityId: capability,
  contributionSchema: schema,
});

const validProvenance: ContributionProvenance = Object.freeze({
  packId: parsePackId('alpha_pack'),
  packVersion: 'v1',
  sourcePath: 'packs/alpha/contribution.ts',
});

describe('ContributionProvenance parsing', () => {
  it('accepts valid provenance', () => {
    const p = parseContributionProvenance({
      packId: 'alpha_pack',
      packVersion: 'v1',
      sourcePath: 'packs/alpha/contribution.ts',
    });
    expect(p.packId).toBe('alpha_pack');
    expect(p.packVersion).toBe('v1');
    expect(p.sourcePath).toBe('packs/alpha/contribution.ts');
    expect(Object.isFrozen(p)).toBe(true);
  });

  it.each([
    ['', 'empty packVersion'],
    ['   ', 'whitespace-only packVersion'],
    [' v1', 'surrounding whitespace packVersion'],
    ['v1 ', 'trailing whitespace packVersion'],
  ])('rejects invalid packVersion: %j (%s)', (packVersion) => {
    const res = safeParseContributionProvenance({
      packId: 'alpha_pack',
      packVersion,
      sourcePath: 'x.ts',
    });
    expect(res.success).toBe(false);
  });

  it.each([
    ['', 'empty sourcePath'],
    ['   ', 'whitespace-only sourcePath'],
    [' x.ts', 'leading whitespace'],
    ['x.ts ', 'trailing whitespace'],
  ])('rejects invalid sourcePath: %j (%s)', (sourcePath) => {
    const res = safeParseContributionProvenance({
      packId: 'alpha_pack',
      packVersion: 'v1',
      sourcePath,
    });
    expect(res.success).toBe(false);
  });

  it('accepts sourcePath containing slashes / dots / dashes / underscores', () => {
    const res = safeParseContributionProvenance({
      packId: 'alpha_pack',
      packVersion: 'v1',
      sourcePath: 'packs/alpha-pack/sub_dir/file.ts',
    });
    expect(res.success).toBe(true);
  });

  it('rejects invalid PackId', () => {
    const res = safeParseContributionProvenance({
      packId: 'Not Valid',
      packVersion: 'v1',
      sourcePath: 'x.ts',
    });
    expect(res.success).toBe(false);
  });

  it('rejects extra fields (strict)', () => {
    const res = contributionProvenanceSchema.safeParse({
      packId: 'alpha_pack',
      packVersion: 'v1',
      sourcePath: 'x.ts',
      priority: 1,
    });
    expect(res.success).toBe(false);
  });

  it('does not normalise packVersion or sourcePath', () => {
    const p = parseContributionProvenance({
      packId: 'alpha_pack',
      packVersion: '2026-07-27T00:00:00Z',
      sourcePath: 'packs/alpha/File.TS',
    });
    expect(p.packVersion).toBe('2026-07-27T00:00:00Z');
    expect(p.sourcePath).toBe('packs/alpha/File.TS');
  });
});

describe('validateExtensionContribution — safe API', () => {
  it('returns ok:true with a frozen declaration for a valid payload', () => {
    const res = validateExtensionContribution(surface, {
      provenance: validProvenance,
      contribution: { kind: 'sample', value: 3, tags: ['a', 'b'] },
    });
    expect(res.ok).toBe(true);
    const decl = expectSuccess(res);
    expect(decl.surface).toBe(surface);
    expect(decl.provenance.packId).toBe('alpha_pack');
    expect(decl.contribution).toEqual({
      kind: 'sample',
      value: 3,
      tags: ['a', 'b'],
    });
    expect(Object.isFrozen(decl)).toBe(true);
    expect(Object.isFrozen(decl.provenance)).toBe(true);
  });

  it('returns ok:false with invalid_provenance when provenance is broken', () => {
    const res = validateExtensionContribution(surface, {
      provenance: { packId: 'BAD', packVersion: '', sourcePath: '' },
      contribution: { kind: 'sample', value: 1, tags: [] },
    });
    const d = expectFailure(res);
    expect(d.code).toBe('invalid_provenance');
    expect(d.capabilityId).toBe(capability);
    expect(d.packId).toBeUndefined();
    expect(d.packVersion).toBeUndefined();
    expect(d.sourcePath).toBeUndefined();
    expect(d.issues.length).toBeGreaterThan(0);
    for (const issue of d.issues) {
      expect(Array.isArray(issue.path)).toBe(true);
      expect(typeof issue.code).toBe('string');
      expect(typeof issue.message).toBe('string');
    }
    expect(Object.isFrozen(d)).toBe(true);
  });

  it('returns ok:false with invalid_contribution and tags provenance', () => {
    const res = validateExtensionContribution(surface, {
      provenance: validProvenance,
      contribution: { kind: 'other', value: -1, tags: [''] },
    });
    const d = expectFailure(res);
    expect(d.code).toBe('invalid_contribution');
    expect(d.packId).toBe('alpha_pack');
    expect(d.packVersion).toBe('v1');
    expect(d.sourcePath).toBe('packs/alpha/contribution.ts');
    expect(d.issues.length).toBeGreaterThan(0);
  });

  it('does not leak raw contribution or raw input in diagnostics', () => {
    const secret = 'SECRET-PAYLOAD-MARKER';
    const res = validateExtensionContribution(surface, {
      provenance: validProvenance,
      contribution: { kind: 'other', value: 'x', tags: secret },
    });
    const d = expectFailure(res);
    const serialized = JSON.stringify(d);
    expect(serialized.includes(secret)).toBe(false);
    for (const issue of d.issues) {
      expect(issue.message.includes(secret)).toBe(false);
    }
  });

  it('does not throw for non-object input', () => {
    expect(() => validateExtensionContribution(surface, null)).not.toThrow();
    const res = validateExtensionContribution(surface, 42);
    expect(res.ok).toBe(false);
  });

  it('exposes the same behaviour under safeDeclareExtensionContribution alias', () => {
    const res = safeDeclareExtensionContribution(surface, {
      provenance: validProvenance,
      contribution: { kind: 'sample', value: 0, tags: [] },
    });
    expect(res.ok).toBe(true);
  });
});

describe('declareExtensionContribution — throwing API', () => {
  it('returns a frozen declaration for valid input', () => {
    const decl = declareExtensionContribution(surface, validProvenance, {
      kind: 'sample',
      value: 1,
      tags: ['t'],
    });
    expect(decl.provenance).toEqual(validProvenance);
    expect(Object.isFrozen(decl)).toBe(true);
  });

  it('throws a typed error carrying a sanitized diagnostic', () => {
    let caught: unknown;
    try {
      declareExtensionContribution(
        surface,
        { ...validProvenance, packVersion: '' } as ContributionProvenance,
        { kind: 'sample', value: 1, tags: [] },
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ExtensionContributionValidationError);
    const err = caught as ExtensionContributionValidationError;
    expect(err.diagnostic.code).toBe('invalid_provenance');
    expect(err.diagnostic.capabilityId).toBe(capability);
  });

  it('does not deep-freeze the contribution payload', () => {
    const payload = { kind: 'sample' as const, value: 1, tags: ['a'] };
    const decl = declareExtensionContribution(surface, validProvenance, payload);
    expect(Object.isFrozen(decl)).toBe(true);
    expect(Object.isFrozen(decl.contribution)).toBe(false);
  });
});
