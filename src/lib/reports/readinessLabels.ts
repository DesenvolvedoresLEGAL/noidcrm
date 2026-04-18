/**
 * Sprint 2.9 — Labels de prontidão para desligamento do legacy.
 */

export type ReadinessStatus = 'ready' | 'almost_ready' | 'not_ready' | 'unknown';

export interface ReadinessLabel {
  label: string;
  status: ReadinessStatus;
  badgeClass: string;
}

export function getReadinessLabel(status: string | null | undefined): ReadinessLabel {
  switch (status) {
    case 'ready':
      return { label: 'Pronto', status: 'ready', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
    case 'almost_ready':
      return { label: 'Quase pronto', status: 'almost_ready', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
    case 'not_ready':
      return { label: 'Não pronto', status: 'not_ready', badgeClass: 'bg-destructive/15 text-destructive' };
    default:
      return { label: 'Desconhecido', status: 'unknown', badgeClass: 'bg-muted text-muted-foreground' };
  }
}
