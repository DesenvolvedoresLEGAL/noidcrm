/**
 * Sprint 2.9 — Faixas de label de confiança.
 *
 *  >= 90 → Excelente
 *  >= 75 → Alta
 *  >= 55 → Parcial
 *  <  55 → Baixa
 */

export type ConfidenceTone = 'excellent' | 'high' | 'partial' | 'low';

export interface ConfidenceLabel {
  label: string;
  tone: ConfidenceTone;
  /** Tailwind utility class hint for badge background. */
  badgeClass: string;
}

export function getConfidenceLabel(score: number | null | undefined): ConfidenceLabel {
  const s = Number(score ?? 0);
  if (s >= 90) return { label: 'Excelente', tone: 'excellent', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
  if (s >= 75) return { label: 'Alta',      tone: 'high',      badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' };
  if (s >= 55) return { label: 'Parcial',   tone: 'partial',   badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  return                { label: 'Baixa',    tone: 'low',       badgeClass: 'bg-destructive/15 text-destructive' };
}
