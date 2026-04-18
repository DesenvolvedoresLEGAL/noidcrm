/**
 * Sprint 2.3 — Helpers de apresentação para tempo em estágio.
 */

export function formatStageAge(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days)) return '—';
  if (days < 1) {
    const hours = days * 24;
    if (hours < 1) {
      const minutes = Math.max(0, Math.round(hours * 60));
      return `${minutes} min`;
    }
    return `${Math.round(hours)} h`;
  }
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) return `${Math.round(days / 30)} m`;
  return `${(days / 365).toFixed(1)} a`;
}

export type StageAgeBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/**
 * Sinaliza saúde do tempo em estágio:
 *  - <= 7d: default (saudável)
 *  - <= 30d: secondary (atenção)
 *  - > 30d: destructive (estagnado)
 */
export function getStageAgeBadgeVariant(days: number | null | undefined): StageAgeBadgeVariant {
  if (days == null || !Number.isFinite(days)) return 'outline';
  if (days <= 7) return 'default';
  if (days <= 30) return 'secondary';
  return 'destructive';
}
