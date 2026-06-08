import { describe, it, expect } from 'vitest';
import { readFrozenSchedule, readFrozenFirstDueDate, isProposalFrozen } from './frozenSchedule';

describe('frozenSchedule', () => {
  const sched = [{ index: 1, label: 'Parcela 1/1', amount: 895.5, due_date: '2026-06-03' }];

  it('isProposalFrozen true quando aceito + tem schedule', () => {
    expect(isProposalFrozen({ status: 'accepted', approved_payment_schedule: { schedule: sched } })).toBe(true);
  });

  it('isProposalFrozen false quando draft', () => {
    expect(isProposalFrozen({ status: 'draft', approved_payment_schedule: { schedule: sched } })).toBe(false);
  });

  it('lê shape { schedule: [...] } (RPC atual)', () => {
    const r = readFrozenSchedule({ status: 'accepted', approved_payment_schedule: { schedule: sched } });
    expect(r).toHaveLength(1);
    expect(r![0].dueDate).toBe('2026-06-03');
    expect(r![0].amount).toBe(895.5);
    expect(r![0].type).toBe('upfront');
  });

  it('lê shape legado { payment_schedule: [...] }', () => {
    const r = readFrozenSchedule({ status: 'accepted', approved_payment_schedule: { payment_schedule: sched } });
    expect(r![0].dueDate).toBe('2026-06-03');
  });

  it('lê shape legado array puro', () => {
    const r = readFrozenSchedule({ status: 'accepted', approved_payment_schedule: sched });
    expect(r![0].dueDate).toBe('2026-06-03');
  });

  it('retorna null quando não aprovada', () => {
    expect(readFrozenSchedule({ status: 'draft', approved_payment_schedule: { schedule: sched } })).toBeNull();
  });

  it('retorna null quando schedule ausente', () => {
    expect(readFrozenSchedule({ status: 'accepted' })).toBeNull();
  });

  it('múltiplas parcelas viram type=installment', () => {
    const multi = [
      { index: 1, amount: 500, due_date: '2026-06-03' },
      { index: 2, amount: 500, due_date: '2026-07-03' },
    ];
    const r = readFrozenSchedule({ status: 'accepted', approved_payment_schedule: { schedule: multi } });
    expect(r).toHaveLength(2);
    expect(r![0].type).toBe('installment');
    expect(r![1].dueDate).toBe('2026-07-03');
  });

  it('readFrozenFirstDueDate normaliza ISO completo para YYYY-MM-DD', () => {
    const r = readFrozenFirstDueDate({
      status: 'accepted',
      approved_payment_schedule: { schedule: [{ due_date: '2026-06-03T12:00:00Z', amount: 100 }] },
    });
    expect(r).toBe('2026-06-03');
  });
});
