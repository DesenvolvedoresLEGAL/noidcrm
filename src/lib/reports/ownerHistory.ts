/**
 * Sprint 2.3 — Helpers de apresentação para histórico de ownership.
 */

export function getOwnerChangeLabel(source: string | null | undefined): string {
  switch (source) {
    case 'created':
      return 'Atribuição inicial';
    case 'owner_change':
      return 'Mudança de responsável';
    case 'backfill_initial_owner':
      return 'Atribuição inicial (importada)';
    default:
      return source ?? 'Evento de responsável';
  }
}
