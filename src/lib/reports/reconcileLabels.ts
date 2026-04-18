/**
 * Sprint 2.9 — Labels para checks de reconciliação.
 */

export type ReconcileSeverity = 'info' | 'warning' | 'critical';
export type ReconcileOverall = 'consistent' | 'warning' | 'critical' | 'unknown';

export function getReconcileLabel(severity: string | null | undefined): { label: string; badgeClass: string } {
  switch (severity) {
    case 'critical':
      return { label: 'Crítico', badgeClass: 'bg-destructive/15 text-destructive' };
    case 'warning':
      return { label: 'Atenção', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
    case 'info':
      return { label: 'OK', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
    default:
      return { label: '—', badgeClass: 'bg-muted text-muted-foreground' };
  }
}

export function getReconcileOverallLabel(status: string | null | undefined): { label: string; badgeClass: string } {
  switch (status) {
    case 'consistent':
      return { label: 'Consistente', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
    case 'warning':
      return { label: 'Atenção', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
    case 'critical':
      return { label: 'Crítico', badgeClass: 'bg-destructive/15 text-destructive' };
    default:
      return { label: 'Desconhecido', badgeClass: 'bg-muted text-muted-foreground' };
  }
}
