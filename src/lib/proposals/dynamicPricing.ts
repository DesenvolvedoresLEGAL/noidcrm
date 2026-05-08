import { z } from 'zod';

export const PRICING_STATUSES = [
  'draft',
  'active',
  'expired',
  'disabled',
  'requires_requote',
] as const;
export type DynamicPricingStatus = (typeof PRICING_STATUSES)[number];

export const ADJUSTMENT_TYPES = [
  'base_amount',
  'fixed_price',
  'percent_adjustment',
  'fixed_adjustment',
] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, string> = {
  base_amount: 'Usar valor base',
  fixed_price: 'Preço fixo',
  percent_adjustment: 'Percentual sobre o valor base',
  fixed_adjustment: 'Valor fixo sobre o valor base',
};

export const STATUS_LABEL: Record<DynamicPricingStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  expired: 'Expirada',
  disabled: 'Desativada',
  requires_requote: 'Aguardando nova cotação',
};

export function statusBadgeVariant(
  s?: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'active':
      return 'default';
    case 'requires_requote':
    case 'expired':
      return 'destructive';
    case 'disabled':
      return 'outline';
    default:
      return 'secondary';
  }
}

export const dynamicPricingTierSchema = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().min(2, 'Nome obrigatório'),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
    adjustment_type: z.enum(ADJUSTMENT_TYPES),
    adjustment_value: z.coerce.number().min(0),
    tier_order: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (v) => !v.starts_at || !v.ends_at || new Date(v.ends_at) >= new Date(v.starts_at),
    { message: 'Fim deve ser maior ou igual ao início', path: ['ends_at'] },
  );

export type DynamicPricingTierInput = z.infer<typeof dynamicPricingTierSchema>;

export const dynamicPricingRuleSchema = z.object({
  enabled: z.boolean().default(true),
  base_amount: z.coerce.number().min(0),
  currency: z.string().default('BRL'),
  notes: z.string().optional().nullable(),
  tiers: z.array(dynamicPricingTierSchema).default([]),
});

export type DynamicPricingRuleInput = z.infer<typeof dynamicPricingRuleSchema>;

export interface DynamicPricingSnapshot {
  proposal_id: string;
  pricing_rule_id?: string | null;
  base_amount?: number | null;
  currency?: string | null;
  enabled?: boolean | null;
  status: DynamicPricingStatus | string;
  message?: string | null;
  reference_at?: string | null;
  current_tier_id?: string | null;
  current_label?: string | null;
  current_amount?: number | null;
  current_starts_at?: string | null;
  current_ends_at?: string | null;
  previous_tier_id?: string | null;
  previous_label?: string | null;
  previous_amount?: number | null;
  next_tier_id?: string | null;
  next_label?: string | null;
  next_amount?: number | null;
  next_starts_at?: string | null;
  next_ends_at?: string | null;
  last_end?: string | null;
  computed_at?: string | null;
}

export function formatBRL(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export function tiersOverlap(
  tiers: Pick<DynamicPricingTierInput, 'starts_at' | 'ends_at'>[],
): boolean {
  const ranges = tiers
    .map((t) => ({
      s: t.starts_at ? new Date(t.starts_at).getTime() : -Infinity,
      e: t.ends_at ? new Date(t.ends_at).getTime() : Infinity,
    }))
    .sort((a, b) => a.s - b.s);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].s <= ranges[i - 1].e) return true;
  }
  return false;
}

export function computeFinalAmount(
  base: number,
  type: AdjustmentType,
  value: number,
): number {
  switch (type) {
    case 'base_amount':
      return Math.max(0, base);
    case 'fixed_price':
      return Math.max(0, value);
    case 'percent_adjustment':
      return Math.max(0, base + (base * value) / 100);
    case 'fixed_adjustment':
      return Math.max(0, base + value);
    default:
      return 0;
  }
}
