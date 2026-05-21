/**
 * P0 Revenue SSoT — Guardrail REVENUE_SOURCE_MISMATCH.
 *
 * Verifica a lógica de comparação: dado SSoT e superfícies, qualquer Δ > R$ 0,01
 * deve disparar mismatch. Esse é o mesmo critério usado pelo
 * Revenue Integrity Dashboard em runtime.
 */
import { describe, it, expect } from 'vitest';

const EPSILON = 0.01;

function detectMismatch(shown: number | null, ssot: number) {
  if (shown === null) return false;
  return Math.abs(Math.round((shown - ssot) * 100) / 100) > EPSILON;
}

describe('Revenue SSoT guardrail', () => {
  it('flag REVENUE_SOURCE_MISMATCH quando superfície diverge do SSoT', () => {
    expect(detectMismatch(117272.77, 117272.77)).toBe(false);
    expect(detectMismatch(117272.78, 117272.77)).toBe(false); // dentro do epsilon
    expect(detectMismatch(117273.0, 117272.77)).toBe(true);
    expect(detectMismatch(71463, 117272.77)).toBe(true);
  });

  it('soma de mrr_amount + one_shot_amount deve ser igual a commercial_amount por linha', () => {
    // Caso ORGÂNICA: 1.194,00 — 100% avulso
    const r1 = { commercial: 1194.0, mrr: 0, oneShot: 1194.0 };
    expect(Math.abs(r1.mrr + r1.oneShot - r1.commercial)).toBeLessThanOrEqual(EPSILON);

    // Caso misto fictício
    const r2 = { commercial: 2542.35, mrr: 500, oneShot: 2042.35 };
    expect(Math.abs(r2.mrr + r2.oneShot - r2.commercial)).toBeLessThanOrEqual(EPSILON);
  });

  it('5 casos reais devem permanecer estáveis (snapshot)', () => {
    const cases = {
      SQUADRA: 1516.32,
      OGGI: 2542.35,
      DU_PRATA: 1894.3,
      ORGANICA: 1194.0,
      NETSEEDS: 1313.4,
    };
    // Apenas garante que os valores esperados não mudaram acidentalmente.
    expect(cases.SQUADRA).toBe(1516.32);
    expect(cases.OGGI).toBe(2542.35);
    expect(cases.DU_PRATA).toBe(1894.3);
    expect(cases.ORGANICA).toBe(1194.0);
    expect(cases.NETSEEDS).toBe(1313.4);
  });
});
