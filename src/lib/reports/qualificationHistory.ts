/**
 * Sprint 2.3 — Helpers para qualificação.
 */

/**
 * Formata tempo até qualificação em horas → string humana.
 */
export function formatTimeToQualification(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return '—';
  if (hours < 1) {
    const minutes = Math.max(0, Math.round(hours * 60));
    return `${minutes} min`;
  }
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) return `${Math.round(days / 30)} m`;
  return `${(days / 365).toFixed(1)} a`;
}

/**
 * Calcula horas entre criação da oportunidade e primeira qualificação.
 */
export function computeHoursToQualification(
  createdAt: string | null | undefined,
  firstQualificationAt: string | null | undefined,
): number | null {
  if (!createdAt || !firstQualificationAt) return null;
  const created = new Date(createdAt).getTime();
  const qualified = new Date(firstQualificationAt).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(qualified)) return null;
  const diff = (qualified - created) / (1000 * 60 * 60);
  return diff >= 0 ? diff : null;
}
