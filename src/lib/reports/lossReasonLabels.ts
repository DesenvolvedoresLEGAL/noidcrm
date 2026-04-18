/**
 * Sprint 2.4 — Helpers de label para fonte de motivo de perda.
 */

import type { LossReasonSource } from '@/types/lossV2';

export function getLossReasonSourceLabel(source: LossReasonSource): string {
  switch (source) {
    case 'seller_loss_reason':
      return 'Motivo do vendedor';
    case 'win_loss_record':
      return 'Registro Win/Loss';
    case 'unclassified':
      return 'Sem motivo registrado';
    default:
      return 'Desconhecido';
  }
}

/**
 * Fallback explícito para exibir motivo consolidado em UI.
 */
export function getConsolidatedReasonName(name: string | null | undefined): string {
  return name?.trim() || 'Sem motivo registrado';
}

export function getConsolidatedReasonCategory(category: string | null | undefined): string {
  return category?.trim() || 'Sem Classificação';
}
