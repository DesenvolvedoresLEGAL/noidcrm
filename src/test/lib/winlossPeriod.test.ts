import { describe, it, expect } from 'vitest';
import {
  resolvePeriodRange, resolveComparisonRange, shiftAnchor, canShiftForward,
  calculateMetricDelta, parseISODate, toISODate,
} from '@/lib/winloss/period';

const NOW = new Date(2026, 4, 20, 14, 0, 0); // 20/05/2026

describe('resolvePeriodRange', () => {
  it('resolve mês âncora completo', () => {
    const r = resolvePeriodRange('month', { anchor: new Date(2025, 6, 15), now: NOW });
    expect(toISODate(r.start)).toBe('2025-07-01');
    expect(toISODate(r.end)).toBe('2025-07-31');
    expect(r.label).toBe('Julho 2025');
  });

  it('resolve trimestre e semestre', () => {
    const q = resolvePeriodRange('quarter', { anchor: new Date(2026, 7, 3), now: NOW });
    expect(q.label).toBe('Q3 2026');
    const s = resolvePeriodRange('semester', { anchor: new Date(2026, 8, 3), now: NOW });
    expect(toISODate(s.start)).toBe('2026-07-01');
    expect(s.label).toBe('2º Semestre 2026');
  });

  it('resolve rolling 7d relativo a hoje', () => {
    const r = resolvePeriodRange('7d', { now: NOW });
    expect(toISODate(r.start)).toBe('2026-05-14');
    expect(toISODate(r.end)).toBe('2026-05-20');
  });
});

describe('navegação histórica', () => {
  it('desloca mantendo o tipo', () => {
    expect(toISODate(shiftAnchor('month', new Date(2026, 0, 10), -1))).toBe('2025-12-01');
    expect(toISODate(shiftAnchor('quarter', new Date(2026, 4, 10), -1))).toBe('2026-01-01');
    expect(toISODate(shiftAnchor('semester', new Date(2026, 1, 10), 1))).toBe('2026-07-01');
    expect(toISODate(shiftAnchor('year', new Date(2026, 1, 10), -1))).toBe('2025-01-01');
  });

  it('bloqueia avanço para períodos futuros', () => {
    expect(canShiftForward('month', new Date(2026, 4, 1), NOW)).toBe(false);
    expect(canShiftForward('month', new Date(2026, 2, 1), NOW)).toBe(true);
    expect(canShiftForward('7d', new Date(2026, 2, 1), NOW)).toBe(false);
  });
});

describe('resolveComparisonRange', () => {
  it('none retorna null', () => {
    const cur = resolvePeriodRange('month', { anchor: new Date(2026, 3, 1), now: NOW });
    expect(resolveComparisonRange(cur, 'none')).toBeNull();
  });

  it('período anterior de tipo navegável mantém granularidade', () => {
    const cur = resolvePeriodRange('month', { anchor: new Date(2026, 3, 1), now: NOW });
    const prev = resolveComparisonRange(cur, 'previous_period', { now: NOW })!;
    expect(toISODate(prev.start)).toBe('2026-03-01');
    expect(toISODate(prev.end)).toBe('2026-03-31');
  });

  it('mesmo período do ano anterior', () => {
    const cur = resolvePeriodRange('quarter', { anchor: new Date(2026, 1, 1), now: NOW });
    const prev = resolveComparisonRange(cur, 'previous_year', { now: NOW })!;
    expect(toISODate(prev.start)).toBe('2025-01-01');
    expect(toISODate(prev.end)).toBe('2025-03-31');
  });

  it('janela rolling compara com janela imediatamente anterior', () => {
    const cur = resolvePeriodRange('7d', { now: NOW });
    const prev = resolveComparisonRange(cur, 'previous_period', { now: NOW })!;
    expect(toISODate(prev.end)).toBe('2026-05-13');
    expect(toISODate(prev.start)).toBe('2026-05-07');
  });
});

describe('calculateMetricDelta', () => {
  it('percentual com base válida', () => {
    const d = calculateMetricDelta(120, 100, 'number', true);
    expect(d.pct).toBe(20);
    expect(d.sentiment).toBe('positive');
    expect(d.text).toBe('↑ 20%');
  });

  it('aumento em métrica ruim é negativo', () => {
    const d = calculateMetricDelta(50, 25, 'currency', false);
    expect(d.sentiment).toBe('negative');
  });

  it('nunca divide por zero', () => {
    const d = calculateMetricDelta(10, 0, 'number', true);
    expect(d.pct).toBeNull();
    expect(d.text).toBe('sem base comparativa');
  });

  it('win rate usa pontos percentuais', () => {
    const d = calculateMetricDelta(48, 40, 'percent', true);
    expect(d.pp).toBe(8);
    expect(d.text).toBe('↑ 8 pp');
  });

  it('sem base comparativa quando previous é null', () => {
    const d = calculateMetricDelta(10, null, 'number', true);
    expect(d.hasBase).toBe(false);
    expect(d.text).toBe('—');
  });

  it('ciclo em dias', () => {
    const d = calculateMetricDelta(20, 24, 'days', false);
    expect(d.text).toBe('↓ 4 dias');
    expect(d.sentiment).toBe('positive');
  });
});

describe('serialização URL', () => {
  it('round-trip de data', () => {
    const d = parseISODate('2025-11-03')!;
    expect(toISODate(d)).toBe('2025-11-03');
    expect(parseISODate('lixo')).toBeNull();
    expect(parseISODate(null)).toBeNull();
  });
});
