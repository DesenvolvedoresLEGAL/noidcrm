import { getCloserDashboardData } from './closerDashboard';
import { getCloserPaceData } from './closerDashboardPilot';
import type { CloserDashboardData, CloserPaceData } from '@/types/dashboard/closer';

export type AuditStatus = 'validated' | 'empty' | 'unavailable' | 'missing_source' | 'review';

export interface AuditRow {
  metric: string;
  source: string;
  status: AuditStatus;
  observation: string;
  recommendation: string;
  value?: number | string | null;
}

export interface AuditResult {
  rows: AuditRow[];
  data: CloserDashboardData | null;
  pace: CloserPaceData | null;
  generatedAt: string;
  totals: {
    open_opportunities_count: number;
    open_opportunities_value: number;
    open_proposals_count: number;
    open_proposals_value: number;
    activities_today_count: number;
    overdue_activities_count: number;
    won_revenue_month: number;
    won_count_month: number;
    lost_count_month: number;
    goal_value: number | null;
    realized_value: number;
    expected_pace_today: number | null;
  };
}

const STATUS_LABEL: Record<AuditStatus, string> = {
  validated: 'Validado',
  empty: 'Sem dados',
  unavailable: 'Fonte ausente',
  missing_source: 'Fonte ausente',
  review: 'Precisa revisar',
};

export function auditStatusLabel(s: AuditStatus): string {
  return STATUS_LABEL[s];
}

function classify(value: number | null | undefined, availability?: string): AuditStatus {
  if (availability === 'unavailable') return 'unavailable';
  if (value == null) return 'missing_source';
  if (value === 0) return 'empty';
  return 'validated';
}

export async function auditCommercialDashboard(
  tenantId: string,
  userId: string,
): Promise<AuditResult> {
  const [data, pace] = await Promise.all([
    getCloserDashboardData({ tenantId, userId, period: 'current_month' }).catch(() => null),
    getCloserPaceData(tenantId, userId).catch(() => null),
  ]);

  const av = (data?.availability ?? {}) as Record<string, string>;
  const c = data?.central_do_dia;
  const k = data?.kpis;
  const lists = data?.lists;

  const rows: AuditRow[] = [];

  rows.push({
    metric: 'Atividades de hoje',
    source: 'activities (scheduled_date = hoje, owner = user)',
    status: classify(c?.today_activities_count, av.activities),
    value: c?.today_activities_count ?? null,
    observation: 'Compromissos do vendedor para hoje.',
    recommendation: 'Verificar se RLS expõe atividades do próprio user.',
  });
  rows.push({
    metric: 'Follow ups vencidos',
    source: 'activities (scheduled_date < hoje, status pendente)',
    status: classify(c?.overdue_followups_count, av.activities),
    value: c?.overdue_followups_count ?? null,
    observation: 'Atividades atrasadas que travam vendas.',
    recommendation: 'Se zerado por dias, validar com lista no CRM.',
  });
  rows.push({
    metric: 'Propostas vencendo hoje',
    source: 'proposals (expires_at = hoje)',
    status: classify(c?.proposals_expiring_today, av.proposals),
    value: c?.proposals_expiring_today ?? null,
    observation: 'Propostas com prazo final hoje.',
    recommendation: 'Validar timezone do expires_at.',
  });
  rows.push({
    metric: 'Propostas vencendo em 48h',
    source: 'proposals (expires_at <= hoje + 48h)',
    status: classify(c?.proposals_expiring_48h, av.proposals),
    value: c?.proposals_expiring_48h ?? null,
    observation: 'Janela de ação preventiva.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Propostas vencidas',
    source: 'proposals (expires_at < hoje, status open)',
    status: classify(c?.proposals_expired, av.proposals),
    value: c?.proposals_expired ?? null,
    observation: 'Fora do prazo e ainda sem fechamento.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Propostas visualizadas sem ação',
    source: 'proposals + proposal_views',
    status: classify(c?.proposals_viewed_no_followup, av.proposal_views),
    value: c?.proposals_viewed_no_followup ?? null,
    observation: 'Cliente abriu, vendedor não retomou.',
    recommendation: 'Se Fonte ausente, garantir leitura de proposal_views.',
  });
  rows.push({
    metric: 'Oportunidades sem próxima atividade',
    source: 'opportunities (sem activity futura)',
    status: classify(c?.opportunities_without_next_activity, av.opportunities),
    value: c?.opportunities_without_next_activity ?? null,
    observation: 'Deals abertos sem próximo passo.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Oportunidades paradas',
    source: 'opportunities + opportunity_stage_history',
    status: classify(c?.stalled_opportunities, av.opportunity_stage_history),
    value: c?.stalled_opportunities ?? null,
    observation: 'Sem avanço relevante há mais de 7 dias.',
    recommendation: 'Se a fonte for parcial, mostrar apenas os com histórico recente.',
  });
  rows.push({
    metric: 'Top 10 ações',
    source: 'cálculo prioridade (proposals + activities + opportunities)',
    status: lists?.top_actions_today?.length
      ? 'validated'
      : av.opportunities === 'unavailable'
        ? 'unavailable'
        : 'empty',
    value: lists?.top_actions_today?.length ?? 0,
    observation: 'Lista priorizada determinística.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Pipeline aberto (valor)',
    source: 'opportunities (status open, owner = user)',
    status: classify(k?.open_pipeline_value, av.opportunities),
    value: k?.open_pipeline_value ?? null,
    observation: 'Soma dos valores líquidos abertos.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Propostas na mesa (valor)',
    source: 'proposals (status open)',
    status: classify(k?.proposals_open_value, av.proposals),
    value: k?.proposals_open_value ?? null,
    observation: 'Soma do valor de propostas abertas.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Realizado no mês',
    source: 'opportunities (won, closed_at no mês)',
    status: classify(k?.monthly_revenue_value, av.opportunities),
    value: k?.monthly_revenue_value ?? null,
    observation: 'Net value de deals ganhos no mês corrente.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Meta do mês',
    source: 'sales_goals / seller_targets / ote_seller_configs',
    status: pace?.goal_value != null && pace.goal_value > 0
      ? 'validated'
      : 'missing_source',
    value: pace?.goal_value ?? null,
    observation: pace?.goal_source ? `Origem: ${pace.goal_source}` : 'Meta não configurada.',
    recommendation: pace?.goal_value ? '—' : 'Cadastrar meta nas Configurações de Resultado.',
  });
  rows.push({
    metric: 'Pace esperado hoje',
    source: 'cálculo: meta × dias_uteis_corridos / dias_uteis_total',
    status: pace?.available && pace?.expected_pace_today != null ? 'validated' : 'missing_source',
    value: pace?.expected_pace_today ?? null,
    observation: pace?.business_days_rule ?? 'Dias úteis seg–sex, sem feriados.',
    recommendation: pace?.available ? '—' : 'Depende de meta cadastrada.',
  });
  rows.push({
    metric: 'Gap de pace',
    source: 'realizado − pace esperado',
    status: pace?.available ? 'validated' : 'missing_source',
    value: pace?.pace_gap_value ?? null,
    observation: 'Negativo = atrasado. Positivo = acima.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Ticket médio',
    source: 'média de net value dos ganhos no período',
    status: classify(k?.average_ticket_value, av.opportunities),
    value: k?.average_ticket_value ?? null,
    observation: 'Calculado sobre vendas do período selecionado.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Taxa de fechamento',
    source: 'won / (won + lost) no período',
    status: k?.win_rate_percent != null ? 'validated' : 'empty',
    value: k?.win_rate_percent ?? null,
    observation: 'Sales pipeline apenas, exclui soft-deleted.',
    recommendation: '—',
  });
  rows.push({
    metric: 'Deals em risco',
    source: 'sinais comerciais (silêncio, prazo, etc.)',
    status: lists?.risk_deals?.length
      ? 'validated'
      : av.opportunity_stage_history === 'unavailable'
        ? 'unavailable'
        : 'empty',
    value: lists?.risk_deals?.length ?? 0,
    observation: 'Risco calculado por sinais combinados.',
    recommendation: '—',
  });

  return {
    rows,
    data,
    pace,
    generatedAt: new Date().toISOString(),
    totals: {
      open_opportunities_count: k?.open_pipeline_count ?? 0,
      open_opportunities_value: k?.open_pipeline_value ?? 0,
      open_proposals_count: k?.proposals_open_count ?? 0,
      open_proposals_value: k?.proposals_open_value ?? 0,
      activities_today_count: c?.today_activities_count ?? 0,
      overdue_activities_count: c?.overdue_followups_count ?? 0,
      won_revenue_month: k?.monthly_revenue_value ?? 0,
      won_count_month: k?.won_count ?? 0,
      lost_count_month: k?.lost_count ?? 0,
      goal_value: pace?.goal_value ?? null,
      realized_value: pace?.realized_value ?? k?.monthly_revenue_value ?? 0,
      expected_pace_today: pace?.expected_pace_today ?? null,
    },
  };
}
