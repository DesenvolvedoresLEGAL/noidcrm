/**
 * Sprint 2.4 — Helpers para loss_coverage_bucket e cobertura agregada.
 */

import type { LossCoverageBucket } from '@/types/lossV2';

export function getLossCoverageLabel(bucket: LossCoverageBucket): string {
  switch (bucket) {
    case 'complete':
      return 'Completa';
    case 'partial':
      return 'Parcial';
    case 'missing':
      return 'Sem registro';
    default:
      return 'Desconhecida';
  }
}

export function getCoverageHealthLabel(pct: number | null | undefined): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (pct == null) {
    return { label: 'Sem dados', variant: 'outline' };
  }
  if (pct >= 80) return { label: 'Excelente', variant: 'default' };
  if (pct >= 60) return { label: 'Bom', variant: 'secondary' };
  if (pct >= 30) return { label: 'Parcial', variant: 'outline' };
  return { label: 'Crítico', variant: 'destructive' };
}
