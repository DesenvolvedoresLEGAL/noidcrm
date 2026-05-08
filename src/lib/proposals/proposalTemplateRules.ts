import { z } from 'zod';

export const REVENUE_TYPES = [
  'one_time_event',
  'one_time_non_event',
  'recurring',
  'short_subscription',
  'subscription_with_commitment',
  'service',
] as const;
export type RevenueType = (typeof REVENUE_TYPES)[number];

export const DYNAMIC_PRICING_APPLICABILITIES = ['automatic', 'optional', 'none'] as const;
export type DynamicPricingApplicability = (typeof DYNAMIC_PRICING_APPLICABILITIES)[number];

export const DYNAMIC_PRICING_MODES = [
  'none',
  'automatic_by_valid_until',
  'manual',
] as const;
export type DynamicPricingMode = (typeof DYNAMIC_PRICING_MODES)[number];

export const VALIDITY_STRATEGIES = [
  'fixed_days_from_creation',
  'proposal_valid_until',
  'manual',
  'event_start_date',
] as const;
export type ValidityStrategy = (typeof VALIDITY_STRATEGIES)[number];

export const PAYMENT_MODES = ['one_time', 'recurring', 'installment', 'mixed'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const REVENUE_TYPE_LABEL: Record<RevenueType, string> = {
  one_time_event: 'Avulso — Evento',
  one_time_non_event: 'Avulso — Não-evento',
  recurring: 'Recorrente',
  short_subscription: 'Assinatura curta',
  subscription_with_commitment: 'Assinatura com fidelidade',
  service: 'Serviço',
};

export const DYNAMIC_PRICING_APPLICABILITY_LABEL: Record<DynamicPricingApplicability, string> = {
  automatic: 'Automática',
  optional: 'Opcional',
  none: 'Não aplicável',
};

export const DYNAMIC_PRICING_MODE_LABEL: Record<DynamicPricingMode, string> = {
  none: 'Sem tabela dinâmica',
  automatic_by_valid_until: 'Automática por validade',
  manual: 'Manual',
};

export const VALIDITY_STRATEGY_LABEL: Record<ValidityStrategy, string> = {
  fixed_days_from_creation: 'Dias fixos a partir da criação',
  proposal_valid_until: 'Validade da proposta',
  manual: 'Manual',
  event_start_date: 'Data do evento',
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  one_time: 'Avulso',
  recurring: 'Recorrente',
  installment: 'Parcelado',
  mixed: 'Misto',
};

export const proposalTemplateCommercialRulesSchema = z
  .object({
    revenue_type: z.enum(REVENUE_TYPES).nullable().optional(),
    dynamic_pricing_applicability: z.enum(DYNAMIC_PRICING_APPLICABILITIES).default('none'),
    dynamic_pricing_mode: z.enum(DYNAMIC_PRICING_MODES).default('none'),
    validity_strategy: z.enum(VALIDITY_STRATEGIES).default('fixed_days_from_creation'),
    default_validity_days: z.coerce.number().int().min(0).nullable().optional(),
    requires_valid_until: z.boolean().default(false),
    allow_recurring: z.boolean().default(false),
    default_payment_mode: z.enum(PAYMENT_MODES).default('one_time'),
    show_dynamic_pricing_on_public_link: z.boolean().default(false),
    show_dynamic_pricing_on_pdf: z.boolean().default(false),
    allow_pix_payment: z.boolean().default(true),
    allow_complementary_charge: z.boolean().default(true),
    template_commercial_rules: z.record(z.any()).default({}),
  })
  .superRefine((v, ctx) => {
    if (
      v.requires_valid_until &&
      !['proposal_valid_until', 'event_start_date'].includes(v.validity_strategy)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validity_strategy'],
        message:
          'Para exigir validade, a estratégia precisa ser "Validade da proposta" ou "Data do evento".',
      });
    }
    if (v.dynamic_pricing_applicability === 'automatic' && v.dynamic_pricing_mode === 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dynamic_pricing_mode'],
        message:
          'Aplicabilidade "Automática" exige modo "Automática por validade" ou "Manual".',
      });
    }
  });

export type ProposalTemplateCommercialRules = z.infer<
  typeof proposalTemplateCommercialRulesSchema
>;

export interface TemplateBadgeView {
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
}

export function templateBadges(t: {
  revenue_type?: string | null;
  dynamic_pricing_applicability?: string | null;
  dynamic_pricing_mode?: string | null;
  allow_recurring?: boolean | null;
}): TemplateBadgeView[] {
  const out: TemplateBadgeView[] = [];

  if (t.revenue_type === 'one_time_event') {
    out.push({ label: 'Avulso Evento', variant: 'secondary' });
  }

  if (
    t.dynamic_pricing_applicability === 'automatic' ||
    t.dynamic_pricing_mode === 'automatic_by_valid_until'
  ) {
    out.push({ label: 'Tabela dinâmica automática', variant: 'default' });
  }

  if (t.allow_recurring) {
    out.push({ label: 'Recorrente', variant: 'secondary' });
  }

  if (
    t.dynamic_pricing_applicability === 'none' &&
    (!t.dynamic_pricing_mode || t.dynamic_pricing_mode === 'none')
  ) {
    out.push({ label: 'Sem tabela dinâmica', variant: 'outline' });
  }

  return out;
}
