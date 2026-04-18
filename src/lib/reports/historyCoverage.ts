/**
 * Sprint 2.3 — Classificação humana de cobertura de histórico.
 */

export type CoverageLabel = 'Excelente' | 'Bom' | 'Parcial' | 'Insuficiente';

export function getHistoryCoverageLabel(pct: number | null | undefined): CoverageLabel {
  if (pct == null || !Number.isFinite(pct)) return 'Insuficiente';
  if (pct >= 90) return 'Excelente';
  if (pct >= 70) return 'Bom';
  if (pct >= 40) return 'Parcial';
  return 'Insuficiente';
}

export function getCoverageBadgeVariant(
  pct: number | null | undefined,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const label = getHistoryCoverageLabel(pct);
  switch (label) {
    case 'Excelente':
      return 'default';
    case 'Bom':
      return 'secondary';
    case 'Parcial':
      return 'outline';
    default:
      return 'destructive';
  }
}
