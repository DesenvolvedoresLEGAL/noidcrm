import { describe, it, expect } from 'vitest';
import { calculateInstallments } from '@/services/supabase/proposal-payment-terms';

const baseTerm: any = {
  payment_type: 'one_time',
  payment_condition: 'upfront',
  first_installment_date: '2026-07-20',
  discount_percent: 0,
};

describe('calculateInstallments — upfront due date', () => {
  it('respects "Data personalizada" even when approvedAmount (ledger base) is passed on unaccepted proposal', () => {
    const term = {
      ...baseTerm,
      dynamic_pricing_reference_type: 'custom_date',
      dynamic_pricing_reference_date: '2026-08-07',
    };
    const result = calculateInstallments(term, 2200, {
      approvedAmount: 2200, // ledger-derived base, NOT a freeze signal
      frozenSchedule: false,
      dynamicPricingCurrentEndsAt: '2026-08-08',
    });
    expect(result[0].dueDate).toBe('2026-08-07');
  });

  it('falls back to current_ends_at when custom_date is not set and proposal is not frozen', () => {
    const result = calculateInstallments(baseTerm, 2200, {
      approvedAmount: 2200,
      frozenSchedule: false,
      dynamicPricingCurrentEndsAt: '2026-08-08',
    });
    expect(result[0].dueDate).toBe('2026-08-08');
  });

  it('keeps frozen first_installment_date when frozenSchedule=true (accepted proposal)', () => {
    const term = {
      ...baseTerm,
      dynamic_pricing_reference_type: 'custom_date',
      dynamic_pricing_reference_date: '2026-08-07',
    };
    const result = calculateInstallments(term, 2200, {
      approvedAmount: 2200,
      frozenSchedule: true,
      dynamicPricingCurrentEndsAt: '2026-08-08',
    });
    expect(result[0].dueDate).toBe('2026-07-20');
  });

  it('does not reapply discount when approvedAmount is provided (ledger base already net)', () => {
    const term = { ...baseTerm, discount_percent: 10 };
    const result = calculateInstallments(term, 2200, {
      approvedAmount: 2200,
      frozenSchedule: false,
    });
    expect(result[0].amount).toBe(2200);
  });
});
