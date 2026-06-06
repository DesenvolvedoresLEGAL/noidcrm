import { describe, it, expect } from 'vitest';
import { resolveOteMultiplierFromPercent } from './multiplier';

const MULTIPLIERS = [
  { min_percentage: 0, max_percentage: 50, multiplier: 0 },
  { min_percentage: 51, max_percentage: 69, multiplier: 0.25 },
  { min_percentage: 70, max_percentage: 84, multiplier: 0.5 },
  { min_percentage: 85, max_percentage: 99, multiplier: 0.75 },
  { min_percentage: 100, max_percentage: 109, multiplier: 1 },
  { min_percentage: 110, max_percentage: 129, multiplier: 1.25 },
  { min_percentage: 130, max_percentage: 150, multiplier: 1.5 },
  { min_percentage: 151, max_percentage: 199, multiplier: 1.75 },
  { min_percentage: 200, max_percentage: 299, multiplier: 2 },
  { min_percentage: 300, max_percentage: 399, multiplier: 3 },
  { min_percentage: 400, max_percentage: 499, multiplier: 4 },
];

describe('resolveOteMultiplierFromPercent — PATCH OTE 1.7.4', () => {
  const cases: Array<[number, number]> = [
    [0, 0],
    [22, 0],
    [30, 0],
    [50, 0],
    [51, 0.25],
    [69, 0.25],
    [70, 0.5],
    [84, 0.5],
    [85, 0.75],
    [90, 0.75],
    [99, 0.75],
    [99.21, 0.75],
    [100, 1],
    [109, 1],
    [110, 1.25],
    [129, 1.25],
    [130, 1.5],
    [136, 1.5],
    [150, 1.5],
    [151, 1.75],
    [189.55, 1.75],
    [199, 1.75],
    [200, 2],
  ];
  for (const [pct, expected] of cases) {
    it(`${pct}% → ${expected}x`, () => {
      expect(resolveOteMultiplierFromPercent(pct, MULTIPLIERS).multiplier).toBe(expected);
    });
  }

  it('lista vazia → 0x', () => {
    expect(resolveOteMultiplierFromPercent(150, []).multiplier).toBe(0);
  });
});
