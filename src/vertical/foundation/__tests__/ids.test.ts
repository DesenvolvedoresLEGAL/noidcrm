// NOID-VERTICAL-1.0-VERT-02.1
import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  parseVerticalId,
  parsePackId,
  parseCapabilityId,
  safeParseVerticalId,
  safeParsePackId,
  safeParseCapabilityId,
  isVerticalId,
  isPackId,
  isCapabilityId,
  type VerticalId,
  type PackId,
  type CapabilityId,
} from '../ids';

describe('branded identifier types', () => {
  it('parseVerticalId returns a VerticalId assignable to string', () => {
    const v = parseVerticalId('alpha');
    expectTypeOf(v).toEqualTypeOf<VerticalId>();
    const s: string = v;
    expect(s).toBe('alpha');
  });

  it('parsePackId returns a PackId', () => {
    const p = parsePackId('alpha_2');
    expectTypeOf(p).toEqualTypeOf<PackId>();
    expect(String(p)).toBe('alpha_2');
  });

  it('parseCapabilityId returns a CapabilityId', () => {
    const c = parseCapabilityId('inventory.product_requirements');
    expectTypeOf(c).toEqualTypeOf<CapabilityId>();
    expect(String(c)).toBe('inventory.product_requirements');
  });

  it('VerticalId, PackId, CapabilityId are mutually distinct at the type level', () => {
    // @ts-expect-error VerticalId is not assignable to PackId
    const _a: PackId = parseVerticalId('alpha');
    // @ts-expect-error VerticalId is not assignable to CapabilityId
    const _b: CapabilityId = parseVerticalId('alpha');
    // @ts-expect-error PackId is not assignable to CapabilityId
    const _c: CapabilityId = parsePackId('alpha');
    // @ts-expect-error PackId is not assignable to VerticalId
    const _d: VerticalId = parsePackId('alpha');
    // @ts-expect-error CapabilityId is not assignable to VerticalId
    const _e: VerticalId = parseCapabilityId('domain.cap');
    // @ts-expect-error CapabilityId is not assignable to PackId
    const _f: PackId = parseCapabilityId('domain.cap');
    void [_a, _b, _c, _d, _e, _f];
  });
});

describe('machine identifier syntax (VerticalId / PackId)', () => {
  const valid = ['alpha', 'alpha_2', 'a', 'a_b_c', 'x1'];
  const invalid = ['', 'Alpha', 'al pha', 'al-pha', 'al.pha', 'al/pha', 'a__b'.replace('__', '  ')];

  it.each(valid)('accepts %s as VerticalId', (v) => {
    expect(() => parseVerticalId(v)).not.toThrow();
    expect(isVerticalId(v)).toBe(true);
  });

  it.each(valid)('accepts %s as PackId', (v) => {
    expect(() => parsePackId(v)).not.toThrow();
    expect(isPackId(v)).toBe(true);
  });

  it.each(invalid)('rejects %j as VerticalId', (v) => {
    expect(safeParseVerticalId(v).success).toBe(false);
    expect(isVerticalId(v)).toBe(false);
  });

  it.each(invalid)('rejects %j as PackId', (v) => {
    expect(safeParsePackId(v).success).toBe(false);
    expect(isPackId(v)).toBe(false);
  });

  it('does not normalise invalid input', () => {
    expect(safeParseVerticalId('My-Pack').success).toBe(false);
    expect(safeParsePackId(' alpha ').success).toBe(false);
  });
});

describe('capability id syntax', () => {
  it('accepts canonical two-segment ids', () => {
    expect(() => parseCapabilityId('inventory.product_requirements')).not.toThrow();
    expect(() => parseCapabilityId('roleplay.archetype_types')).not.toThrow();
  });

  const invalid = [
    'inventory',
    'inventory.',
    '.product_requirements',
    'inventory..product_requirements',
    'Inventory.product_requirements',
    'inventory.ProductRequirements',
    'inventory.product-requirements',
    'inventory/product_requirements',
    'inventory.product_requirements.extra',
    ' inventory.product_requirements',
    'inventory.product_requirements ',
    '',
  ];

  it.each(invalid)('rejects %j', (v) => {
    expect(safeParseCapabilityId(v).success).toBe(false);
    expect(isCapabilityId(v)).toBe(false);
  });

  it('parser does not transform input', () => {
    const raw = 'inventory.product_requirements';
    const parsed = parseCapabilityId(raw);
    expect(String(parsed)).toBe(raw);
  });
});
