import { z } from 'zod';

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type PricingRisk = (typeof RISK_LEVELS)[number];

export const RISK_LABEL: Record<PricingRisk, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

export function riskBadgeVariant(
  risk?: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (risk) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
    default:
      return 'outline';
  }
}

export const inventoryPricingRuleSchema = z
  .object({
    name: z.string().min(2, 'Nome obrigatório'),
    description: z.string().optional().nullable(),
    category_id: z.string().uuid().optional().nullable(),
    family_id: z.string().uuid().optional().nullable(),
    min_occupancy_rate: z.coerce.number().min(0).max(100),
    max_occupancy_rate: z.coerce.number().min(0).max(100).optional().nullable(),
    price_adjustment_type: z.enum(['percent', 'fixed']),
    price_adjustment_value: z.coerce.number().min(0),
    max_discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
    requires_approval: z.boolean().default(false),
    risk_level: z.enum(RISK_LEVELS),
    status: z.enum(['active', 'inactive']).default('active'),
  })
  .refine(
    (v) =>
      v.max_occupancy_rate == null ||
      v.max_occupancy_rate >= v.min_occupancy_rate,
    { message: 'Máximo deve ser maior ou igual ao mínimo', path: ['max_occupancy_rate'] },
  );

export type InventoryPricingRuleInput = z.infer<typeof inventoryPricingRuleSchema>;

export const inventoryPricingFactorPayloadSchema = z.object({
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  category_id: z.string().uuid().optional().nullable(),
  family_id: z.string().uuid().optional().nullable(),
  requested_quantity: z.coerce.number().positive(),
  base_amount: z.coerce.number().min(0),
});

export type InventoryPricingFactorPayload = z.infer<
  typeof inventoryPricingFactorPayloadSchema
>;

export interface InventoryPricingFactorResult {
  occupancy_rate: number;
  available_quantity: number;
  requested_quantity: number;
  can_fulfill: boolean;
  risk_level: PricingRisk;
  pricing_rule_id: string | null;
  pricing_rule_name: string | null;
  price_adjustment_type: 'percent' | 'fixed';
  price_adjustment_value: number;
  adjustment_amount: number;
  base_amount: number;
  adjusted_amount: number;
  max_discount_percent: number | null;
  requires_approval: boolean;
  message: string;
  period_start: string;
  period_end: string;
  computed_at: string;
}

export function formatPercent(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function formatBRL(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}
