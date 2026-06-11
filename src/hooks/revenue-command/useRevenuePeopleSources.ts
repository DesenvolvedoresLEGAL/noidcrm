/**
 * RCC V3.4 RESET — Pessoas com fontes diretas.
 *
 * Este hook só orquestra fontes já usadas nas telas oficiais; a reconciliação
 * junta linhas por user_id e copia métricas prontas, sem reconstruir relatórios.
 */
import { useMemo } from 'react';
import { format } from 'date-fns';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportCloserV2 } from '@/hooks/useReportCloserV2';
import { useReportSDRV2 } from '@/hooks/useReportSDRV2';
import { useReportTeamV2 } from '@/hooks/useReportTeamV2';
import { useOTEMonthlyResults } from '@/hooks/useOTEData';
import { useActiveUsers } from '@/hooks/users/useActiveUsers';
import { useQualificationQualityV2 } from '@/hooks/reports/useQualificationQualityV2';
import { useClosedRevenueSummary, useRevenueBySeller } from '@/hooks/revenue/useRevenueSsot';
import { useForecastSalesPipeline } from '@/hooks/forecast/useForecastSalesPipeline';
import { useWinLossData } from '@/hooks/useWinLossData';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapCloserV2 } from '@/lib/reports/mappers/mapCloserV2';
import { mapSdrV2 } from '@/lib/reports/mappers/mapSdrV2';
import { mapTeamV2 } from '@/lib/reports/mappers/mapTeamV2';
import type { ActiveUserOption } from '@/types/activeUser';
import type {
  PeopleClassification,
  PeopleCloserSnapshotRow,
  PeopleConcentration,
  PeopleData,
  PeopleNeedsHelpItem,
  PeopleRecommendedAction,
  PeopleScoreboard,
  PeopleSdrSnapshotRow,
  PeopleTopPerformer,
} from './useRevenuePeople';

const SDR_CTA = { label: 'Ver Desempenho SDR', to: '/app/objetivos/desempenho?tab=sdr' };
const CLOSER_CTA = { label: 'Ver Desempenho Closer', to: '/app/objetivos/desempenho?tab=closers' };
const QUALITY_CTA = { label: 'Ver Qualidade de Qualificação', to: '/app/objetivos/desempenho?tab=qualidade' };
const PIPELINE_CTA = { label: 'Abrir Pipeline', to: '/app/opportunities' };
const OTE_CTA = { label: 'Ver OTE', to: '/app/reports/ote' };

const SOURCE = {
  revenue: 'Receita Válida por vendedor (commercial_won_revenue_view)',
  closer: 'Performance Closer V2',
  sdr: 'Performance SDR V2',
  quality: 'Qualidade de Qualificação V2',
  team: 'Pipeline ativo por owner (Team/Closer V2)',
  winloss: 'Win/Loss Hub',
  ote: 'OTE / Campeonato Comercial',
  activeUsers: 'Usuários ativos',
} as const;

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function has(v: unknown): boolean {
  return v !== null && v !== undefined;
}

function classifyGoal(pct: number | null): 'Meta batida' | 'Em evolução' | 'Risco de meta' | 'Sem meta OTE' {
  if (pct === null) return 'Sem meta OTE';
  if (pct >= 100) return 'Meta batida';
  if (pct >= 70) return 'Em evolução';
  return 'Risco de meta';
}

function classifySdr(row: PeopleSdrSnapshotRow): { c: PeopleClassification; label: string } {
  if (row.goalPct !== null && row.goalPct !== undefined && row.goalPct < 70) {
    return { c: 'risk', label: 'Risco de meta' };
  }
  if (has(row.sqlToProposalPct) && n(row.qualified) >= 10 && n(row.sqlToProposalPct) < 30) {
    return { c: 'volume_no_quality', label: 'Volume sem qualidade' };
  }
  if (row.goalPct !== null && row.goalPct !== undefined && row.goalPct >= 100) {
    return { c: 'high', label: 'Meta batida' };
  }
  if (has(row.sqlToProposalPct) && n(row.sqlToProposalPct) >= 40) return { c: 'good', label: 'Bom' };
  if (n(row.qualified) > 0) return { c: 'attention', label: 'Atenção' };
  return { c: 'insufficient', label: 'Sem dados suficientes' };
}

function classifyCloser(row: PeopleCloserSnapshotRow & { goalPct?: number | null }): { c: PeopleClassification; label: string } {
  if (row.goalPct !== null && row.goalPct !== undefined && row.goalPct < 70) return { c: 'risk', label: 'Risco de meta' };
  if (has(row.winRatePct) && n(row.winRatePct) < 20 && n(row.won) + n(row.lost) > 0) return { c: 'risk', label: 'Risco' };
  if (has(row.winRatePct) && n(row.winRatePct) < 35) return { c: 'attention', label: 'Atenção' };
  if (n(row.revenue) > 0 && has(row.winRatePct) && n(row.winRatePct) >= 45) return { c: 'high', label: 'Alta performance' };
  if (n(row.revenue) > 0 || n(row.won) > 0 || n(row.activePipeline) > 0) return { c: 'good', label: 'Bom' };
  return { c: 'insufficient', label: 'Sem dados suficientes' };
}

export function useRevenuePeopleSources() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const { filters, effectiveDates } = useReportFiltersContext();
  const teamVisibility = useTeamVisibility();

  const periodStart = useMemo(() => new Date(effectiveDates.startDate), [effectiveDates.startDate]);
  const periodEnd = useMemo(() => new Date(effectiveDates.endDate), [effectiveDates.endDate]);
  const start = periodStart.toISOString();
  const end = periodEnd.toISOString();
  const periodMonth = useMemo(() => format(periodStart, 'yyyy-MM'), [periodStart]);

  const request = useMemo(() => {
    if (!orgId || teamVisibility.loading) return undefined;
    return buildReportV2RequestFromFilters({
      organizationId: orgId,
      filters,
      effectiveDates,
      teamVisibility: {
        enabled: !teamVisibility.canViewAll,
        visibleUserIds: teamVisibility.visibleUserIds,
      },
    });
  }, [orgId, filters, effectiveDates, teamVisibility]);

  const closedSummary = useClosedRevenueSummary({
    surface: 'revenue-command:people-reset-summary',
    organizationId: orgId ?? undefined,
    start,
    end,
    pipelineIds: filters.pipelines?.length ? filters.pipelines : undefined,
  });
  const bySeller = useRevenueBySeller({
    surface: 'revenue-command:people-reset-by-seller',
    organizationId: orgId ?? undefined,
    start,
    end,
    pipelineIds: filters.pipelines?.length ? filters.pipelines : undefined,
  });
  const closer = useReportCloserV2({ organizationId: orgId, request });
  const sdr = useReportSDRV2({ organizationId: orgId, request });
  const team = useReportTeamV2({ organizationId: orgId, request });
  const quality = useQualificationQualityV2({ proposalStatus: 'any', includeRemovedUsers: false });
  const ote = useOTEMonthlyResults(periodMonth);
  const activeUsers = useActiveUsers();
  const salesPipeline = useForecastSalesPipeline({ organizationId: orgId });
  const winLoss = useWinLossData(orgId ?? '__pending_org__', salesPipeline.salesPipelineId ?? null, {
    from: periodStart,
    to: periodEnd,
  });

  return {
    orgId,
    start,
    end,
    periodMonth,
    filters,
    closedSummary,
    bySeller,
    closer,
    sdr,
    team,
    quality,
    ote,
    activeUsers,
    salesPipeline,
    winLoss,
    isLoading:
      !orgId ||
      teamVisibility.loading ||
      closedSummary.isLoading ||
      bySeller.isLoading ||
      closer.isLoading ||
      sdr.isLoading ||
      team.isLoading ||
      quality.isLoading ||
      ote.isLoading ||
      activeUsers.isLoading ||
      salesPipeline.isLoading ||
      winLoss.isLoading,
  };
}

type Sources = ReturnType<typeof useRevenuePeopleSources>;

function activeSet(users: ActiveUserOption[] | undefined) {
  return new Map((users ?? []).map((u) => [u.user_id, u] as const));
}

function metricUnavailable(s: Sources) {
  const unavailable: string[] = [];
  if (s.bySeller.error) unavailable.push(SOURCE.revenue);
  if (s.closer.error) unavailable.push(SOURCE.closer);
  if (s.sdr.error) unavailable.push(SOURCE.sdr);
  if (s.team.error) unavailable.push(SOURCE.team);
  if (s.quality.error) unavailable.push(SOURCE.quality);
  if (s.ote.error) unavailable.push(SOURCE.ote);
  if (s.activeUsers.error) unavailable.push(SOURCE.activeUsers);
  if (s.salesPipeline.isError) unavailable.push('Pipeline de Vendas');
  if (s.winLoss.error) unavailable.push(SOURCE.winloss);
  return unavailable;
}

export function mergePeopleSignals(s: Sources): PeopleData {
  const active = activeSet(s.activeUsers.data);
  const isActive = (id?: string | null) => !!id && active.has(id);
  const userName = (id: string, fallback?: string | null) => active.get(id)?.full_name || fallback || 'Sem nome';
  const unavailable = metricUnavailable(s);

  const sdrMap = new Map<string, PeopleSdrSnapshotRow>();
  const closerMap = new Map<string, PeopleCloserSnapshotRow & { goalPct?: number | null; goalStatus?: string }>();

  const ensureSdr = (userId: string, name?: string | null) => {
    const current = sdrMap.get(userId);
    if (current) return current;
    const row: PeopleSdrSnapshotRow = {
      userId,
      name: userName(userId, name),
      qualified: null,
      withProposal: null,
      withoutProposal: null,
      sqlToProposalPct: null,
      sqlToWonPct: null,
      revenue: null,
      goalPct: null,
      goalStatus: 'Sem meta OTE',
      classification: 'insufficient',
      classificationLabel: 'Sem dados suficientes',
      sources: {},
    };
    sdrMap.set(userId, row);
    return row;
  };

  const ensureCloser = (userId: string, name?: string | null) => {
    const current = closerMap.get(userId);
    if (current) return current;
    const row: PeopleCloserSnapshotRow & { goalPct?: number | null; goalStatus?: string } = {
      userId,
      name: userName(userId, name),
      revenue: null,
      won: null,
      lost: null,
      winRatePct: null,
      avgTicket: null,
      activePipeline: null,
      avgCycleDays: null,
      classification: 'insufficient',
      classificationLabel: 'Sem dados suficientes',
      sources: {},
      goalPct: null,
      goalStatus: 'Sem meta OTE',
    };
    closerMap.set(userId, row);
    return row;
  };

  mapSdrV2(s.sdr.data).rows.filter((r) => isActive(r.sdrUserId)).forEach((r) => {
    const row = ensureSdr(r.sdrUserId, r.sdrName);
    row.qualified = r.sqlsGenerated;
    row.sqlToWonPct = r.winRatePct;
    row.revenue = r.revenueAttributed;
    row.sources = { ...row.sources, qualified: SOURCE.sdr, sqlToWonPct: SOURCE.sdr, revenue: SOURCE.sdr };
  });

  (s.quality.data?.rows ?? []).filter((r) => isActive(r.sdr_user_id)).forEach((r) => {
    const row = ensureSdr(r.sdr_user_id as string, r.sdr_name);
    row.qualified = row.qualified ?? r.qualified_count;
    row.withProposal = r.with_proposal_count;
    row.withoutProposal = r.without_proposal_count;
    row.sqlToProposalPct = r.sql_to_proposal_rate;
    row.sqlToWonPct = r.sql_to_won_rate;
    row.revenue = r.valid_revenue_amount;
    row.sources = {
      ...row.sources,
      qualified: row.sources?.qualified ?? SOURCE.quality,
      withProposal: SOURCE.quality,
      withoutProposal: SOURCE.quality,
      sqlToProposalPct: SOURCE.quality,
      sqlToWonPct: SOURCE.quality,
      revenue: SOURCE.quality,
    };
  });

  ((s.ote.data ?? []) as any[]).filter((r) => isActive(r.user_id)).forEach((r) => {
    const goalType = (r.goal_type ?? r.ote_level?.goal_type ?? 'revenue') as 'revenue' | 'leads';
    const pct = n(r.achievement_percentage);
    if (goalType === 'leads') {
      const row = ensureSdr(r.user_id, r.profile?.full_name);
      row.qualified = row.qualified ?? n(r.total_sales);
      row.goalPct = pct;
      row.goalStatus = classifyGoal(pct);
      row.sources = { ...row.sources, goalPct: SOURCE.ote, goalStatus: SOURCE.ote, qualified: row.sources?.qualified ?? SOURCE.ote };
    } else {
      const row = ensureCloser(r.user_id, r.profile?.full_name);
      row.goalPct = pct;
      row.goalStatus = classifyGoal(pct);
      row.sources = { ...row.sources, goalPct: SOURCE.ote, goalStatus: SOURCE.ote };
    }
  });

  mapCloserV2(s.closer.data).filter((r) => isActive(r.closerUserId)).forEach((r) => {
    const row = ensureCloser(r.closerUserId, r.closerName);
    row.revenue = r.wonRevenue;
    row.won = r.wonCount;
    row.lost = r.lostCount;
    row.winRatePct = r.winRatePct;
    row.avgTicket = r.avgWonTicket;
    row.activePipeline = r.activePipelineValue;
    row.avgCycleDays = r.avgSalesCycleDays;
    row.sources = {
      ...row.sources,
      revenue: SOURCE.closer,
      won: SOURCE.closer,
      lost: SOURCE.closer,
      winRatePct: SOURCE.closer,
      avgTicket: SOURCE.closer,
      activePipeline: SOURCE.closer,
      avgCycleDays: SOURCE.closer,
    };
  });

  mapTeamV2(s.team.data).filter((r) => isActive(r.ownerUserId)).forEach((r) => {
    const row = ensureCloser(r.ownerUserId, r.ownerName);
    row.activePipeline = r.activePipelineValue;
    row.sources = { ...row.sources, activePipeline: SOURCE.team };
  });

  (s.bySeller.data ?? []).filter((r) => isActive(r.key)).forEach((r) => {
    const row = ensureCloser(r.key, r.label);
    row.revenue = r.total;
    row.won = r.count;
    row.avgTicket = r.avgTicket;
    row.sources = { ...row.sources, revenue: SOURCE.revenue, won: SOURCE.revenue, avgTicket: SOURCE.revenue };
  });

  (s.winLoss.data?.sellerStats ?? []).filter((r) => isActive(r.userId)).forEach((r) => {
    const row = ensureCloser(r.userId, r.name);
    row.lost = row.lost ?? r.lost;
    row.winRatePct = row.winRatePct ?? r.winRate;
    row.avgCycleDays = row.avgCycleDays ?? r.avgCycle;
    row.sources = {
      ...row.sources,
      lost: row.sources?.lost ?? SOURCE.winloss,
      winRatePct: row.sources?.winRatePct ?? SOURCE.winloss,
      avgCycleDays: row.sources?.avgCycleDays ?? SOURCE.winloss,
    };
  });

  const sdrAll = [...sdrMap.values()]
    .filter((r) => n(r.qualified) > 0 || n(r.revenue) > 0 || has(r.goalPct))
    .map((r) => {
      const cls = classifySdr(r);
      return { ...r, classification: cls.c, classificationLabel: cls.label };
    });

  const closerAll = [...closerMap.values()]
    .filter((r) => n(r.revenue) > 0 || n(r.won) > 0 || n(r.lost) > 0 || n(r.activePipeline) > 0 || has(r.goalPct))
    .map((r) => {
      const cls = classifyCloser(r);
      return { ...r, classification: cls.c, classificationLabel: cls.label };
    });

  const sdrSnapshot = sdrAll.sort((a, b) => n(b.qualified) - n(a.qualified) || n(b.goalPct) - n(a.goalPct)).slice(0, 5);
  const closerSnapshot = closerAll.sort((a, b) => n(b.revenue) - n(a.revenue) || n(b.won) - n(a.won)).slice(0, 5);

  const totalRevenue = s.closedSummary.data?.validTotal ?? s.closedSummary.data?.total ?? 0;
  const sellerRows = (s.bySeller.data ?? []).filter((r) => isActive(r.key)).sort((a, b) => b.total - a.total);
  const top1 = sellerRows[0] ?? null;
  const top3Sum = sellerRows.slice(0, 3).reduce((sum, r) => sum + r.total, 0);
  const top1Pct = totalRevenue > 0 && top1 ? (top1.total / totalRevenue) * 100 : null;
  const top3Pct = totalRevenue > 0 ? (top3Sum / totalRevenue) * 100 : null;
  const bestConverter = closerAll.filter((r) => has(r.winRatePct)).sort((a, b) => n(b.winRatePct) - n(a.winRatePct))[0];
  const topSql = sdrAll.filter((r) => n(r.qualified) > 0).sort((a, b) => n(b.qualified) - n(a.qualified))[0];
  const worstQuality = sdrAll.filter((r) => has(r.sqlToProposalPct) && n(r.qualified) >= 5).sort((a, b) => n(a.sqlToProposalPct) - n(b.sqlToProposalPct))[0];

  const scoreboard: PeopleScoreboard = {
    activePeople: new Set([...sdrAll.map((r) => r.userId), ...closerAll.map((r) => r.userId)]).size,
    topPerformer: top1 ? { name: top1.label, value: top1.total } : null,
    bestConverter: bestConverter ? { name: bestConverter.name, pct: n(bestConverter.winRatePct) } : null,
    topSqlVolume: topSql ? { name: topSql.name, count: n(topSql.qualified) } : null,
    worstQuality: worstQuality ? { name: worstQuality.name, pct: n(worstQuality.sqlToProposalPct) } : null,
    concentrationTop1Pct: top1Pct,
  };

  const topPerformers: PeopleTopPerformer[] = [
    ...closerSnapshot.filter((r) => n(r.revenue) > 0).slice(0, 3).map((r) => ({
      userId: r.userId,
      name: r.name,
      role: 'Closer' as const,
      primaryMetric: `${fmtBRL(n(r.revenue))} em receita válida`,
      contribution: `${n(r.won)} venda(s) ganha(s)${has(r.winRatePct) ? ` · Win Rate ${n(r.winRatePct).toFixed(0)}%` : ''}`,
      cta: CLOSER_CTA,
    })),
    ...sdrSnapshot.filter((r) => n(r.qualified) > 0 && (r.goalPct ?? 0) >= 100).slice(0, 2).map((r) => ({
      userId: r.userId,
      name: r.name,
      role: 'SDR' as const,
      primaryMetric: `${n(r.qualified)} SQLs · ${n(r.goalPct).toFixed(0)}% da meta`,
      contribution: r.goalStatus ?? 'Meta OTE',
      cta: OTE_CTA,
    })),
  ].slice(0, 5);

  const needsHelp: PeopleNeedsHelpItem[] = [
    ...closerSnapshot.filter((r) => ['risk', 'attention'].includes(r.classification)).slice(0, 3).map((r) => ({
      userId: r.userId,
      name: r.name,
      role: 'Closer' as const,
      problem: has(r.winRatePct) ? `Win Rate ${n(r.winRatePct).toFixed(0)}%` : 'Fonte de conversão indisponível',
      impact: has(r.activePipeline) ? `Pipeline ativo ${fmtBRL(n(r.activePipeline))}` : 'Fonte de pipeline indisponível',
      cta: CLOSER_CTA,
    })),
    ...sdrSnapshot.filter((r) => ['risk', 'attention', 'volume_no_quality'].includes(r.classification)).slice(0, 3).map((r) => ({
      userId: r.userId,
      name: r.name,
      role: 'SDR' as const,
      problem: has(r.sqlToProposalPct) ? `SQL→Proposta ${n(r.sqlToProposalPct).toFixed(0)}%` : `${n(r.qualified)} SQLs sem qualidade carregada`,
      impact: r.goalStatus ?? 'Status OTE indisponível',
      cta: QUALITY_CTA,
    })),
  ].slice(0, 5);

  let level: PeopleConcentration['level'] = 'healthy';
  let message = 'Distribuição saudável da receita entre o time.';
  if (top1Pct === null) message = 'Sem receita válida no período para calcular concentração.';
  else if (top1Pct > 85) { level = 'critical'; message = `${top1Pct.toFixed(0)}% da receita válida está concentrada em ${top1?.label}.`; }
  else if (top1Pct > 70) { level = 'warning'; message = `${top1Pct.toFixed(0)}% da receita válida vem de ${top1?.label}.`; }
  else if (top3Pct !== null && top3Pct > 90) { level = 'info'; message = `${top3Pct.toFixed(0)}% da receita está concentrada no top 3.`; }

  const concentration: PeopleConcentration = { top1Pct, top1Name: top1?.label ?? null, top3Pct, totalRevenue, level, message };
  const actions: PeopleRecommendedAction[] = [];
  const riskyCloser = closerSnapshot.find((r) => r.classification === 'risk');
  const weakSdr = sdrSnapshot.find((r) => r.classification === 'volume_no_quality' || r.classification === 'risk');
  if (riskyCloser) actions.push({ id: 'closer-risk', title: 'Apoiar closer em risco', reason: `${riskyCloser.name}: ${riskyCloser.classificationLabel}.`, priority: 'alta', person: { name: riskyCloser.name, role: 'Closer' }, cta: CLOSER_CTA });
  if (weakSdr) actions.push({ id: 'sdr-quality', title: 'Revisar qualificação de SDR', reason: `${weakSdr.name}: ${weakSdr.classificationLabel}.`, priority: 'alta', person: { name: weakSdr.name, role: 'SDR' }, cta: QUALITY_CTA });
  if (level === 'warning' || level === 'critical') actions.push({ id: 'concentration', title: 'Revisar concentração de receita', reason: message, priority: level === 'critical' ? 'alta' : 'média', cta: PIPELINE_CTA });
  if (actions.length === 0) actions.push({ id: 'stable', title: 'Operação estável', reason: 'Nenhuma intervenção crítica detectada nas fontes oficiais carregadas.', priority: 'baixa', cta: OTE_CTA });

  return {
    scoreboard,
    topPerformers,
    needsHelp,
    sdrSnapshot,
    closerSnapshot,
    concentration,
    actions,
    meta: {
      generatedAt: new Date().toISOString(),
      period: { start: s.start, end: s.end },
      sources: Object.values(SOURCE),
      partialSources: unavailable,
      blockSources: {
        sdr: unavailable.filter((x) => [SOURCE.sdr, SOURCE.quality, SOURCE.ote].includes(x as any)),
        closer: unavailable.filter((x) => [SOURCE.revenue, SOURCE.closer, SOURCE.team, SOURCE.winloss, SOURCE.ote].includes(x as any)),
      },
      confidence: unavailable.length === 0 ? 'trusted' : unavailable.length >= 3 ? 'warning' : 'partial',
    },
  };
}

export function useRevenuePeopleReset() {
  const sources = useRevenuePeopleSources();
  return useMemo(() => {
    if (sources.isLoading) return { data: null, isLoading: true, error: null };
    return { data: mergePeopleSignals(sources), isLoading: false, error: null };
  }, [sources]);
}