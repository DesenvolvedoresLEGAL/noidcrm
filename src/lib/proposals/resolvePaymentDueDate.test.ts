import { describe, it, expect } from 'vitest';
import {
  resolvePaymentDueDateFromCommercialCondition,
  dynamicPricingEndForInstallments,
} from './resolvePaymentDueDate';

describe('resolvePaymentDueDateFromCommercialCondition', () => {
  it('usa current_ends_at do snapshot vivo quando a tabela dinâmica está ativa', () => {
    const proposal = {
      id: 'p1',
      created_at: '2026-06-01T10:00:00Z',
      dynamic_pricing_enabled: true,
    };
    const paymentTerm = {
      payment_type: 'one_time',
      payment_condition: 'upfront',
      first_installment_date: '2026-06-01',
    };
    const result = resolvePaymentDueDateFromCommercialCondition(proposal, paymentTerm, {
      snapshot: { enabled: true, current_ends_at: '2026-06-05T23:59:59-03:00' },
    });
    expect(result.due_date).toBe('2026-06-05');
    expect(result.source).toBe('current_dynamic_tier_end');
  });

  it('cai para o snapshot persistido quando o vivo não está disponível', () => {
    const proposal = {
      dynamic_pricing_enabled: true,
      dynamic_pricing_snapshot: { current_ends_at: '2026-06-05T02:59:59+00:00' },
    };
    const result = resolvePaymentDueDateFromCommercialCondition(proposal, {}, null);
    expect(result.source).toBe('dynamic_pricing_snapshot_current_tier_end');
    expect(result.due_date).toBe('2026-06-05');
  });

  it('preserva approved_payment_schedule congelado pós-aceite', () => {
    const proposal = {
      status: 'accepted',
      dynamic_pricing_enabled: true,
      dynamic_pricing_snapshot: { current_ends_at: '2026-07-30T00:00:00Z' },
      approved_payment_schedule: [{ due_date: '2026-06-15', amount: 1000 }],
    };
    const result = resolvePaymentDueDateFromCommercialCondition(proposal, {}, null);
    expect(result.source).toBe('frozen_approved_payment_schedule');
    expect(result.due_date).toBe('2026-06-15');
  });

  it('nunca usa created_at da proposta como vencimento', () => {
    const proposal = {
      created_at: '2026-06-01T10:00:00Z',
      dynamic_pricing_enabled: true,
      dynamic_pricing_snapshot: { current_ends_at: '2026-06-05T02:59:59+00:00' },
    };
    const paymentTerm = {
      payment_type: 'one_time',
      payment_condition: 'upfront',
      first_installment_date: '2026-06-01', // created_at do payment term
    };
    const result = resolvePaymentDueDateFromCommercialCondition(proposal, paymentTerm, null);
    expect(result.due_date).not.toBe('2026-06-01');
    expect(result.due_date).toBe('2026-06-05');
  });

  it('para proposta sem tabela dinâmica, dynamicPricingEndForInstallments retorna null (não altera comportamento)', () => {
    const proposal = { dynamic_pricing_enabled: false };
    const paymentTerm = { first_installment_date: '2026-06-01' };
    expect(dynamicPricingEndForInstallments(proposal, paymentTerm, null)).toBeNull();
  });

  it('dynamicPricingEndForInstallments devolve a data do tier vigente quando ativa', () => {
    const proposal = {
      dynamic_pricing_enabled: true,
      dynamic_pricing_snapshot: { current_ends_at: '2026-06-05T02:59:59+00:00' },
    };
    expect(
      dynamicPricingEndForInstallments(proposal, { first_installment_date: '2026-06-01' }, null),
    ).toBe('2026-06-05');
  });

  it('dynamicPricingEndForInstallments retorna null em proposta aceita com schedule congelado (não recalcula)', () => {
    const proposal = {
      status: 'accepted',
      dynamic_pricing_enabled: true,
      dynamic_pricing_snapshot: { current_ends_at: '2026-08-30T00:00:00Z' },
      approved_payment_schedule: [{ due_date: '2026-06-15', amount: 1000 }],
    };
    expect(dynamicPricingEndForInstallments(proposal, {}, null)).toBeNull();
  });
});
