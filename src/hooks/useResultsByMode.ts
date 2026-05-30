/**
 * Hook para o modo Comissão Padrão.
 *
 * Reaproveita `ote_monthly_results` + `ote_sales_records` como base do período.
 * Mapeia os campos OTE para uma visão de Comissão direta:
 *   - "Comissão calculada"     ← final_variable_amount
 *   - "Receita comissionável"  ← eligibleTotal (aggregateEligible)
 *   - "Receita não comissionável" ← nonEligibleTotal
 *   - Status pago/pendente     ← ote_monthly_results.status
 *
 * Observação: regras avançadas de comissão por produto/categoria/pipeline ainda
 * dependem da configuração existente (níveis/multiplicadores). Quando a
 * organização migrar para uma engine dedicada de comissão padrão, este hook
 * deve ser substituído sem mudar a UI.
 */
import { useMemo } from 'react';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { aggregateEligible } from '@/components/ote/oteEligibility';

export interface SellerCommissionRow {
  result: OTEMonthlyResult;
  commissionableRevenue: number;
  nonCommissionableRevenue: number;
  commissionGenerated: number;
  commissionPaid: number;
  commissionPending: number;
  avgCommissionRate: number;
  salesWithCommission: number;
  statusLabel: string;
}

export interface CommissionSummary {
  totalCommissionToPay: number;
  totalCommissionable: number;
  totalNonCommissionable: number;
  salesWithCommission: number;
  sellersWithCommission: number;
  rows: SellerCommissionRow[];
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'paid':
      return 'Pago';
    case 'approved':
      return 'Aprovado';
    case 'disputed':
      return 'Contestado';
    case 'pending':
    default:
      return 'Pendente';
  }
}

export function useCommissionResults(
  results: OTEMonthlyResult[],
  records: OTESalesRecord[],
): CommissionSummary {
  return useMemo(() => {
    const individual = results.filter((r) => !r.is_team_target);

    const rows: SellerCommissionRow[] = individual.map((result) => {
      const sellerRecords = records.filter((rec) => rec.ote_result_id === result.id);
      const { eligibleTotal, nonEligibleTotal } = aggregateEligible(sellerRecords);
      const commissionGenerated = Number(result.final_variable_amount || 0);
      const isPaid = result.status === 'paid';
      const commissionPaid = isPaid ? commissionGenerated : 0;
      const commissionPending = isPaid ? 0 : commissionGenerated;
      const avgCommissionRate =
        eligibleTotal > 0 ? (commissionGenerated / eligibleTotal) * 100 : 0;
      const salesWithCommission = sellerRecords.filter(
        (rec) => rec.counts_toward_goal && Number(rec.eligible_amount || 0) > 0,
      ).length;
      return {
        result,
        commissionableRevenue: eligibleTotal,
        nonCommissionableRevenue: nonEligibleTotal,
        commissionGenerated,
        commissionPaid,
        commissionPending,
        avgCommissionRate,
        salesWithCommission,
        statusLabel: statusLabel(result.status),
      };
    });

    const totalCommissionToPay = rows.reduce((s, r) => s + r.commissionGenerated, 0);
    const totalCommissionable = rows.reduce((s, r) => s + r.commissionableRevenue, 0);
    const totalNonCommissionable = rows.reduce((s, r) => s + r.nonCommissionableRevenue, 0);
    const salesWithCommission = rows.reduce((s, r) => s + r.salesWithCommission, 0);
    const sellersWithCommission = rows.filter((r) => r.commissionGenerated > 0).length;

    return {
      totalCommissionToPay,
      totalCommissionable,
      totalNonCommissionable,
      salesWithCommission,
      sellersWithCommission,
      rows,
    };
  }, [results, records]);
}

export interface SellerGoalRow {
  result: OTEMonthlyResult;
  realized: number;
  goal: number;
  achievementPct: number;
  gap: number;
  statusLabel: 'Meta batida' | 'Em ritmo' | 'Abaixo do ritmo' | 'Sem meta configurada';
}

export interface SimpleGoalsSummary {
  totalRealized: number;
  totalGoal: number;
  achievementPct: number;
  sellersAbove: number;
  sellersBelow: number;
  rows: SellerGoalRow[];
}

function goalStatus(pct: number, hasGoal: boolean): SellerGoalRow['statusLabel'] {
  if (!hasGoal) return 'Sem meta configurada';
  if (pct >= 100) return 'Meta batida';
  if (pct >= 70) return 'Em ritmo';
  return 'Abaixo do ritmo';
}

export function useSimpleGoalsResults(
  results: OTEMonthlyResult[],
  records: OTESalesRecord[],
): SimpleGoalsSummary {
  return useMemo(() => {
    const individual = results.filter((r) => !r.is_team_target);

    const rows: SellerGoalRow[] = individual.map((result) => {
      const sellerRecords = records.filter((rec) => rec.ote_result_id === result.id);
      const { eligibleTotal } = aggregateEligible(sellerRecords);
      const goal = Number(result.goal_amount || 0);
      const realized = eligibleTotal || Number(result.total_sales || 0);
      const hasGoal = goal > 0;
      const achievementPct = hasGoal ? (realized / goal) * 100 : 0;
      const gap = hasGoal ? Math.max(0, goal - realized) : 0;
      return {
        result,
        realized,
        goal,
        achievementPct,
        gap,
        statusLabel: goalStatus(achievementPct, hasGoal),
      };
    });

    const totalRealized = rows.reduce((s, r) => s + r.realized, 0);
    const totalGoal = rows.reduce((s, r) => s + r.goal, 0);
    const achievementPct = totalGoal > 0 ? (totalRealized / totalGoal) * 100 : 0;
    const sellersAbove = rows.filter((r) => r.statusLabel === 'Meta batida').length;
    const sellersBelow = rows.filter(
      (r) => r.statusLabel === 'Abaixo do ritmo' || r.statusLabel === 'Em ritmo',
    ).length;

    return { totalRealized, totalGoal, achievementPct, sellersAbove, sellersBelow, rows };
  }, [results, records]);
}
