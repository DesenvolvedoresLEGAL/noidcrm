/**
 * Sprint 2.4 — Helpers para loss_classification_status.
 */

import type { LossClassificationStatus } from '@/types/lossV2';

export function getLossClassificationStatusLabel(status: LossClassificationStatus): string {
  switch (status) {
    case 'fully_classified':
      return 'Totalmente classificada';
    case 'partially_classified':
      return 'Parcialmente classificada';
    case 'seller_only':
      return 'Apenas motivo do vendedor';
    case 'client_only':
      return 'Apenas motivo do cliente';
    case 'win_loss_only':
      return 'Apenas registro Win/Loss';
    case 'unclassified_legacy':
      return 'Não classificada (legado)';
    case 'unclassified_blocked':
      return 'Bloqueada — classificação pendente';
    default:
      return 'Desconhecida';
  }
}

export function getLossClassificationBadgeVariant(
  status: LossClassificationStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'fully_classified':
      return 'default';
    case 'partially_classified':
    case 'seller_only':
    case 'client_only':
    case 'win_loss_only':
      return 'secondary';
    case 'unclassified_legacy':
      return 'outline';
    case 'unclassified_blocked':
      return 'destructive';
    default:
      return 'outline';
  }
}
