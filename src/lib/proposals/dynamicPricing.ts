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

// ===== PRICE 1.0.1: Antecedência por evento =====

export const PRICING_MODES = ['manual', 'event_antecedence'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export const POST_EVENT_POLICIES = ['surcharge', 'requires_requote', 'block_payment'] as const;
export type PostEventPolicy = (typeof POST_EVENT_POLICIES)[number];

export const POST_EVENT_POLICY_LABEL: Record<PostEventPolicy, string> = {
  surcharge: 'Aplicar sobretaxa pós-evento',
  requires_requote: 'Exigir nova cotação',
  block_payment: 'Bloquear pagamento',
};

export const FACTOR_ADJUSTMENT_TYPES = ['percent', 'fixed'] as const;
export type FactorAdjustmentType = (typeof FACTOR_ADJUSTMENT_TYPES)[number];

export const FACTOR_STATUSES = ['active', 'inactive'] as const;
export type FactorStatus = (typeof FACTOR_STATUSES)[number];

export const proposalDynamicPricingFactorRuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, 'Nome obrigatório'),
  label: z.string().min(2, 'Descrição obrigatória'),
  min_days_before_event: z.coerce.number().int().nullable().optional(),
  max_days_before_event: z.coerce.number().int().nullable().optional(),
  adjustment_type: z.enum(FACTOR_ADJUSTMENT_TYPES).default('percent'),
  adjustment_value: z.coerce.number().default(0),
  sort_order: z.coerce.number().int().min(0).default(0),
  status: z.enum(FACTOR_STATUSES).default('active'),
});
export type ProposalDynamicPricingFactorRuleInput = z.infer<
  typeof proposalDynamicPricingFactorRuleSchema
>;

export const eventAntecedencePricingGenerationSchema = z.object({
  proposal_id: z.string().uuid(),
  force_regenerate: z.boolean().default(false),
});
export type EventAntecedencePricingGenerationInput = z.infer<
  typeof eventAntecedencePricingGenerationSchema
>;

export type TierStatus = 'expired' | 'current' | 'next' | 'future' | 'post_event';

export const TIER_STATUS_LABEL: Record<TierStatus, string> = {
  expired: 'Expirada',
  current: 'Vigente',
  next: 'Próxima',
  future: 'Futuro',
  post_event: 'Pós evento',
};

export function tierStatusFromDates(
  starts_at: string | null,
  ends_at: string | null,
  eventStartDate: string | null,
  now: Date = new Date(),
): TierStatus {
  const t = now.getTime();
  const s = starts_at ? new Date(starts_at).getTime() : -Infinity;
  const e = ends_at ? new Date(ends_at).getTime() : Infinity;
  if (eventStartDate && starts_at) {
    const ev = new Date(eventStartDate).getTime();
    if (s > ev) {
      // tier starts after event begins → pós evento
      if (s <= t && t <= e) return 'post_event';
      if (t < s) return 'next';
    }
  }
  if (s <= t && t <= e) return 'current';
  if (t < s) {
    // closest next
    return 'next';
  }
  return 'expired';
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const target = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export interface DynamicPricingSnapshot {
  proposal_id: string;
  pricing_rule_id?: string | null;
  base_amount?: number | null;
  currency?: string | null;
  enabled?: boolean | null;
  status: DynamicPricingStatus | string;
  message?: string | null;
  reference_at?: string | null;
  /** PRICE UX 1.0.4 — tipo da data de referência usada no cálculo */
  reference_type?: 'current_date' | 'payment_due_date' | 'custom_date' | 'approval_date' | string | null;
  /** PRICE UX 1.0.4 — data de referência comercial efetiva */
  reference_date?: string | null;
  current_tier_id?: string | null;
  current_label?: string | null;
  current_amount?: number | null;
  current_starts_at?: string | null;
  current_ends_at?: string | null;
  current_adjustment_type?: string | null;
  current_adjustment_value?: number | null;
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

/** PRICE UX 1.0.4 — rótulos amigáveis para o tipo de data de referência */
export const REFERENCE_TYPE_LABEL: Record<string, string> = {
  current_date: 'Pagamento imediato',
  payment_due_date: 'Vencimento da cobrança',
  custom_date: 'Data personalizada',
  approval_date: 'Condição especial aprovada',
};

export const REFERENCE_TYPE_DESCRIPTION: Record<string, string> = {
  current_date: 'Calculado pela data atual',
  payment_due_date: 'Calculado pela data prevista de pagamento',
  custom_date: 'Calculado pela data personalizada definida',
  approval_date: 'Preço congelado no momento da aprovação',
};

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

export interface DynamicPricingBreakdown {
  active: boolean;
  base: number;
  current: number;
  delta: number;
  adjustmentPercent: number;
  hasAdjustment: boolean;
  endsAt: string | null;
  nextAmount: number | null;
  nextStartsAt: string | null;
  currentLabel: string | null;
}

/**
 * Unified breakdown for the "Itens Avulsos" section across public view and PDF.
 * Returns base subtotal vs current vigent value plus next-tier transition info.
 */
export function getDynamicPricingBreakdown(
  snapshot: Partial<DynamicPricingSnapshot> | null | undefined,
  baseOneTimeTotal: number,
): DynamicPricingBreakdown {
  const enabled = !!snapshot?.enabled;
  const status = snapshot?.status;
  const current =
    snapshot?.current_amount != null ? Number(snapshot.current_amount) : null;

  const active = enabled && status !== 'disabled' && current != null;

  if (!active || current == null) {
    return {
      active: false,
      base: baseOneTimeTotal,
      current: baseOneTimeTotal,
      delta: 0,
      adjustmentPercent: 0,
      hasAdjustment: false,
      endsAt: null,
      nextAmount: null,
      nextStartsAt: null,
      currentLabel: null,
    };
  }

  const base =
    snapshot?.base_amount != null && Number(snapshot.base_amount) > 0
      ? Number(snapshot.base_amount)
      : baseOneTimeTotal;
  const delta = current - base;
  const adjustmentPercent = base > 0 ? (delta / base) * 100 : 0;

  return {
    active: true,
    base,
    current,
    delta,
    adjustmentPercent,
    hasAdjustment: Math.abs(delta) > 0.01,
    endsAt: snapshot?.current_ends_at ?? null,
    nextAmount: snapshot?.next_amount != null ? Number(snapshot.next_amount) : null,
    nextStartsAt: snapshot?.next_starts_at ?? null,
    currentLabel: snapshot?.current_label ?? null,
  };
}
