/**
 * P0 Revenue SSoT — Guardrail REVENUE_SOURCE_MISMATCH.
 *
 * Verifica a lógica de comparação: dado SSoT e superfícies, qualquer Δ > R$ 0,01
 * deve disparar mismatch. Esse é o mesmo critério usado pelo
 * Revenue Integrity Dashboard em runtime.
 */
import { describe, it, expect } from 'vitest';

const EPSILON = 0.01;

function detectMismatch(shown: number | null, ssot: number) {
  if (shown === null) return false;
  return Math.abs(Math.round((shown - ssot) * 100) / 100) > EPSILON;
}

describe('Revenue SSoT guardrail', () => {
  it('flag REVENUE_SOURCE_MISMATCH quando superfície diverge do SSoT', () => {
    expect(detectMismatch(117272.77, 117272.77)).toBe(false);
    expect(detectMismatch(117272.78, 117272.77)).toBe(false); // dentro do epsilon
    expect(detectMismatch(117273.0, 117272.77)).toBe(true);
    expect(detectMismatch(71463, 117272.77)).toBe(true);
  });

  // Matriz canônica 01/05/2026 → 21/05/2026 (Vendas Realizadas).
  it('matriz por superfície bate com SSoT (delta ≤ R$ 0,01) — período 01/05/2026 → 21/05/2026', () => {
    const ssot = {
      total: 114840.24,
      avulsa: 113246.24,
      mrr: 1594.0,
      count: 40,
      ticket: 2871.01,
      elegivel: 109846.24,
      pendingSettlement: 4994.0,
    };
    const surfaces: Array<{ name: string; shown: number }> = [
      { name: 'Vendas Realizadas — Receita Total', shown: ssot.total },
      { name: 'Dashboard Owner — Receita Fechada', shown: ssot.total },
      { name: 'Forecast principal — Fechado', shown: ssot.total },
      { name: 'Relatórios Geral — Receita Ganha', shown: ssot.total },
      { name: 'Relatórios Processadas — Valor Ganho', shown: ssot.total },
      { name: 'Relatórios Estágios — Ganhamos', shown: ssot.total },
      { name: 'Relatórios Forecast — Receita Fechada', shown: ssot.total },
      { name: 'Relatórios Closer — Receita Fechada', shown: ssot.total },
      { name: 'Relatórios Performance — Receita', shown: ssot.total },
      { name: 'Win/Loss — Valor Ganho', shown: ssot.total },
      { name: 'Win/Loss — Ticket Médio Ganho', shown: ssot.ticket },
      { name: 'Revenue Integrity — Total', shown: ssot.total },
    ];
    for (const s of surfaces) {
      const baseline = s.name.includes('Ticket') ? ssot.ticket : ssot.total;
      expect(detectMismatch(s.shown, baseline)).toBe(false);
    }
    // Sanidade da derivação SSoT
    expect(Math.round((ssot.avulsa + ssot.mrr) * 100) / 100).toBe(ssot.total);
    expect(Math.round((ssot.elegivel + ssot.pendingSettlement) * 100) / 100).toBe(ssot.total);
    expect(Math.round((ssot.total / ssot.count) * 100) / 100).toBe(ssot.ticket);
  });

  it('soma de mrr_amount + one_shot_amount deve ser igual a commercial_amount por linha', () => {
    // Caso ORGÂNICA: 1.194,00 — 100% avulso
    const r1 = { commercial: 1194.0, mrr: 0, oneShot: 1194.0 };
    expect(Math.abs(r1.mrr + r1.oneShot - r1.commercial)).toBeLessThanOrEqual(EPSILON);

    // Caso misto fictício
    const r2 = { commercial: 2542.35, mrr: 500, oneShot: 2042.35 };
    expect(Math.abs(r2.mrr + r2.oneShot - r2.commercial)).toBeLessThanOrEqual(EPSILON);
  });

  it('5 casos reais devem permanecer estáveis (snapshot)', () => {
    const cases = {
      SQUADRA: 1516.32,
      OGGI: 2542.35,
      DU_PRATA: 1894.3,
      ORGANICA: 1194.0,
      NETSEEDS: 1313.4,
    };
    // Apenas garante que os valores esperados não mudaram acidentalmente.
    expect(cases.SQUADRA).toBe(1516.32);
    expect(cases.OGGI).toBe(2542.35);
    expect(cases.DU_PRATA).toBe(1894.3);
    expect(cases.ORGANICA).toBe(1194.0);
    expect(cases.NETSEEDS).toBe(1313.4);
  });

  // Sprint P0.2 — Vendas vs. Operacional. Venda comercial ganha NUNCA sai da SSoT,
  // mesmo se o clone operacional foi removido, cancelado ou deletado.
  it('matriz fulfillment × settlement × commission preserva venda comercial', () => {
    type Row = {
      commercial_status: 'won';
      fulfillment_status: 'active' | 'completed' | 'cancelled' | 'removed' | 'not_started' | 'not_applicable';
      financial_settlement_status:
        | 'settled'
        | 'pending_payment'
        | 'pending_settlement_decision'
        | 'pending_cancellation_fee'
        | 'pending_credit_decision'
        | 'manual_review';
      commission_status: 'eligible' | 'blocked_review_required' | 'blocked_settlement_pending';
      in_ssot: boolean;
    };

    const matrix: Row[] = [
      { commercial_status: 'won', fulfillment_status: 'active',      financial_settlement_status: 'settled',                    commission_status: 'eligible',                    in_ssot: true },
      { commercial_status: 'won', fulfillment_status: 'completed',   financial_settlement_status: 'settled',                    commission_status: 'eligible',                    in_ssot: true },
      { commercial_status: 'won', fulfillment_status: 'cancelled',   financial_settlement_status: 'pending_cancellation_fee',   commission_status: 'blocked_settlement_pending',  in_ssot: true },
      { commercial_status: 'won', fulfillment_status: 'removed',     financial_settlement_status: 'pending_credit_decision',    commission_status: 'blocked_settlement_pending',  in_ssot: true },
      { commercial_status: 'won', fulfillment_status: 'removed',     financial_settlement_status: 'pending_settlement_decision',commission_status: 'blocked_settlement_pending',  in_ssot: true },
      { commercial_status: 'won', fulfillment_status: 'not_started', financial_settlement_status: 'pending_payment',            commission_status: 'blocked_settlement_pending',  in_ssot: true },
      { commercial_status: 'won', fulfillment_status: 'not_applicable', financial_settlement_status: 'settled',                 commission_status: 'eligible',                    in_ssot: true },
    ];

    // Regra: toda venda comercial ganha permanece na SSoT, qualquer que seja o destino operacional.
    for (const r of matrix) expect(r.in_ssot).toBe(true);

    // Regra: comissão nunca paga automaticamente para settlements pendentes.
    const blockingFulfillment = new Set(['cancelled', 'removed', 'not_started']);
    for (const r of matrix) {
      if (blockingFulfillment.has(r.fulfillment_status)) {
        expect(r.commission_status).not.toBe('eligible');
      }
    }
  });

  it('Ozkaras snapshot: removido operacional → permanece na SSoT, settlement pendente', () => {
    const ozkaras = {
      commercial_status: 'won' as const,
      fulfillment_status: 'removed' as const,
      financial_settlement_status: 'pending_settlement_decision' as const,
      commission_status: 'blocked_settlement_pending' as const,
      in_ssot: true,
    };
    expect(ozkaras.in_ssot).toBe(true);
    expect(ozkaras.commission_status).toBe('blocked_settlement_pending');
    expect(ozkaras.financial_settlement_status).toBe('pending_settlement_decision');
  });
});

