import { z } from 'zod';

export const PAYMENT_INTENT_STATUSES = [
  'pending',
  'paid_exact',
  'paid_partial',
  'paid_over',
  'expired',
  'cancelled',
  'complementary_pending',
  'complementary_paid',
  'manual_review',
] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const PAYMENT_INTENT_SOURCES = [
  'proposal_link',
  'crm_manual',
  'erp_manual',
  'complementary_charge',
  'agent',
] as const;
export type PaymentIntentSource = (typeof PAYMENT_INTENT_SOURCES)[number];

export const PAYMENT_METHODS = [
  'pix',
  'bank_transfer',
  'boleto',
  'credit_card',
  'manual',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_EVENT_TYPES = [
  'payment_intent_created',
  'pix_generated',
  'payment_received',
  'payment_validated',
  'payment_partial',
  'payment_overpaid',
  'payment_exact',
  'complementary_charge_created',
  'payment_expired',
  'manual_review_required',
  'cancelled',
] as const;
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

export const STATUS_LABEL: Record<PaymentIntentStatus, string> = {
  pending: 'Pendente',
  paid_exact: 'Pago',
  paid_partial: 'Pago parcial',
  paid_over: 'Pago acima',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  complementary_pending: 'Complementar pendente',
  complementary_paid: 'Complementar pago',
  manual_review: 'Revisão manual',
};

export const EVENT_LABEL: Record<PaymentEventType, string> = {
  payment_intent_created: 'Cobrança criada',
  pix_generated: 'Pix gerado',
  payment_received: 'Pagamento recebido',
  payment_validated: 'Pagamento validado',
  payment_partial: 'Pagamento parcial',
  payment_overpaid: 'Pagamento acima',
  payment_exact: 'Pagamento correto',
  complementary_charge_created: 'Complementar criada',
  payment_expired: 'Cobrança expirada',
  manual_review_required: 'Revisão manual necessária',
  cancelled: 'Cancelada',
};

export function statusVariant(
  s?: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'paid_exact':
    case 'complementary_paid':
      return 'default';
    case 'paid_partial':
    case 'complementary_pending':
    case 'manual_review':
      return 'destructive';
    case 'paid_over':
      return 'secondary';
    case 'expired':
    case 'cancelled':
      return 'outline';
    default:
      return 'secondary';
  }
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

export const manualPaymentSchema = z.object({
  paid_amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  paid_at: z.string().min(1, 'Data obrigatória'),
  payment_reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;
