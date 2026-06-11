/**
 * Sprint REVOPS V3.4 — Hook agregador da aba "Pessoas" do Revenue Command Center.
 *
 * Consome SOMENTE fontes oficiais já existentes:
 *  - useRevenueBySeller / useClosedRevenueSummary (commercial_won_revenue_view SSoT)
 *  - useQualificationQualityV2 (Qualidade de Qualificação SDR)
 *  - useReportCloserV2 (Performance Closer V2)
 *  - useReportSDRV2 (Performance SDR V2)
 *
 * Não cria nem altera qualquer view, edge function ou regra financeira.
 * Camada puramente de leitura — apenas síntese executiva.
 */
import { useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import {
  useClosedRevenueSummary,
  useRevenueBySeller,
} from '@/hooks/revenue/useRevenueSsot';
import { useQualificationQualityV2 } from '@/hooks/reports/useQualificationQualityV2';
import { useReportCloserV2 } from '@/hooks/useReportCloserV2';
import { useReportSDRV2 } from '@/hooks/useReportSDRV2';
import { useOTEMonthlyResults, type OTEMonthlyResult } from '@/hooks/useOTEData';
import { useActiveUsers } from '@/hooks/users/useActiveUsers';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapCloserV2 } from '@/lib/reports/mappers/mapCloserV2';
import { mapSdrV2 } from '@/lib/reports/mappers/mapSdrV2';

export type PeopleClassification =
  | 'high'
  | 'good'
  | 'attention'
  | 'risk'
  | 'volume_no_quality'
  | 'low_volume'
  | 'insufficient';

export interface PeopleScoreboard {
  activePeople: number;
  topPerformer: { name: string; value: number } | null;
  bestConverter: { name: string; pct: number } | null;
  topSqlVolume: { name: string; count: number } | null;
  worstQuality: { name: string; pct: number } | null;
  concentrationTop1Pct: number | null;
}

export interface PeopleTopPerformer {
  userId: string;
  name: string;
  role: 'Closer' | 'SDR';
  primaryMetric: string;
  contribution: string;
  cta: { label: string; to: string };
}

export interface PeopleNeedsHelpItem {
  userId: string;
  name: string;
  role: 'Closer' | 'SDR';
  problem: string;
  impact: string;
  cta: { label: string; to: string };
}

export interface PeopleSdrSnapshotRow {
  userId: string;
  name: string;
  qualified: number | null;
  withProposal: number | null;
  withoutProposal: number | null;
  sqlToProposalPct: number | null;
  sqlToWonPct: number | null;
  revenue: number | null;
  classification: PeopleClassification;
  classificationLabel: string;
}

export interface PeopleCloserSnapshotRow {
  userId: string;
  name: string;
  revenue: number | null;
  won: number | null;
  lost: number | null;
  winRatePct: number | null;
  avgTicket: number | null;
  activePipeline: number | null;
  avgCycleDays: number | null;
  classification: PeopleClassification;
  classificationLabel: string;
}

export interface PeopleConcentration {
  top1Pct: number | null;
  top1Name: string | null;
  top3Pct: number | null;
  totalRevenue: number;
  level: 'healthy' | 'info' | 'warning' | 'critical';
  message: string;
}

export interface PeopleRecommendedAction {
  id: string;
  title: string;
  reason: string;
  priority: 'alta' | 'média' | 'baixa';
  person?: { name: string; role: string };
  cta: { label: string; to: string };
}

export interface PeopleData {
  scoreboard: PeopleScoreboard;
  topPerformers: PeopleTopPerformer[];
  needsHelp: PeopleNeedsHelpItem[];
  sdrSnapshot: PeopleSdrSnapshotRow[];
  closerSnapshot: PeopleCloserSnapshotRow[];
  concentration: PeopleConcentration;
  actions: PeopleRecommendedAction[];
  meta: {
    generatedAt: string;
    period: { start: string; end: string };
    sources: string[];
    partialSources: string[];
    confidence: 'trusted' | 'partial' | 'warning';
  };
}

const SDR_CTA = { label: 'Ver Desempenho SDR', to: '/app/objetivos/desempenho?tab=sdr' };
const CLOSER_CTA = { label: 'Ver Desempenho Closer', to: '/app/objetivos/desempenho?tab=closer' };
const QUALITY_CTA = { label: 'Ver Qualidade de Qualificação', to: '/app/objetivos/desempenho?tab=qualidade' };
const PIPELINE_CTA = { label: 'Abrir Pipeline', to: '/app/opportunities' };
const OTE_CTA = { label: 'Ver OTE', to: '/app/reports/ote' };

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

// Helpers — null-safe agregação entre fontes.
function maxN(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}
function pickFirst<T>(a: T | null, b: T | null): T | null {
  return a !== null && a !== undefined ? a : b ?? null;
}
function num(v: number | null): number {
  return v ?? 0;
}

function classifySdr(row: {
  qualified: number | null;
  withProposal: number | null;
  sqlToProposalPct: number | null;
  sqlToWonPct: number | null;
}): { c: PeopleClassification; label: string } {
  const qualified = num(row.qualified);
  const sqlToProposalKnown = row.sqlToProposalPct !== null;
  const sqlToProp = num(row.sqlToProposalPct);
  const sqlToWon = num(row.sqlToWonPct);
  if (qualified < 3) return { c: 'insufficient', label: 'Sem dados suficientes' };
  if (sqlToProposalKnown && qualified >= 20 && sqlToProp < 30)
    return { c: 'volume_no_quality', label: 'Volume sem qualidade' };
  if (qualified < 8) return { c: 'low_volume', label: 'Baixo volume' };
  if (!sqlToProposalKnown) return { c: 'insufficient', label: 'Qualidade sem fonte' };
  if (sqlToProp >= 60 && sqlToWon >= 15)
    return { c: 'high', label: 'Alta qualidade' };
  if (sqlToProp >= 40) return { c: 'good', label: 'Bom' };
  return { c: 'attention', label: 'Atenção' };
}

function classifyCloser(row: {
  won: number | null;
  lost: number | null;
  winRatePct: number | null;
  revenue: number | null;
}): { c: PeopleClassification; label: string } {
  const won = num(row.won);
  const lost = num(row.lost);
  const processed = won + lost;
  const revenue = num(row.revenue);
  if (processed < 3 && revenue <= 0) return { c: 'insufficient', label: 'Sem dados suficientes' };
  if (row.winRatePct === null && processed < 3) {
    return { c: 'insufficient', label: 'Win Rate sem fonte' };
  }
  const wr = row.winRatePct ?? (processed > 0 ? (won / processed) * 100 : 0);
  if (wr >= 50 && revenue > 0) return { c: 'high', label: 'Alta performance' };
  if (wr >= 30) return { c: 'good', label: 'Bom' };
  if (wr >= 15) return { c: 'attention', label: 'Atenção' };
  return { c: 'risk', label: 'Risco' };
}

export function useRevenuePeople() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const filtersCtx = useReportFiltersContext();
  const teamVisibility = useTeamVisibility();

  const { filters, effectiveDates } = filtersCtx;

  const now = useMemo(() => new Date(), []);
  const periodStart = useMemo(
    () =>
      effectiveDates?.startDate
        ? new Date(effectiveDates.startDate)
        : startOfMonth(now),
    [effectiveDates?.startDate, now],
  );
  const periodEnd = useMemo(
    () => (effectiveDates?.endDate ? new Date(effectiveDates.endDate) : now),
    [effectiveDates?.endDate, now],
  );
  const start = periodStart.toISOString();
  const end = periodEnd.toISOString();

  // 1) Receita válida agregada (SSoT) — para concentração total
  const closedSummary = useClosedRevenueSummary({
    surface: 'revenue-command:people',
    organizationId: orgId ?? undefined,
    start,
    end,
    pipelineIds: filters?.pipelines?.length ? filters.pipelines : undefined,
  });

  // 2) Receita por vendedor (SSoT) — fonte canônica para top performer
  const bySeller = useRevenueBySeller({
    surface: 'revenue-command:people',
    organizationId: orgId ?? undefined,
    start,
    end,
    pipelineIds: filters?.pipelines?.length ? filters.pipelines : undefined,
  });

  // 3) Closer V2 — win rate, ticket médio, ciclo
  const closerRequest = useMemo(() => {
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

  const closerReport = useReportCloserV2({
    organizationId: orgId,
    request: closerRequest,
  });

  const sdrReport = useReportSDRV2({
    organizationId: orgId,
    request: closerRequest,
  });

  // 4) Qualidade de qualificação — SDR volume vs qualidade
  const qualification = useQualificationQualityV2({
    proposalStatus: 'any',
    includeRemovedUsers: false,
  });

  // 5) OTE — mesma fonte do Campeonato Comercial / Objetivos → Resultados.
  //    Usa o mês de periodStart como bucket (period_month = 'yyyy-MM').
  const periodMonth = useMemo(() => format(periodStart, 'yyyy-MM'), [periodStart]);
  const oteResultsQuery = useOTEMonthlyResults(periodMonth);

  // HOTFIX RCC V3.4C — aba Pessoas reflete operação atual.
  // Fonte oficial de usuários ativos/elegíveis: crm_active_users_view.
  const activeUsersQuery = useActiveUsers();

  return useMemo<{ data: PeopleData | null; isLoading: boolean; error: Error | null }>(() => {
    const isLoading =
      closedSummary.isLoading ||
      bySeller.isLoading ||
      closerReport.isLoading ||
      sdrReport.isLoading ||
      qualification.isLoading ||
      oteResultsQuery.isLoading ||
      activeUsersQuery.isLoading ||
      teamVisibility.loading;

    const partialSources: string[] = [];
    if (closedSummary.error) partialSources.push('Resultados/Auditoria');
    if (bySeller.error) partialSources.push('Receita por vendedor');
    if (closerReport.error) partialSources.push('Performance Closer');
    if (sdrReport.error) partialSources.push('Performance SDR');
    if (qualification.error) partialSources.push('Qualidade de Qualificação');
    if (oteResultsQuery.error) partialSources.push('OTE / Resultados');

    if (!orgId) {
      return { data: null, isLoading: true, error: null };
    }

    // ── Filtro canônico: apenas usuários ativos/elegíveis da operação atual.
    const activeUserIds = new Set<string>(
      (activeUsersQuery.data ?? []).map((u) => u.user_id).filter(Boolean),
    );
    const isActiveEligibleUser = (userId?: string | null) =>
      !!userId && activeUserIds.has(userId);

    const sellerRows = (bySeller.data ?? [])
      .filter((s) => s.total > 0 && s.key && s.key !== '—' && isActiveEligibleUser(s.key))
      .sort((a, b) => b.total - a.total);

    const closerRowsRaw = mapCloserV2(closerReport.data);
    const closerRowsAll = closerRowsRaw.filter(
      (r) =>
        r.closerUserId &&
        isActiveEligibleUser(r.closerUserId) &&
        r.closerName &&
        r.closerName !== 'Sem nome' &&
        r.closerName !== 'Desconhecido',
    );

    const sdrView = mapSdrV2(sdrReport.data);
    const sdrSourceRows = sdrView.rows.filter(
      (r) =>
        r.sdrUserId &&
        isActiveEligibleUser(r.sdrUserId) &&
        r.sdrName &&
        r.sdrName !== 'Sem nome' &&
        r.sdrName !== 'Desconhecido',
    );

    // Qualidade — preferida; fallback para useReportSDRV2 quando vazia/falha.
    const qualRowsAll = (qualification.data?.rows ?? []).filter(
      (r) =>
        r.sdr_user_id &&
        isActiveEligibleUser(r.sdr_user_id) &&
        r.sdr_name &&
        r.sdr_name !== 'Sem nome',
    );

    type SdrFull = PeopleSdrSnapshotRow;
    const sdrMap = new Map<string, SdrFull>();
    const upsertSdr = (row: SdrFull) => {
      const existing = sdrMap.get(row.userId);
      if (!existing) {
        sdrMap.set(row.userId, row);
        return;
      }
      const merged: SdrFull = {
        ...existing,
        qualified: maxN(existing.qualified, row.qualified),
        withProposal: maxN(existing.withProposal, row.withProposal),
        withoutProposal: maxN(existing.withoutProposal, row.withoutProposal),
        sqlToProposalPct: maxN(existing.sqlToProposalPct, row.sqlToProposalPct),
        sqlToWonPct: maxN(existing.sqlToWonPct, row.sqlToWonPct),
        revenue: maxN(existing.revenue, row.revenue),
        name: existing.name?.includes('(removido)') ? row.name : existing.name,
      };
      const cls = classifySdr(merged);
      sdrMap.set(row.userId, { ...merged, classification: cls.c, classificationLabel: cls.label });
    };

    // Fonte 1: Qualidade de Qualificação (preferida, traz proposta/venda/receita).
    qualRowsAll.forEach((r) => {
      const base = {
        userId: r.sdr_user_id as string,
        name: r.sdr_is_deleted ? `${r.sdr_name} (removido)` : r.sdr_name,
        qualified: r.qualified_count,
        withProposal: r.with_proposal_count,
        withoutProposal: r.without_proposal_count,
        sqlToProposalPct: r.sql_to_proposal_rate,
        sqlToWonPct: r.sql_to_won_rate,
        revenue: r.valid_revenue_amount,
      };
      const cls = classifySdr(base);
      upsertSdr({ ...base, classification: cls.c, classificationLabel: cls.label });
    });
    // Fonte 2: SDR V2 — só volume e receita atribuída. Proposta/% ficam N/D.
    sdrSourceRows.forEach((r) => {
      const base = {
        userId: r.sdrUserId,
        name: r.sdrName,
        qualified: r.sqlsGenerated,
        withProposal: null,
        withoutProposal: null,
        sqlToProposalPct: null,
        sqlToWonPct: null,
        revenue: r.revenueAttributed > 0 ? r.revenueAttributed : null,
      };
      const cls = classifySdr(base);
      upsertSdr({ ...base, classification: cls.c, classificationLabel: cls.label });
    });

    // ── Closer full
    type CloserFull = PeopleCloserSnapshotRow;
    const closerMap = new Map<string, CloserFull>();
    const upsertCloser = (row: CloserFull) => {
      const existing = closerMap.get(row.userId);
      if (!existing) {
        closerMap.set(row.userId, row);
        return;
      }
      const merged: CloserFull = {
        ...existing,
        revenue: maxN(existing.revenue, row.revenue),
        won: maxN(existing.won, row.won),
        lost: maxN(existing.lost, row.lost),
        winRatePct: pickFirst(existing.winRatePct, row.winRatePct),
        avgTicket: maxN(existing.avgTicket, row.avgTicket),
        activePipeline: maxN(existing.activePipeline, row.activePipeline),
        avgCycleDays: pickFirst(existing.avgCycleDays, row.avgCycleDays),
        name: existing.name?.includes('(removido)') ? row.name : existing.name,
      };
      const cls = classifyCloser(merged);
      closerMap.set(row.userId, { ...merged, classification: cls.c, classificationLabel: cls.label });
    };

    // Fonte 1: Closer V2 — métrica completa (won/lost/winRate/ticket/pipeline/ciclo).
    closerRowsAll.forEach((r) => {
      const base = {
        userId: r.closerUserId,
        name: r.closerName ?? 'Sem responsável',
        revenue: r.wonRevenue,
        won: r.wonCount,
        lost: r.lostCount,
        winRatePct: r.winRatePct,
        avgTicket: r.avgWonTicket,
        activePipeline: r.activePipelineValue,
        avgCycleDays: r.avgSalesCycleDays,
      };
      const cls = classifyCloser(base);
      upsertCloser({ ...base, classification: cls.c, classificationLabel: cls.label });
    });

    // Fonte 2: Receita por vendedor (SSoT) — preenche revenue/won/ticket quando
    // Closer V2 não trouxe o usuário. Lost/pipeline/ciclo ficam N/D.
    sellerRows.forEach((s) => {
      const base = {
        userId: s.key,
        name: s.label,
        revenue: s.total,
        won: s.count,
        lost: null,
        winRatePct: null as number | null,
        avgTicket: s.avgTicket,
        activePipeline: null,
        avgCycleDays: null as number | null,
      };
      const cls = classifyCloser(base);
      upsertCloser({ ...base, classification: cls.c, classificationLabel: cls.label });
    });

    // ── OTE — mesma fonte do Campeonato Comercial / Resultados.
    //    Garante que Bruno/Gustavo (leads) e Wagner (revenue) apareçam mesmo
    //    quando outros relatórios não trouxeram amostra.
    interface OteSignalRow {
      userId: string;
      name: string;
      role: 'SDR' | 'Closer';
      goalType: 'leads' | 'revenue';
      goal: number;
      realized: number;
      pct: number;
      flagColor?: string;
      finalVariable: number;
      levelName?: string;
    }
    const oteRows: OteSignalRow[] = [];
    const oteResults = ((oteResultsQuery.data ?? []) as OTEMonthlyResult[]).filter((r) =>
      isActiveEligibleUser(r.user_id),
    );
    oteResults.forEach((r) => {
      const goalType: 'leads' | 'revenue' =
        (r.goal_type as 'leads' | 'revenue') ??
        (r.ote_level?.goal_type as 'leads' | 'revenue') ??
        'revenue';
      const profileName = r.profile?.full_name?.trim();
      const name = profileName || 'Usuário removido';
      const goal = Number(r.goal_amount || 0);
      const realized = Number(r.total_sales || 0);
      const pct = Number(r.achievement_percentage || 0);
      const signal: OteSignalRow = {
        userId: r.user_id,
        name,
        role: goalType === 'leads' ? 'SDR' : 'Closer',
        goalType,
        goal,
        realized,
        pct,
        flagColor: r.flag_color,
        finalVariable: Number(r.final_variable_amount || 0),
        levelName: r.level_name_snapshot ?? r.ote_level?.level_name,
      };
      oteRows.push(signal);

      if (goalType === 'leads') {
        const base = {
          userId: r.user_id,
          name,
          qualified: realized,
          withProposal: 0,
          withoutProposal: realized,
          sqlToProposalPct: 0,
          sqlToWonPct: 0,
          revenue: 0,
        };
        const cls = classifySdr(base);
        upsertSdr({ ...base, classification: cls.c, classificationLabel: cls.label });
      } else {
        const base = {
          userId: r.user_id,
          name,
          revenue: realized,
          won: 0,
          lost: 0,
          winRatePct: null as number | null,
          avgTicket: 0,
          activePipeline: 0,
          avgCycleDays: null as number | null,
        };
        const cls = classifyCloser(base);
        upsertCloser({ ...base, classification: cls.c, classificationLabel: cls.label });
      }
    });

    const sdrFull: SdrFull[] = Array.from(sdrMap.values());
    const closerFull: CloserFull[] = Array.from(closerMap.values());

    const sdrSnapshot: PeopleSdrSnapshotRow[] = [...sdrFull]
      .sort((a, b) => b.qualified - a.qualified)
      .slice(0, 5);
    const closerSnapshot: PeopleCloserSnapshotRow[] = [...closerFull]
      .sort((a, b) => b.revenue - a.revenue || b.won - a.won)
      .slice(0, 5);

    // ── Scoreboard (derivado das listas COMPLETAS, não do top-5)
    const totalRevenue = closedSummary.data?.validTotal ?? 0;
    const top1 = sellerRows[0] ?? null;
    const top3Sum = sellerRows.slice(0, 3).reduce((s, r) => s + r.total, 0);
    const top1Pct = totalRevenue > 0 && top1 ? (top1.total / totalRevenue) * 100 : null;
    const top3Pct = totalRevenue > 0 ? (top3Sum / totalRevenue) * 100 : null;

    const bestConverterRow = [...closerFull]
      .filter((r) => r.winRatePct !== null && r.won + r.lost >= 3)
      .sort((a, b) => (b.winRatePct ?? 0) - (a.winRatePct ?? 0))[0];
    const topSqlVolumeRow = [...sdrFull]
      .filter((r) => r.qualified > 0)
      .sort((a, b) => b.qualified - a.qualified)[0];
    const worstQualityRow =
      [...sdrFull]
        .filter((r) => r.qualified >= 5 && r.sqlToProposalPct > 0)
        .sort((a, b) => a.sqlToProposalPct - b.sqlToProposalPct)[0] ??
      // Fallback: SDR com menor % de meta OTE (leads).
      (oteRows
        .filter((o) => o.role === 'SDR' && o.goal > 0)
        .sort((a, b) => a.pct - b.pct)[0]
        ? (() => {
            const o = oteRows
              .filter((x) => x.role === 'SDR' && x.goal > 0)
              .sort((a, b) => a.pct - b.pct)[0];
            return {
              userId: o.userId,
              name: o.name,
              qualified: o.realized,
              withProposal: 0,
              withoutProposal: o.realized,
              sqlToProposalPct: o.pct,
              sqlToWonPct: 0,
              revenue: 0,
              classification: 'attention' as PeopleClassification,
              classificationLabel: `Meta de leads em ${o.pct.toFixed(0)}%`,
            } satisfies PeopleSdrSnapshotRow;
          })()
        : undefined);

    // Pessoas Ativas — qualquer sinal comercial no período (não só receita).
    const activePeople = new Set<string>([
      ...sellerRows.map((s) => s.key),
      ...closerFull
        .filter((r) => r.won + r.lost > 0 || r.activePipeline > 0 || r.revenue > 0)
        .map((r) => r.userId),
      ...sdrFull.filter((r) => r.qualified > 0 || r.revenue > 0).map((r) => r.userId),
      ...oteRows.filter((r) => r.goal > 0 || r.realized > 0).map((r) => r.userId),
    ]).size;

    const scoreboard: PeopleScoreboard = {
      activePeople,
      topPerformer: top1 ? { name: top1.label, value: top1.total } : null,
      bestConverter: bestConverterRow
        ? { name: bestConverterRow.name, pct: bestConverterRow.winRatePct ?? 0 }
        : null,
      topSqlVolume: topSqlVolumeRow
        ? { name: topSqlVolumeRow.name, count: topSqlVolumeRow.qualified }
        : null,
      worstQuality: worstQualityRow
        ? { name: worstQualityRow.name, pct: worstQualityRow.sqlToProposalPct }
        : null,
      concentrationTop1Pct: top1Pct,
    };

    if (typeof window !== 'undefined' && (window as any).__DEV_RCC_PEOPLE__) {
      // eslint-disable-next-line no-console
      console.debug('[RCC V3.4B] Pessoas', {
        period: { start, end, periodMonth },
        sellerRows: sellerRows.length,
        sdrFull: sdrFull.length,
        closerFull: closerFull.length,
        qualRows: qualRowsAll.length,
        sdrV2Rows: sdrSourceRows.length,
        oteRows: oteRows.length,
        activePeople,
        qualificationError: !!qualification.error,
        closerError: !!closerReport.error,
        sdrError: !!sdrReport.error,
        oteError: !!oteResultsQuery.error,
      });
    }

    // ── Top performers (até 5)
    const topPerformers: PeopleTopPerformer[] = [];
    closerSnapshot
      .filter((r) => r.revenue > 0)
      .slice(0, 3)
      .forEach((r) =>
        topPerformers.push({
          userId: r.userId,
          name: r.name,
          role: 'Closer',
          primaryMetric: `${fmtBRL(r.revenue)} em receita válida`,
          contribution: `${r.won} venda(s) ganha(s)${r.winRatePct !== null ? ` · Win Rate ${r.winRatePct.toFixed(0)}%` : ''}`,
          cta: CLOSER_CTA,
        }),
      );

    // Fallback: garante que o Top Performer apareça em "Quem está carregando".
    if (top1 && !topPerformers.some((p) => p.userId === top1.key)) {
      topPerformers.unshift({
        userId: top1.key,
        name: top1.label,
        role: 'Closer',
        primaryMetric: `${fmtBRL(top1.total)} em receita válida`,
        contribution: 'Maior contribuição em receita válida no período.',
        cta: CLOSER_CTA,
      });
    }
    // Fallback OTE: closers/SDRs com alta % de meta que ainda não entraram.
    oteRows
      .filter((o) => o.goal > 0 && o.pct >= 100)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
      .forEach((o) => {
        if (topPerformers.some((p) => p.userId === o.userId)) return;
        topPerformers.push({
          userId: o.userId,
          name: o.name,
          role: o.role,
          primaryMetric:
            o.goalType === 'revenue'
              ? `${fmtBRL(o.realized)} · ${o.pct.toFixed(0)}% da meta`
              : `${o.realized} leads · ${o.pct.toFixed(0)}% da meta`,
          contribution: o.levelName ? `Nível ${o.levelName}` : 'Acima da meta OTE',
          cta: OTE_CTA,
        });
      });

    // ── Quem precisa de ajuda (até 5)
    const needsHelp: PeopleNeedsHelpItem[] = [];
    closerSnapshot
      .filter((r) => r.classification === 'risk' || r.classification === 'attention')
      .slice(0, 3)
      .forEach((r) =>
        needsHelp.push({
          userId: r.userId,
          name: r.name,
          role: 'Closer',
          problem:
            r.winRatePct !== null
              ? `Win Rate baixo (${r.winRatePct.toFixed(0)}%) com ${r.lost} perdido(s)`
              : `${r.lost} perdido(s) no período`,
          impact: r.activePipeline > 0 ? `Pipeline ativo ${fmtBRL(r.activePipeline)}` : 'Pipeline vazio',
          cta: CLOSER_CTA,
        }),
      );
    sdrSnapshot
      .filter(
        (r) =>
          r.classification === 'volume_no_quality' || r.classification === 'attention',
      )
      .slice(0, 3)
      .forEach((r) =>
        needsHelp.push({
          userId: r.userId,
          name: r.name,
          role: 'SDR',
          problem: `${r.qualified} SQLs, mas SQL→Proposta de ${r.sqlToProposalPct.toFixed(0)}%`,
          impact: `${r.withoutProposal} SQLs sem proposta`,
          cta: QUALITY_CTA,
        }),
      );

    // Sinais OTE — abaixo da meta / abaixo do mínimo (bandeira vermelha).
    oteRows
      .filter((o) => o.goal > 0 && (o.pct < 70 || o.flagColor === 'red'))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 4)
      .forEach((o) => {
        if (needsHelp.some((p) => p.userId === o.userId)) return;
        const goalLabel = o.goalType === 'revenue' ? 'receita' : 'leads';
        needsHelp.push({
          userId: o.userId,
          name: o.name,
          role: o.role,
          problem: `${o.pct.toFixed(0)}% da meta de ${goalLabel}${o.flagColor === 'red' ? ' · abaixo do mínimo' : ''}`,
          impact:
            o.goalType === 'revenue'
              ? `Realizado ${fmtBRL(o.realized)} de ${fmtBRL(o.goal)}`
              : `${o.realized} de ${o.goal} leads · variável ${fmtBRL(o.finalVariable)}`,
          cta: o.role === 'SDR' ? QUALITY_CTA : OTE_CTA,
        });
      });

    // ── Concentração
    let level: PeopleConcentration['level'] = 'healthy';
    let message = 'Distribuição saudável da receita entre o time.';
    if (top1Pct !== null) {
      if (top1Pct > 85) {
        level = 'critical';
        message = `${top1Pct.toFixed(0)}% da receita válida está concentrada em ${top1?.label}. Risco operacional alto: a operação depende de uma única pessoa.`;
      } else if (top1Pct > 70) {
        level = 'warning';
        message = `${top1Pct.toFixed(0)}% da receita válida vem de ${top1?.label}. Atenção à dependência comercial.`;
      } else if (top3Pct !== null && top3Pct > 90) {
        level = 'info';
        message = `${top3Pct.toFixed(0)}% da receita está concentrada no top 3. Avalie ampliar a base produtiva.`;
      }
    } else {
      message = 'Sem receita válida no período para calcular concentração.';
    }
    const concentration: PeopleConcentration = {
      top1Pct,
      top1Name: top1?.label ?? null,
      top3Pct,
      totalRevenue,
      level,
      message,
    };

    // ── Ações recomendadas
    const actions: PeopleRecommendedAction[] = [];
    const sdrVolumeNoQuality = sdrSnapshot.find((r) => r.classification === 'volume_no_quality');
    if (sdrVolumeNoQuality) {
      actions.push({
        id: 'review-sdr-quality',
        title: 'Revisar qualidade da qualificação',
        reason: `${sdrVolumeNoQuality.name} tem ${sdrVolumeNoQuality.qualified} SQLs com SQL→Proposta de ${sdrVolumeNoQuality.sqlToProposalPct.toFixed(0)}%.`,
        priority: 'alta',
        person: { name: sdrVolumeNoQuality.name, role: 'SDR' },
        cta: QUALITY_CTA,
      });
    }
    const closerRisk = closerSnapshot.find((r) => r.classification === 'risk');
    if (closerRisk) {
      actions.push({
        id: 'help-closer-pipeline',
        title: 'Apoiar closer em risco',
        reason: `${closerRisk.name} está com win rate baixo e pipeline ativo de ${fmtBRL(closerRisk.activePipeline)}.`,
        priority: 'alta',
        person: { name: closerRisk.name, role: 'Closer' },
        cta: PIPELINE_CTA,
      });
    }
    if (level === 'critical' || level === 'warning') {
      actions.push({
        id: 'review-concentration',
        title: 'Revisar concentração de receita',
        reason: message,
        priority: level === 'critical' ? 'alta' : 'média',
        cta: CLOSER_CTA,
      });
    }
    const lowVolumeSdr = sdrSnapshot.find((r) => r.classification === 'low_volume');
    if (lowVolumeSdr) {
      actions.push({
        id: 'increase-sdr-volume',
        title: 'Aumentar volume de qualificação',
        reason: `${lowVolumeSdr.name} qualificou apenas ${lowVolumeSdr.qualified} no período.`,
        priority: 'média',
        person: { name: lowVolumeSdr.name, role: 'SDR' },
        cta: SDR_CTA,
      });
    }
    if (actions.length === 0) {
      actions.push({
        id: 'all-good',
        title: 'Operação estável',
        reason: 'Nenhuma intervenção crítica detectada com os dados disponíveis no período.',
        priority: 'baixa',
        cta: CLOSER_CTA,
      });
    }

    const sources = [
      'Resultados/Auditoria',
      'Receita por vendedor',
      'Performance Closer',
      'Qualidade de Qualificação',
      'OTE / Resultados',
    ];

    const confidence: PeopleData['meta']['confidence'] =
      partialSources.length === 0
        ? 'trusted'
        : partialSources.length >= 3
          ? 'warning'
          : 'partial';

    const data: PeopleData = {
      scoreboard,
      topPerformers,
      needsHelp,
      sdrSnapshot,
      closerSnapshot,
      concentration,
      actions,
      meta: {
        generatedAt: new Date().toISOString(),
        period: { start, end },
        sources,
        partialSources,
        confidence,
      },
    };

    return { data, isLoading: false, error: null };
  }, [
    orgId,
    start,
    end,
    periodMonth,
    closedSummary.data,
    closedSummary.isLoading,
    closedSummary.error,
    bySeller.data,
    bySeller.isLoading,
    bySeller.error,
    closerReport.data,
    closerReport.isLoading,
    closerReport.error,
    sdrReport.data,
    sdrReport.isLoading,
    sdrReport.error,
    qualification.data,
    qualification.isLoading,
    qualification.error,
    oteResultsQuery.data,
    oteResultsQuery.isLoading,
    oteResultsQuery.error,
    activeUsersQuery.data,
    activeUsersQuery.isLoading,
    teamVisibility.loading,
  ]);
}
