/**
 * PATCH OTE 1.7.4 — Resolução única do multiplicador OTE.
 *
 * Fonte oficial: tabela `ote_multipliers` (faixas configuradas pelo cliente).
 *
 * IMPORTANTE — Unidade do parâmetro:
 *   Esta função SEMPRE recebe o atingimento em PERCENTUAL (ex.: 90 para 90%).
 *   NUNCA passe a razão (0.9). Para evitar ambiguidade silenciosa, valores
 *   estritamente entre 0 e 1 são tratados como inválidos (`0x`) e logam aviso.
 *
 * Casamento de faixa:
 *   - Ordena por `min_percentage` ascendente.
 *   - Faixa = `min_percentage <= pct < nextMin` (ou `<= max_percentage` na
 *     última). Garante que decimais entre faixas (ex.: 99,21%) não caiam em 0
 *     por gap entre 99 e 100.
 *
 * Use a função em qualquer ponto que precise transformar `% Meta` em
 * multiplicador: backend (calculate-ote), UI (cards/drawers) e Excel auditável.
 */
export interface OteMultiplierRange {
  id?: string;
  min_percentage: number;
  max_percentage: number;
  multiplier: number;
}

export interface ResolvedOteMultiplier {
  multiplier: number;
  range: OteMultiplierRange | null;
}

export function resolveOteMultiplierFromPercent(
  percent: number,
  multipliers: OteMultiplierRange[] | null | undefined,
): ResolvedOteMultiplier {
  if (!Number.isFinite(percent) || percent <= 0) {
    return { multiplier: 0, range: null };
  }
  if (percent > 0 && percent < 1) {
    // Provável engano (ratio 0..1 em vez de percentual). Não adivinhamos.
    // eslint-disable-next-line no-console
    console.warn(
      `[resolveOteMultiplierFromPercent] valor suspeito (${percent}). Espere percentual (ex.: 90 para 90%).`,
    );
  }
  if (!multipliers || multipliers.length === 0) {
    return { multiplier: 0, range: null };
  }
  const sorted = [...multipliers].sort(
    (a, b) => Number(a.min_percentage) - Number(b.min_percentage),
  );
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const lower = Number(cur.min_percentage ?? 0);
    const upperExclusive = next ? Number(next.min_percentage) : Number.POSITIVE_INFINITY;
    const upperInclusiveLast = Number(cur.max_percentage ?? Number.POSITIVE_INFINITY);
    const inRange = next
      ? percent >= lower && percent < upperExclusive
      : percent >= lower && percent <= upperInclusiveLast;
    if (inRange) {
      return { multiplier: Number(cur.multiplier) || 0, range: cur };
    }
  }
  return { multiplier: 0, range: null };
}

/**
 * Detecta divergência entre multiplicador persistido (snapshot) e a regra
 * atual derivada do `% Meta` exibido. Retorna `null` quando coerente.
 */
export function detectMultiplierMismatch(params: {
  displayedPercent: number;
  snapshotMultiplier: number;
  multipliers: OteMultiplierRange[] | null | undefined;
  tolerance?: number;
}): { expected: number; actual: number } | null {
  const { displayedPercent, snapshotMultiplier, multipliers, tolerance = 0.001 } = params;
  const expected = resolveOteMultiplierFromPercent(displayedPercent, multipliers).multiplier;
  if (Math.abs(expected - Number(snapshotMultiplier || 0)) <= tolerance) return null;
  return { expected, actual: Number(snapshotMultiplier || 0) };
}
