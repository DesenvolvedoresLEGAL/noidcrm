import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, startOfQuarter, startOfDay, subDays, subMonths, startOfYear, format } from 'date-fns';
import { computeCrmTrust, computeDeclaredVsInferred } from '@/lib/winloss/lossDiagnosticScore';

// ─── Types ───────────────────────────────────────────────────────────
export interface DateRange {
  from: Date;
  to: Date;
}

export type TimeframePreset = 'today' | '7d' | '15d' | 'month' | 'quarter' | 'semester' | 'year' | 'custom';

export interface WinLossDeal {
  id: string;
  opportunity_id: string;
  outcome: 'won' | 'lost';
  final_value: number;
  sales_cycle_days: number;
  reason_seller?: string;
  competitor?: string;
  opportunity: any;
  reason: any;
  win_reason_id?: string;
  win_reason_name?: string;
  key_differentiator?: string;
  customer_feedback?: string;
  recorded_by_customer?: boolean;
  acceptor_name?: string;
  owner_user_id?: string;
  owner_name?: string;
}

export interface MonthlyPulse {
  month: string;
  monthLabel: string;
  wins: number;
  losses: number;
  winRate: number;
  wonValue: number;
  lostValue: number;
  prevWinRate: number | null;
}

export interface CompetitorStat {
  competitor: string;
  lossCount: number;
  lostValue: number;
  winCount: number;
  winRate: number;
  trend: number; // vs previous period
}

export interface SellerStat {
  userId: string;
  name: string;
  avatarUrl?: string;
  won: number;
  lost: number;
  winRate: number;
  avgTicket: number;
  avgCycle: number;
  totalValue: number;
}

export interface LossMacroGroup {
  category: string;
  label: string;
  count: number;
  specifics: Array<{ name: string; count: number; competitors?: string[] }>;
  competitors?: string[];
}

export interface WonStageRow {
  stageId: string;
  stageName: string;
  count: number;
  value: number;
  avgTicket: number;
  avgCycle: number;
  topDriver?: string;
  fallbackCount: number;
}

export interface LostStageRow {
  stageId: string;
  stageName: string;
  count: number;
  lostValue: number;
  avgTicket: number;
  avgCycle: number;
  topReason?: string;
  fallbackCount: number;
}

export interface WinLossDataResult {
  wins: WinLossDeal[];
  losses: WinLossDeal[];
  allDeals: WinLossDeal[];
  wonCount: number;
  lostCount: number;
  winRate: number;
  wonValue: number;
  lostValue: number;
  avgTicketWon: number;
  avgTicketLost: number;
  lossReasons: Array<{ reason: string; count: number }>;
  lossReasonsByMacro: LossMacroGroup[];
  winReasons: Array<{ reason: string; count: number }>;
  differentiators: Array<{ differentiator: string; count: number }>;
  customerFeedbacks: Array<{ feedback: string; acceptorName: string; winReason?: string; value: number }>;
  lossFeedbacks: Array<{ feedback: string; lossReason?: string; competitor?: string; value: number }>;
  competitors: Array<{ competitor: string; count: number }>;
  competitorStats: CompetitorStat[];
  sellerStats: SellerStat[];
  factors: Record<string, number>;
  avgCycleWon: number | null;
  avgCycleLost: number | null;
  validWinCyclesCount: number;
  validLossCyclesCount: number;
  monthlyPulse: MonthlyPulse[];
  timeToLossDistribution: Array<{ week: string; count: number }>;
  lossMortality: LossMortality;
  wonStageBreakdown: WonStageRow[];
  lostStageBreakdown: LostStageRow[];
  crmTrustDeterministic: import('@/lib/winloss/lossDiagnosticScore').CrmTrustResult;
  declaredVsInferred: import('@/lib/winloss/lossDiagnosticScore').DeclaredVsInferred;
}


export interface LossMortalityBucket {
  key: '0-3' | '4-7' | '8-14' | '15-30' | '31-60' | '61+';
  label: string;
  count: number;
  lostValue: number;
  pct: number;
}

export interface LossMortality {
  buckets: LossMortalityBucket[];
  totalLosses: number;
  totalValue: number;
  peak: LossMortalityBucket | null;
  avgDays: number | null;
  p90Days: number | null;
}


// ─── Helpers ─────────────────────────────────────────────────────────
export function getDateRangeFromPreset(preset: TimeframePreset, custom?: DateRange): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today': return { from: startOfDay(now), to: now };
    case '7d': return { from: startOfDay(subDays(now, 6)), to: now };
    case '15d': return { from: startOfDay(subDays(now, 14)), to: now };
    case 'month': return { from: startOfMonth(now), to: now };
    case 'quarter': return { from: startOfQuarter(now), to: now };
    case 'semester': return { from: subMonths(startOfMonth(now), 5), to: now };
    case 'year': return { from: startOfYear(now), to: now };
    case 'custom': return custom || { from: startOfYear(now), to: now };
  }
}

export function getPipelineTerminology(pipelineType?: string | null) {
  switch (pipelineType) {
    case 'qualification':
      return { wonLabel: 'Lead Qualificado', lostLabel: 'Lead Desqualificado', wonPlural: 'Leads Qualificados', lostPlural: 'Leads Desqualificados', rateLabel: 'Taxa de Qualificação' };
    case 'onboarding':
    case 'cs':
    case 'renewal':
      return { wonLabel: 'Cliente Ativado', lostLabel: 'Churn', wonPlural: 'Clientes Ativados', lostPlural: 'Churns', rateLabel: 'Taxa de Ativação' };
    default:
      return { wonLabel: 'Deal Ganho', lostLabel: 'Deal Perdido', wonPlural: 'Deals Ganhos', lostPlural: 'Deals Perdidos', rateLabel: 'Win Rate' };
  }
}

// Removido filtro heurístico por título ("teste"/"test"): gerava falso positivo
// em deals reais (ex.: "LLC MAKELOVE NOS TESTES DA FORD"). Exclusão de dados de
// teste deve vir de sinal explícito (flag/tag), nunca de substring livre.

// ─── Main Hook ───────────────────────────────────────────────────────
export function useWinLossData(organizationId: string | undefined, pipelineId: string | null, dateRange: DateRange) {
  return useQuery({
    queryKey: ['winloss-prime', organizationId, pipelineId, dateRange.from.getTime(), dateRange.to.getTime()],
    queryFn: async (): Promise<WinLossDataResult> => {
      if (!organizationId) throw new Error('No org');

      const fromISO = dateRange.from.toISOString();

      // 1. If specific pipeline selected, use it; otherwise default to commercial pipelines (sales + qualification)
      let pipelineIds: string[] = [];
      if (pipelineId) {
        pipelineIds = [pipelineId];
      } else {
        const { data: salesPipelines, error: pipeErr } = await supabase
          .from('pipelines')
          .select('id')
          .eq('organization_id', organizationId)
          .in('pipeline_type', ['sales', 'qualification']);
        if (pipeErr) {
          console.error('[useWinLossData] Pipeline fetch error:', pipeErr);
          throw pipeErr;
        }
        pipelineIds = salesPipelines?.map(p => p.id) || [];
      }

      if (pipelineIds.length === 0) {
        return emptyResult();
      }

      // 2. Fetch win_loss_records (simpler query - avoid deep nested joins)
      const { data: records, error: recordsErr } = await supabase
        .from('win_loss_records')
        .select(`
          id, organization_id, opportunity_id, outcome, reason_id, reason_seller, 
          competitor, final_value, original_value, sales_cycle_days, 
          win_reason_id, key_differentiator, customer_feedback, 
          recorded_by_customer, acceptor_name, created_at,
          loss_reason:loss_reasons!win_loss_records_reason_id_fkey(name, category, loss_accountability)
        `)
        .eq('organization_id', organizationId)
        .gte('created_at', fromISO)
        .order('created_at', { ascending: false });

      if (recordsErr) {
        console.error('[useWinLossData] Win/loss records fetch error:', recordsErr);
      }

      const recordsList = records || [];

      // 2b. Fetch win_reasons for IDs present
      const winReasonIds = [...new Set(recordsList.map(r => r.win_reason_id).filter(Boolean))] as string[];
      const winReasonsMap = new Map<string, string>();
      if (winReasonIds.length > 0) {
        const { data: wr } = await supabase
          .from('win_reasons')
          .select('id, name')
          .in('id', winReasonIds);
        wr?.forEach(w => winReasonsMap.set(w.id, w.name));
      }


      // 3. Fetch opportunities directly.
      // PERF 0.6D — server-side filter por `updated_at >= dateRange.from`.
      // Em deals fechados, `updated_at >= closed_at` (status muda dispara update),
      // logo nada que tenha `closed_at` dentro da janela é descartado, e cortamos
      // payload de deals antigos que não pertencem ao período. Mantemos o filtro
      // client-side em seguida como rede de segurança.
      const { data: directOpps, error: oppsErr } = await supabase
        .from('opportunities')
        .select(`id, title, valor_previsto, status, pipeline_id, stage_id, accepted_proposal_id, created_at, updated_at, closed_at, loss_reason_id, loss_comment, owner_user_id, origem, fonte, lead_type, account:accounts(segmento, porte), loss_reason:loss_reasons!opportunities_loss_reason_id_fkey(name, category, loss_accountability)`)
        .eq('organization_id', organizationId)
        .in('status', ['won', 'lost'])
        .in('pipeline_id', pipelineIds)
        .gte('updated_at', fromISO);

      if (oppsErr) {
        console.error('[useWinLossData] Opportunities fetch error:', oppsErr);
        throw oppsErr;
      }

      const filteredOpps = (directOpps || []).filter(opp => {
        const closeDate = new Date((opp as any).closed_at || opp.updated_at || opp.created_at);
        return closeDate >= dateRange.from && closeDate <= dateRange.to;
      });

      // 4. Get owner profiles for seller stats
      const ownerIds = [...new Set(filteredOpps.map(o => o.owner_user_id).filter(Boolean))];
      let profilesMap = new Map<string, { full_name: string; avatar_url?: string }>();
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', ownerIds as string[]);
        profiles?.forEach(p => profilesMap.set(p.user_id, { full_name: p.full_name || 'Sem nome', avatar_url: p.avatar_url || undefined }));
      }

      // 5. Merge data
      const recordsByOppId = new Map(recordsList.map(r => [r.opportunity_id, r]));

      const allDeals: WinLossDeal[] = filteredOpps
        .filter(opp => !isTestOpportunity(opp.title))
        .map(opp => {
          const record = recordsByOppId.get(opp.id);
          let salesCycleDays = 0;
          if (record?.sales_cycle_days && record.sales_cycle_days > 0) {
            salesCycleDays = record.sales_cycle_days;
          } else {
            const closedDate = new Date((opp as any).closed_at || opp.updated_at || record?.created_at);
            const createdDate = new Date(opp.created_at);
            salesCycleDays = Math.max(0, Math.floor((closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
          }
          const profile = opp.owner_user_id ? profilesMap.get(opp.owner_user_id) : undefined;
          // Prefer the dedicated record loss_reason; fallback to opportunity.loss_reason
          const recordLossReason = (record as any)?.loss_reason || null;
          const effectiveReason = recordLossReason || opp.loss_reason;
          return {
            id: record?.id || opp.id,
            opportunity_id: opp.id,
            outcome: opp.status as 'won' | 'lost',
            final_value: record?.final_value || opp.valor_previsto || 0,
            sales_cycle_days: salesCycleDays,
            reason_seller: record?.reason_seller || opp.loss_comment,
            competitor: record?.competitor,
            opportunity: opp,
            reason: effectiveReason,
            win_reason_id: record?.win_reason_id,
            win_reason_name: record?.win_reason_id ? winReasonsMap.get(record.win_reason_id) : undefined,
            key_differentiator: record?.key_differentiator,
            customer_feedback: record?.customer_feedback,
            recorded_by_customer: record?.recorded_by_customer,
            acceptor_name: record?.acceptor_name,
            owner_user_id: opp.owner_user_id || undefined,
            owner_name: profile?.full_name,
          };
        });

      const wins = allDeals.filter(d => d.outcome === 'won');
      const losses = allDeals.filter(d => d.outcome === 'lost');

      // 6. Aggregations
      // Use the actual loss_reason name (specific motive), NOT reason_seller (which is the diagnosis text)
      const lossReasonCounts: Record<string, number> = {};
      losses.forEach(l => {
        const reason = (l.reason as any)?.name || 'Não informado';
        lossReasonCounts[reason] = (lossReasonCounts[reason] || 0) + 1;
      });

      // Group losses by macro category -> specific reasons (and competitors when applicable)
      const macroMap = new Map<string, { count: number; specifics: Map<string, number>; competitors: Set<string> }>();
      losses.forEach(l => {
        const category = (l.reason as any)?.category || 'other';
        const specific = (l.reason as any)?.name || 'Não informado';
        const entry = macroMap.get(category) || { count: 0, specifics: new Map(), competitors: new Set() };
        entry.count++;
        entry.specifics.set(specific, (entry.specifics.get(specific) || 0) + 1);
        if (l.competitor) entry.competitors.add(l.competitor);
        macroMap.set(category, entry);
      });

      const winReasonCounts: Record<string, number> = {};
      wins.forEach(w => {
        // Distinguish: legacy/backfilled wins (no record info) vs new wins where the customer
        // simply hasn't filled the reason yet vs proper named reason.
        const reason = w.win_reason_name
          || (w.acceptor_name && !w.win_reason_id ? 'Sem motivo selecionado' : 'Não informado');
        winReasonCounts[reason] = (winReasonCounts[reason] || 0) + 1;
      });

      const differentiatorCounts: Record<string, number> = {};
      wins.forEach(w => {
        if (w.key_differentiator) {
          w.key_differentiator.split(',').map(d => d.trim()).filter(Boolean).forEach(diff => {
            differentiatorCounts[diff] = (differentiatorCounts[diff] || 0) + 1;
          });
        }
      });

      // Relaxed filter: include feedback even when not formally flagged as customer-recorded
      const customerFeedbacks = wins
        .filter(w => w.customer_feedback && w.customer_feedback.trim().length > 0)
        .map(w => ({ feedback: w.customer_feedback!, acceptorName: w.acceptor_name || (w.recorded_by_customer ? 'Cliente' : 'Vendedor'), winReason: w.win_reason_name, value: w.final_value }))
        .slice(0, 20);

      const lossFeedbacks = losses
        .filter(l => l.customer_feedback && l.customer_feedback.trim().length > 0)
        .map(l => ({ feedback: l.customer_feedback!, lossReason: (l.reason as any)?.name || l.reason_seller, competitor: l.competitor, value: l.final_value }))
        .slice(0, 20);

      const competitorCounts: Record<string, number> = {};
      losses.filter(l => l.competitor).forEach(l => {
        competitorCounts[l.competitor!] = (competitorCounts[l.competitor!] || 0) + 1;
      });

      // Category factors
      const categoryCounts: Record<string, number> = {};
      losses.forEach(l => {
        const category = (l.reason as any)?.category;
        if (category) categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      const factors = {
        price: categoryCounts['price'] || 0,
        timing: categoryCounts['timing'] || 0,
        feature: categoryCounts['no_fit'] || 0,
        relationship: categoryCounts['sales_process'] || 0,
        competition: categoryCounts['competition'] || 0,
        operational: categoryCounts['operational'] || 0,
        internal: categoryCounts['internal'] || 0,
        other: categoryCounts['other'] || 0,
      };

      const wonValue = wins.reduce((sum, w) => sum + (w.final_value || 0), 0);
      const lostValue = losses.reduce((sum, l) => sum + (l.final_value || 0), 0);

      const validWinCycles = wins.filter(w => w.sales_cycle_days > 0);
      const validLossCycles = losses.filter(l => l.sales_cycle_days > 0);
      const avgCycleWon = validWinCycles.length > 0 ? Math.round(validWinCycles.reduce((s, w) => s + w.sales_cycle_days, 0) / validWinCycles.length) : null;
      const avgCycleLost = validLossCycles.length > 0 ? Math.round(validLossCycles.reduce((s, l) => s + l.sales_cycle_days, 0) / validLossCycles.length) : null;

      // 7. Monthly Pulse
      const monthlyMap = new Map<string, { wins: number; losses: number; wonValue: number; lostValue: number }>();
      allDeals.forEach(d => {
        const closeDate = new Date((d.opportunity as any)?.closed_at || d.opportunity?.updated_at || d.opportunity?.created_at);
        const key = format(closeDate, 'yyyy-MM');
        const entry = monthlyMap.get(key) || { wins: 0, losses: 0, wonValue: 0, lostValue: 0 };
        if (d.outcome === 'won') { entry.wins++; entry.wonValue += d.final_value; }
        else { entry.losses++; entry.lostValue += d.final_value; }
        monthlyMap.set(key, entry);
      });
      const sortedMonths = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const monthlyPulse: MonthlyPulse[] = sortedMonths.map(([month, data], idx) => {
        const total = data.wins + data.losses;
        const winRate = total > 0 ? Math.round((data.wins / total) * 100) : 0;
        const prev = idx > 0 ? sortedMonths[idx - 1] : null;
        const prevTotal = prev ? prev[1].wins + prev[1].losses : 0;
        const prevWinRate = prev && prevTotal > 0 ? Math.round((prev[1].wins / prevTotal) * 100) : null;
        const [y, m] = month.split('-');
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return { month, monthLabel: `${monthNames[parseInt(m) - 1]}/${y.slice(2)}`, wins: data.wins, losses: data.losses, winRate, wonValue: data.wonValue, lostValue: data.lostValue, prevWinRate };
      });

      // 8. Competitor Stats (enriched)
      const competitorDeals = new Map<string, { wins: number; losses: number; lostValue: number }>();
      allDeals.forEach(d => {
        if (d.competitor) {
          const entry = competitorDeals.get(d.competitor) || { wins: 0, losses: 0, lostValue: 0 };
          if (d.outcome === 'lost') { entry.losses++; entry.lostValue += d.final_value; }
          if (d.outcome === 'won') { entry.wins++; }
          competitorDeals.set(d.competitor, entry);
        }
      });
      const competitorStats: CompetitorStat[] = [...competitorDeals.entries()]
        .map(([competitor, data]) => ({
          competitor,
          lossCount: data.losses,
          lostValue: data.lostValue,
          winCount: data.wins,
          winRate: (data.wins + data.losses) > 0 ? Math.round((data.wins / (data.wins + data.losses)) * 100) : 0,
          trend: 0,
        }))
        .sort((a, b) => b.lossCount - a.lossCount);

      // 9. Seller Stats
      const sellerMap = new Map<string, { won: number; lost: number; totalValue: number; cycles: number[]; }>();
      allDeals.forEach(d => {
        if (!d.owner_user_id) return;
        const entry = sellerMap.get(d.owner_user_id) || { won: 0, lost: 0, totalValue: 0, cycles: [] };
        if (d.outcome === 'won') { entry.won++; entry.totalValue += d.final_value; }
        else entry.lost++;
        if (d.sales_cycle_days > 0) entry.cycles.push(d.sales_cycle_days);
        sellerMap.set(d.owner_user_id, entry);
      });
      const sellerStats: SellerStat[] = [...sellerMap.entries()]
        .map(([userId, data]) => {
          const profile = profilesMap.get(userId);
          const total = data.won + data.lost;
          return {
            userId,
            name: profile?.full_name || 'Sem nome',
            avatarUrl: profile?.avatar_url,
            won: data.won,
            lost: data.lost,
            winRate: total > 0 ? Math.round((data.won / total) * 100) : 0,
            avgTicket: data.won > 0 ? Math.round(data.totalValue / data.won) : 0,
            avgCycle: data.cycles.length > 0 ? Math.round(data.cycles.reduce((s, c) => s + c, 0) / data.cycles.length) : 0,
            totalValue: data.totalValue,
          };
        })
        .sort((a, b) => b.winRate - a.winRate);

      // 10. Time-to-Loss Distribution (legacy, by week) — mantido para Visão Geral
      const weekBuckets: Record<string, number> = {};
      losses.forEach(l => {
        if (l.sales_cycle_days > 0) {
          const week = Math.ceil(l.sales_cycle_days / 7);
          const label = week <= 12 ? `Sem ${week}` : '13+';
          weekBuckets[label] = (weekBuckets[label] || 0) + 1;
        }
      });
      const timeToLossDistribution = Array.from({ length: 13 }, (_, i) => {
        const label = i < 12 ? `Sem ${i + 1}` : '13+';
        return { week: label, count: weekBuckets[label] || 0 };
      }).filter(b => b.count > 0 || true); // keep all weeks for histogram shape

      // 10b. Curva de Mortalidade Comercial — agrupamento executivo por faixas de dias
      const lossMortality = buildLossMortality(losses);


      const lossReasonsByMacro: LossMacroGroup[] = [...macroMap.entries()]
        .map(([category, data]) => ({
          category,
          label: '', // resolved on UI via LOSS_CATEGORY_LABELS
          count: data.count,
          specifics: [...data.specifics.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
          competitors: [...data.competitors],
        }))
        .sort((a, b) => b.count - a.count);

      // 11. Won by stage at acceptance — fonte: snapshot via opportunity_stage_history + proposals.accepted_at
      const wonStageBreakdown = await buildWonStageBreakdown(wins);

      // 11b. Lost by stage at moment of loss — Sprint WL-LOSS-04.
      // Fonte: snapshot via opportunity_stage_history em closed_at; fallback = stage atual.
      const lostStageBreakdown = await buildLostStageBreakdown(losses);

      // 11c. CRM Trust Score determinístico e divergência declarado×inferido (Sprint WL-LOSS-04).
      // Não depende de loss_semantic_analyses. Lê opportunities.loss_reason_id + loss_comment
      // (espelhados em win_loss_records.reason_id + reason_seller) já materializados em `losses`.
      const crmTrustDeterministic = computeCrmTrust(losses);
      const declaredVsInferred = computeDeclaredVsInferred(losses);

      return {
        wins, losses, allDeals,
        wonCount: wins.length, lostCount: losses.length,
        winRate: (wins.length + losses.length) > 0 ? Math.round(wins.length / (wins.length + losses.length) * 100) : 0,
        wonValue, lostValue,
        avgTicketWon: wins.length > 0 ? Math.round(wonValue / wins.length) : 0,
        avgTicketLost: losses.length > 0 ? Math.round(lostValue / losses.length) : 0,
        lossReasons: Object.entries(lossReasonCounts).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8),
        lossReasonsByMacro,
        winReasons: Object.entries(winReasonCounts).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8),
        differentiators: Object.entries(differentiatorCounts).map(([differentiator, count]) => ({ differentiator, count })).sort((a, b) => b.count - a.count).slice(0, 6),
        customerFeedbacks, lossFeedbacks,
        competitors: Object.entries(competitorCounts).map(([competitor, count]) => ({ competitor, count })).sort((a, b) => b.count - a.count).slice(0, 8),
        competitorStats, sellerStats, factors,
        avgCycleWon, avgCycleLost,
        validWinCyclesCount: validWinCycles.length, validLossCyclesCount: validLossCycles.length,
        monthlyPulse, timeToLossDistribution, lossMortality,
        wonStageBreakdown,
        lostStageBreakdown,
        crmTrustDeterministic,
        declaredVsInferred,
      };

    },
    enabled: !!organizationId,
    retry: 1,
    meta: { errorMessage: 'Erro ao carregar dados de Win/Loss' },
  });
}

function emptyResult(): WinLossDataResult {
  return {
    wins: [], losses: [], allDeals: [],
    wonCount: 0, lostCount: 0, winRate: 0, wonValue: 0, lostValue: 0,
    avgTicketWon: 0, avgTicketLost: 0,
    lossReasons: [], lossReasonsByMacro: [], winReasons: [], differentiators: [],
    customerFeedbacks: [], lossFeedbacks: [],
    competitors: [], competitorStats: [], sellerStats: [],
    factors: {}, avgCycleWon: null, avgCycleLost: null,
    validWinCyclesCount: 0, validLossCyclesCount: 0,
    monthlyPulse: [], timeToLossDistribution: [],
    lossMortality: { buckets: [], totalLosses: 0, totalValue: 0, peak: null, avgDays: null, p90Days: null },
    wonStageBreakdown: [],
    lostStageBreakdown: [],
    crmTrustDeterministic: computeCrmTrust([]),
    declaredVsInferred: computeDeclaredVsInferred([]),
  };
}

// ─── Won by stage at acceptance ─────────────────────────────────────
// Sprint WL-WINS-02. Prioridade: (1) última mudança de etapa <= accepted_at
// da proposta aceita; (2) última mudança de etapa registrada; (3) stage_id
// atual da oportunidade (marcado como fallback).
async function buildWonStageBreakdown(wins: WinLossDeal[]): Promise<WonStageRow[]> {
  if (!wins || wins.length === 0) return [];

  const wonOppIds = wins.map(w => w.opportunity_id);
  const acceptedProposalIds = wins
    .map(w => (w.opportunity as any)?.accepted_proposal_id)
    .filter(Boolean) as string[];

  // accepted_at per opportunity
  const acceptedAtMap = new Map<string, string>();
  if (acceptedProposalIds.length > 0) {
    const { data: props } = await supabase
      .from('proposals')
      .select('id, opportunity_id, accepted_at')
      .in('id', acceptedProposalIds);
    props?.forEach(p => {
      if (p.opportunity_id && p.accepted_at) acceptedAtMap.set(p.opportunity_id, p.accepted_at);
    });
  }

  // stage history per opportunity (asc by changed_at)
  const stageHistoryByOpp = new Map<string, Array<{ stage_id: string; changed_at: string }>>();
  const { data: history } = await supabase
    .from('opportunity_stage_history')
    .select('opportunity_id, to_stage_id, changed_at')
    .in('opportunity_id', wonOppIds)
    .order('changed_at', { ascending: true });
  history?.forEach(h => {
    const arr = stageHistoryByOpp.get(h.opportunity_id) || [];
    arr.push({ stage_id: h.to_stage_id, changed_at: h.changed_at });
    stageHistoryByOpp.set(h.opportunity_id, arr);
  });

  // collect candidate stage ids
  const stageIds = new Set<string>();
  wins.forEach(w => {
    const sid = (w.opportunity as any)?.stage_id;
    if (sid) stageIds.add(sid);
  });
  stageHistoryByOpp.forEach(arr => arr.forEach(e => { if (e.stage_id) stageIds.add(e.stage_id); }));

  const stageNameMap = new Map<string, string>();
  if (stageIds.size > 0) {
    const { data: stages } = await supabase
      .from('stages')
      .select('id, name')
      .in('id', [...stageIds] as string[]);
    stages?.forEach(s => stageNameMap.set(s.id, s.name));
  }

  interface StageAgg {
    stageId: string;
    stageName: string;
    count: number;
    value: number;
    cycles: number[];
    reasons: Map<string, number>;
    fallbackCount: number;
  }
  const aggMap = new Map<string, StageAgg>();

  for (const w of wins) {
    const opp = w.opportunity || {};
    const acceptedAt = acceptedAtMap.get(w.opportunity_id);
    const hist = stageHistoryByOpp.get(w.opportunity_id) || [];
    let resolvedStageId: string | null = null;
    let isFallback = false;

    if (acceptedAt && hist.length > 0) {
      const acceptedTs = new Date(acceptedAt).getTime();
      for (let i = hist.length - 1; i >= 0; i--) {
        if (new Date(hist[i].changed_at).getTime() <= acceptedTs) {
          resolvedStageId = hist[i].stage_id;
          break;
        }
      }
    }
    if (!resolvedStageId && hist.length > 0) {
      resolvedStageId = hist[hist.length - 1].stage_id;
    }
    if (!resolvedStageId && opp.stage_id) {
      resolvedStageId = opp.stage_id;
      isFallback = true;
    }

    const key = resolvedStageId || '__unknown__';
    const name = resolvedStageId
      ? (stageNameMap.get(resolvedStageId) || 'Etapa não informada')
      : 'Etapa não informada';
    const e = aggMap.get(key) || {
      stageId: key,
      stageName: name,
      count: 0,
      value: 0,
      cycles: [],
      reasons: new Map(),
      fallbackCount: 0,
    };
    e.count++;
    e.value += Number(w.final_value) || 0;
    if (w.sales_cycle_days > 0) e.cycles.push(w.sales_cycle_days);
    const reason = w.win_reason_name
      || (w.acceptor_name && !w.win_reason_id ? 'Sem motivo selecionado' : 'Não informado');
    e.reasons.set(reason, (e.reasons.get(reason) || 0) + 1);
    if (isFallback) e.fallbackCount++;
    aggMap.set(key, e);
  }

  return [...aggMap.values()]
    .map(e => ({
      stageId: e.stageId,
      stageName: e.stageName,
      count: e.count,
      value: e.value,
      avgTicket: e.count > 0 ? Math.round(e.value / e.count) : 0,
      avgCycle: e.cycles.length > 0
        ? Math.round(e.cycles.reduce((s, c) => s + c, 0) / e.cycles.length)
        : 0,
      topDriver: [...e.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
      fallbackCount: e.fallbackCount,
    }))
    .sort((a, b) => b.value - a.value || b.count - a.count);
}


// ─── Lost by ORIGIN stage (etapa imediatamente ANTERIOR ao LOST) ────
// Sprint WL-LOSS-05. A etapa atual e a última entrada do histórico
// frequentemente refletem o destino operacional da automação (ex.: "Perdemos",
// "Desqualificado", "Churn"). Esses estágios distorcem a análise de onde a
// oportunidade realmente foi perdida. Por isso ignoramos estágios cujo
// nome bate o padrão de destino de perda e procuramos a última etapa
// válida ANTES da marcação como LOST.
const LOSS_DESTINATION_NAME_REGEX =
  /(perdemos|perdido|perdida|desqualific|churn|\blost\b|cancelad)/i;

const isLossDestinationStageName = (name: string | undefined | null): boolean => {
  if (!name) return false;
  return LOSS_DESTINATION_NAME_REGEX.test(name);
};

async function buildLostStageBreakdown(losses: WinLossDeal[]): Promise<LostStageRow[]> {
  if (!losses || losses.length === 0) return [];

  const lostOppIds = losses.map(l => l.opportunity_id);

  const stageHistoryByOpp = new Map<string, Array<{ stage_id: string; changed_at: string }>>();
  const { data: history } = await supabase
    .from('opportunity_stage_history')
    .select('opportunity_id, to_stage_id, changed_at')
    .in('opportunity_id', lostOppIds)
    .order('changed_at', { ascending: true });
  history?.forEach(h => {
    const arr = stageHistoryByOpp.get(h.opportunity_id) || [];
    arr.push({ stage_id: h.to_stage_id, changed_at: h.changed_at });
    stageHistoryByOpp.set(h.opportunity_id, arr);
  });

  const stageIds = new Set<string>();
  losses.forEach(l => {
    const sid = (l.opportunity as any)?.stage_id;
    if (sid) stageIds.add(sid);
  });
  stageHistoryByOpp.forEach(arr => arr.forEach(e => { if (e.stage_id) stageIds.add(e.stage_id); }));

  const stageNameMap = new Map<string, string>();
  if (stageIds.size > 0) {
    const { data: stages } = await supabase
      .from('stages')
      .select('id, name')
      .in('id', [...stageIds] as string[]);
    stages?.forEach(s => stageNameMap.set(s.id, s.name));
  }

  const isLossDestinationStageId = (sid: string | null | undefined): boolean =>
    !!sid && isLossDestinationStageName(stageNameMap.get(sid));

  interface Agg {
    stageId: string; stageName: string;
    count: number; value: number;
    cycles: number[];
    reasons: Map<string, number>;
    fallbackCount: number;
  }
  const aggMap = new Map<string, Agg>();

  for (const l of losses) {
    const opp = l.opportunity || {};
    const closedAt = (opp.closed_at || opp.updated_at) as string | undefined;
    const hist = stageHistoryByOpp.get(l.opportunity_id) || [];
    let resolvedStageId: string | null = null;
    let isFallback = false;

    // 1) Última etapa NÃO-destino-de-perda anterior (ou igual) ao closed_at
    if (closedAt && hist.length > 0) {
      const closedTs = new Date(closedAt).getTime();
      for (let i = hist.length - 1; i >= 0; i--) {
        if (new Date(hist[i].changed_at).getTime() <= closedTs
            && !isLossDestinationStageId(hist[i].stage_id)) {
          resolvedStageId = hist[i].stage_id;
          break;
        }
      }
    }
    // 2) Última etapa NÃO-destino-de-perda do histórico (qualquer momento)
    if (!resolvedStageId && hist.length > 0) {
      for (let i = hist.length - 1; i >= 0; i--) {
        if (!isLossDestinationStageId(hist[i].stage_id)) {
          resolvedStageId = hist[i].stage_id;
          break;
        }
      }
    }
    // 3) Fallback: stage_id atual da oportunidade (mesmo que seja destino de perda)
    if (!resolvedStageId && opp.stage_id) {
      resolvedStageId = opp.stage_id;
      isFallback = true;
    }

    const key = resolvedStageId || '__unknown__';
    const name = resolvedStageId
      ? (stageNameMap.get(resolvedStageId) || 'Etapa não informada')
      : 'Etapa não informada';
    const e = aggMap.get(key) || {
      stageId: key, stageName: name,
      count: 0, value: 0,
      cycles: [],
      reasons: new Map(),
      fallbackCount: 0,
    };
    e.count++;
    e.value += Number(l.final_value) || 0;
    if (l.sales_cycle_days > 0) e.cycles.push(l.sales_cycle_days);
    const reason = (l.reason as any)?.name || 'Não informado';
    e.reasons.set(reason, (e.reasons.get(reason) || 0) + 1);
    if (isFallback) e.fallbackCount++;
    aggMap.set(key, e);
  }

  return [...aggMap.values()]
    .map(e => ({
      stageId: e.stageId,
      stageName: e.stageName,
      count: e.count,
      lostValue: e.value,
      avgTicket: e.count > 0 ? Math.round(e.value / e.count) : 0,
      avgCycle: e.cycles.length > 0
        ? Math.round(e.cycles.reduce((s, c) => s + c, 0) / e.cycles.length)
        : 0,
      topReason: [...e.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
      fallbackCount: e.fallbackCount,
    }))
    .sort((a, b) => b.lostValue - a.lostValue || b.count - a.count);
}



// ─── Curva de Mortalidade Comercial ─────────────────────────────────
const MORTALITY_BUCKET_DEFS: Array<{ key: LossMortalityBucket['key']; label: string; min: number; max: number }> = [
  { key: '0-3', label: '0 a 3 dias', min: 0, max: 3 },
  { key: '4-7', label: '4 a 7 dias', min: 4, max: 7 },
  { key: '8-14', label: '8 a 14 dias', min: 8, max: 14 },
  { key: '15-30', label: '15 a 30 dias', min: 15, max: 30 },
  { key: '31-60', label: '31 a 60 dias', min: 31, max: 60 },
  { key: '61+', label: '61+ dias', min: 61, max: Infinity },
];

function buildLossMortality(losses: WinLossDeal[]): LossMortality {
  const valid = losses.filter(l => Number.isFinite(l.sales_cycle_days) && l.sales_cycle_days >= 0);
  const buckets: LossMortalityBucket[] = MORTALITY_BUCKET_DEFS.map(def => ({
    key: def.key, label: def.label, count: 0, lostValue: 0, pct: 0,
  }));
  let totalValue = 0;
  valid.forEach(l => {
    const days = l.sales_cycle_days;
    const idx = MORTALITY_BUCKET_DEFS.findIndex(d => days >= d.min && days <= d.max);
    if (idx >= 0) {
      buckets[idx].count++;
      buckets[idx].lostValue += l.final_value || 0;
      totalValue += l.final_value || 0;
    }
  });
  const totalLosses = valid.length;
  buckets.forEach(b => {
    b.pct = totalLosses > 0 ? Math.round((b.count / totalLosses) * 100) : 0;
  });
  const peak = totalLosses > 0
    ? buckets.reduce((a, b) => (b.count > a.count ? b : a))
    : null;
  const avgDays = totalLosses > 0
    ? Math.round(valid.reduce((s, l) => s + l.sales_cycle_days, 0) / totalLosses)
    : null;
  let p90Days: number | null = null;
  if (totalLosses > 0) {
    const sorted = [...valid].map(l => l.sales_cycle_days).sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1);
    p90Days = sorted[Math.max(0, idx)];
  }
  return { buckets, totalLosses, totalValue, peak, avgDays, p90Days };
}

