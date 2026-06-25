/**
 * Cálculos de pace para Central de Qualificação SDR.
 * Considera dias úteis = segunda a sexta (sem feriados — simplificação MVP).
 */

export type PaceStatus = 'accelerated' | 'on_track' | 'attention' | 'risk' | 'critical';

function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

export function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= e) {
    if (isBusinessDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export interface PaceInput {
  monthlyTarget: number;
  qualifiedMonth: number;
  today?: Date;
}

export interface PaceResult {
  monthlyTarget: number;
  qualifiedMonth: number;
  missingLeads: number;
  targetPercent: number;
  businessDaysTotal: number;
  businessDaysElapsed: number;
  businessDaysRemaining: number;
  requiredDailyPace: number;
  idealPaceToday: number;
  paceGap: number;
  projectedMonthEnd: number;
  status: PaceStatus;
  message: string;
  period: { month: string; startDate: string; endDate: string };
}

function classify(gap: number): PaceStatus {
  if (gap >= 3) return 'accelerated';
  if (gap >= 0) return 'on_track';
  if (gap >= -3) return 'attention';
  if (gap >= -7) return 'risk';
  return 'critical';
}

function messageFor(status: PaceStatus, requiredDaily: number, missingLeads: number): string {
  switch (status) {
    case 'accelerated':
      return 'Você está acima do ritmo. Mantenha a cadência e priorize qualidade.';
    case 'on_track':
      return `Você está no ritmo da meta. Mantenha ${requiredDaily} lead(s)/dia útil restante.`;
    case 'attention':
      return `Levemente abaixo do pace. Qualifique ${requiredDaily} lead(s) hoje para recuperar.`;
    case 'risk':
      return `Abaixo do ritmo. Faltam ${missingLeads} leads e o pace exige ${requiredDaily}/dia útil restante.`;
    case 'critical':
      return `Meta em risco. Faltam ${missingLeads} leads — pace necessário: ${requiredDaily}/dia útil restante.`;
  }
}

export function calculatePace({ monthlyTarget, qualifiedMonth, today = new Date() }: PaceInput): PaceResult {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const businessDaysTotal = countBusinessDays(start, end);
  const businessDaysElapsed = countBusinessDays(start, today);
  const businessDaysRemaining = Math.max(businessDaysTotal - businessDaysElapsed, 0);

  const missingLeads = Math.max(monthlyTarget - qualifiedMonth, 0);
  const targetPercent = monthlyTarget > 0 ? Math.round((qualifiedMonth / monthlyTarget) * 1000) / 10 : 0;
  const requiredDailyPace = Math.ceil(missingLeads / Math.max(businessDaysRemaining, 1));

  const idealPaceToday = monthlyTarget > 0 && businessDaysTotal > 0
    ? Math.round(monthlyTarget * (businessDaysElapsed / businessDaysTotal))
    : 0;
  const paceGap = qualifiedMonth - idealPaceToday;

  const avgPerDay = businessDaysElapsed > 0 ? qualifiedMonth / businessDaysElapsed : 0;
  const projectedMonthEnd = Math.round(qualifiedMonth + avgPerDay * businessDaysRemaining);

  const status = classify(paceGap);

  return {
    monthlyTarget,
    qualifiedMonth,
    missingLeads,
    targetPercent,
    businessDaysTotal,
    businessDaysElapsed,
    businessDaysRemaining,
    requiredDailyPace,
    idealPaceToday,
    paceGap,
    projectedMonthEnd,
    status,
    message: messageFor(status, requiredDailyPace, missingLeads),
    period: {
      month: today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    },
  };
}

export function paceStatusLabel(status: PaceStatus): string {
  switch (status) {
    case 'accelerated': return 'Acelerado';
    case 'on_track': return 'No ritmo';
    case 'attention': return 'Atenção';
    case 'risk': return 'Risco';
    case 'critical': return 'Crítico';
  }
}

export function paceStatusColor(status: PaceStatus): string {
  switch (status) {
    case 'accelerated': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'on_track': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'attention': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'risk': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}
