/**
 * Sprint 2.2 — Helper para a origem do valor monetário canônico.
 *
 * Uso: ao exibir qualquer valor vindo de v_opportunity_amounts_v2,
 * acompanhar com getAmountSourceLabel(row.amount_source) garante
 * transparência sobre como o número foi apurado.
 */

import type { AmountSource } from '@/types/reportsV2';

export interface AmountSourceMeta {
  source: AmountSource;
  label: string;
  shortLabel: string;
  description: string;
  badgeVariant: 'success' | 'info' | 'warning' | 'destructive';
  isReliable: boolean;
}

const META: Record<AmountSource, AmountSourceMeta> = {
  accepted_proposal_net: {
    source: 'accepted_proposal_net',
    label: 'Proposta aceita (líquida)',
    shortLabel: 'Aceita',
    description: 'Valor líquido (total - desconto) da proposta aceita pelo cliente.',
    badgeVariant: 'success',
    isReliable: true,
  },
  latest_commercial_proposal_net: {
    source: 'latest_commercial_proposal_net',
    label: 'Proposta comercial mais recente',
    shortLabel: 'Recente',
    description: 'Valor líquido da proposta comercial mais recente desta oportunidade.',
    badgeVariant: 'info',
    isReliable: true,
  },
  opportunity_estimated_fallback: {
    source: 'opportunity_estimated_fallback',
    label: 'Valor estimado da oportunidade',
    shortLabel: 'Estimado',
    description: 'Valor previsto manualmente na oportunidade. Sem proposta para validar.',
    badgeVariant: 'warning',
    isReliable: false,
  },
  zero_fallback: {
    source: 'zero_fallback',
    label: 'Sem base monetária',
    shortLabel: 'Sem valor',
    description: 'Sem proposta nem estimativa registrada. Valor exibido como zero.',
    badgeVariant: 'destructive',
    isReliable: false,
  },
};

export function getAmountSourceMeta(source: AmountSource | string | null | undefined): AmountSourceMeta {
  if (!source || !(source in META)) return META.zero_fallback;
  return META[source as AmountSource];
}

export function getAmountSourceLabel(source: AmountSource | string | null | undefined): string {
  return getAmountSourceMeta(source).label;
}

export function isAmountSourceReliable(source: AmountSource | string | null | undefined): boolean {
  return getAmountSourceMeta(source).isReliable;
}

export const AMOUNT_SOURCES: AmountSource[] = [
  'accepted_proposal_net',
  'latest_commercial_proposal_net',
  'opportunity_estimated_fallback',
  'zero_fallback',
];
