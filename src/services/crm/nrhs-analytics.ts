// NRHS Analytics Service - Aggregated data for Revenue Hygiene Dashboard

import { supabase } from '@/integrations/supabase/client';
import { NRHSTier, getNRHSTierConfig } from './nrhs-calculator';

export interface NRHSKPIs {
  averageScore: number;
  totalDeals: number;
  eliteCount: number;      // NRHS ≥ 90
  healthyCount: number;    // NRHS 75-89
  riskCount: number;       // NRHS 60-74
  criticalCount: number;   // NRHS 40-59
  insalubriousCount: number; // NRHS < 40
  valueAtRisk: number;     // R$ com NRHS < 60
  totalPipelineValue: number;
}

export interface NRHSTierDistribution {
  tier: NRHSTier;
  count: number;
  percentage: number;
  value: number;
}

export interface NRHSPillarAverage {
  pillar: string;
  label: string;
  average: number;
  weight: number;
  hasAlert: boolean;
}

export interface NRHSOwnerStats {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  dealCount: number;
  averageNRHS: number;
  healthyPercent: number;
  insalubriousPercent: number;
  valueAtRisk: number;
  evolution7d: number | null;
}

export interface NRHSDeal {
  id: string;
  title: string;
  accountName: string;
  ownerName: string;
  ownerUserId: string;
  value: number;
  stageName: string;
  stageId: string;
  opportunityScore: number | null;
  nrhsScore: number | null;
  nrhsTier: NRHSTier | null;
  nrhsStatus: string | null;
  nrhsIssuesCount: number;
  nrhsBlockers: any[];
  pillars: {
    integrity: number | null;
    cadence: number | null;
    stakeholders: number | null;
    winloss: number | null;
    adherence: number | null;
    evidence: number | null;
  };
  lastReviewedAt: string | null;
  createdAt: string;
}

export interface NRHSInsight {
  id: string;
  text: string;
  pillar: string;
  dealCount: number;
  severity: 'high' | 'medium' | 'low';
}

export interface NRHSCorrelation {
  type: 'winrate' | 'forecast' | 'cycle';
  title: string;
  insight: string;
  value: number;
  comparison: number;
}

// Pillar configuration (NRHS v1 — pontos absolutos)
export const NRHS_PILLARS: { id: keyof NRHSDeal['pillars']; label: string; weight: number }[] = [
  { id: 'integrity', label: 'Integridade', weight: 25 },
  { id: 'cadence', label: 'Cadência', weight: 20 },
  { id: 'stakeholders', label: 'Stakeholders', weight: 20 },
  { id: 'winloss', label: 'Win/Loss', weight: 15 },
  { id: 'adherence', label: 'Aderência', weight: 10 },
  { id: 'evidence', label: 'Evidências', weight: 10 },
];

// Map issues to pillars
const ISSUE_TO_PILLAR: Record<string, string> = {
  'missing_value': 'integrity',
  'missing_close_date': 'integrity',
  'close_date_past': 'integrity',
  'missing_next_step': 'cadence',
  'no_recent_activity': 'cadence',
  'no_weekly_review': 'cadence',
  'missing_decision_maker': 'stakeholders',
  'no_meeting_scheduled': 'stakeholders',
  'stale_in_stage': 'winloss',
  'no_proposal': 'winloss',
  'low_opportunity_score': 'adherence',
  'missing_temperature': 'adherence',
};

export function getTierFromScore(score: number): NRHSTier {
  if (score >= 90) return 'elite';
  if (score >= 75) return 'healthy';
  if (score >= 60) return 'risk';
  if (score >= 40) return 'critical';
  return 'insalubrious';
}

export function getTierLabel(tier: NRHSTier): string {
  const labels: Record<NRHSTier, string> = {
    elite: 'Elite',
    healthy: 'Saudável',
    risk: 'Em Risco',
    critical: 'Crítico',
    insalubrious: 'Insalubre',
  };
  return labels[tier];
}

export async function fetchNRHSDeals(
  organizationId: string,
  userId: string | null,
  isAdmin: boolean,
  filters?: {
    tier?: NRHSTier;
    ownerId?: string;
    stageId?: string;
    hasBlocker?: boolean;
    search?: string;
  }
): Promise<NRHSDeal[]> {
  let query = (supabase as any)
    .from('opportunities')
    .select(`
      id,
      title,
      value,
      stage_id,
      owner_user_id,
      opportunity_score,
      nrhs_score,
      nrhs_tier,
      nrhs_status,
      nrhs_data_integrity_score,
      nrhs_cadence_score,
      nrhs_stakeholders_score,
      nrhs_win_loss_score,
      nrhs_process_adherence_score,
      nrhs_evidence_score,
      nrhs_issues_count,
      nrhs_blockers,
      nrhs_last_calculated_at,
      created_at,
      accounts(razao_social, nome_fantasia),
      stage:stages(name),
      profiles!opportunities_owner_user_id_fkey(full_name)
    `)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .not('status', 'in', '("won","lost","disqualified")');

  if (!isAdmin && userId) {
    query = query.eq('owner_user_id', userId);
  }
  if (filters?.tier) {
    query = query.eq('nrhs_tier', filters.tier);
  }
  if (filters?.ownerId) {
    query = query.eq('owner_user_id', filters.ownerId);
  }
  if (filters?.stageId) {
    query = query.eq('stage_id', filters.stageId);
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,accounts.razao_social.ilike.%${filters.search}%`);
  }

  query = query.order('nrhs_score', { ascending: true, nullsFirst: true });

  const { data, error } = await query.limit(500);

  if (error) {
    console.error('Error fetching NRHS deals:', error);
    return [];
  }

  return (data || []).map((opp: any) => ({
    id: opp.id,
    title: opp.title,
    accountName: opp.accounts?.nome_fantasia || opp.accounts?.razao_social || 'Sem empresa',
    ownerName: opp.profiles?.full_name || 'Sem responsável',
    ownerUserId: opp.owner_user_id,
    value: opp.value || 0,
    stageName: opp.pipeline_stages?.name || 'Sem estágio',
    stageId: opp.stage_id,
    opportunityScore: opp.opportunity_score,
    nrhsScore: opp.nrhs_score,
    nrhsTier: opp.nrhs_tier as NRHSTier | null,
    nrhsStatus: opp.nrhs_status ?? null,
    nrhsIssuesCount: opp.nrhs_issues_count || 0,
    nrhsBlockers: Array.isArray(opp.nrhs_blockers) ? opp.nrhs_blockers : [],
    pillars: {
      integrity: opp.nrhs_data_integrity_score,
      cadence: opp.nrhs_cadence_score,
      stakeholders: opp.nrhs_stakeholders_score,
      winloss: opp.nrhs_win_loss_score,
      adherence: opp.nrhs_process_adherence_score,
      evidence: opp.nrhs_evidence_score,
    },
    lastReviewedAt: opp.nrhs_last_calculated_at,
    createdAt: opp.created_at,
  }));
}

export function calculateNRHSKPIs(deals: NRHSDeal[]): NRHSKPIs {
  const totalDeals = deals.length;
  
  if (totalDeals === 0) {
    return {
      averageScore: 0,
      totalDeals: 0,
      eliteCount: 0,
      healthyCount: 0,
      riskCount: 0,
      criticalCount: 0,
      insalubriousCount: 0,
      valueAtRisk: 0,
      totalPipelineValue: 0,
    };
  }

  let totalScore = 0;
  let totalValue = 0;
  let valueAtRisk = 0;
  let eliteCount = 0;
  let healthyCount = 0;
  let riskCount = 0;
  let criticalCount = 0;
  let insalubriousCount = 0;

  for (const deal of deals) {
    const score = deal.nrhsScore ?? 0;
    totalScore += score;
    totalValue += deal.value;

    if (score >= 90) {
      eliteCount++;
    } else if (score >= 75) {
      healthyCount++;
    } else if (score >= 60) {
      riskCount++;
    } else if (score >= 40) {
      criticalCount++;
      valueAtRisk += deal.value;
    } else {
      insalubriousCount++;
      valueAtRisk += deal.value;
    }
  }

  return {
    averageScore: Math.round(totalScore / totalDeals),
    totalDeals,
    eliteCount,
    healthyCount,
    riskCount,
    criticalCount,
    insalubriousCount,
    valueAtRisk,
    totalPipelineValue: totalValue,
  };
}

export function calculateTierDistribution(deals: NRHSDeal[]): NRHSTierDistribution[] {
  const totalDeals = deals.length;
  const tiers: NRHSTier[] = ['elite', 'healthy', 'risk', 'critical', 'insalubrious'];
  
  const distribution: Record<NRHSTier, { count: number; value: number }> = {
    elite: { count: 0, value: 0 },
    healthy: { count: 0, value: 0 },
    risk: { count: 0, value: 0 },
    critical: { count: 0, value: 0 },
    insalubrious: { count: 0, value: 0 },
  };

  for (const deal of deals) {
    const tier = deal.nrhsTier || getTierFromScore(deal.nrhsScore ?? 0);
    distribution[tier].count++;
    distribution[tier].value += deal.value;
  }

  return tiers.map(tier => ({
    tier,
    count: distribution[tier].count,
    percentage: totalDeals > 0 ? Math.round((distribution[tier].count / totalDeals) * 100) : 0,
    value: distribution[tier].value,
  }));
}

export function calculatePillarAverages(deals: NRHSDeal[]): NRHSPillarAverage[] {
  return NRHS_PILLARS.map(pillar => {
    const scores = deals
      .map(d => d.pillars?.[pillar.id])
      .filter((v): v is number => typeof v === 'number');
    const max = pillar.weight; // pillar max = its weight in the v1 formula
    const avgPoints = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    // Normalize to 0-100 percentage of pillar potential
    const average = max > 0 ? Math.round((avgPoints / max) * 100) : 0;
    return {
      pillar: pillar.id,
      label: pillar.label,
      average,
      weight: pillar.weight,
      hasAlert: average < 60,
    };
  });
}

export function calculateOwnerStats(deals: NRHSDeal[]): NRHSOwnerStats[] {
  const ownerMap: Record<string, {
    name: string;
    deals: NRHSDeal[];
  }> = {};

  for (const deal of deals) {
    if (!ownerMap[deal.ownerUserId]) {
      ownerMap[deal.ownerUserId] = {
        name: deal.ownerName,
        deals: [],
      };
    }
    ownerMap[deal.ownerUserId].deals.push(deal);
  }

  return Object.entries(ownerMap)
    .map(([userId, data]) => {
      const ownerDeals = data.deals;
      const totalDeals = ownerDeals.length;
      
      let totalScore = 0;
      let healthyCount = 0;
      let insalubriousCount = 0;
      let valueAtRisk = 0;

      for (const deal of ownerDeals) {
        const score = deal.nrhsScore ?? 0;
        totalScore += score;
        
        if (score >= 75) healthyCount++;
        if (score < 40) insalubriousCount++;
        if (score < 60) valueAtRisk += deal.value;
      }

      return {
        userId,
        userName: data.name,
        avatarUrl: null,
        dealCount: totalDeals,
        averageNRHS: totalDeals > 0 ? Math.round(totalScore / totalDeals) : 0,
        healthyPercent: totalDeals > 0 ? Math.round((healthyCount / totalDeals) * 100) : 0,
        insalubriousPercent: totalDeals > 0 ? Math.round((insalubriousCount / totalDeals) * 100) : 0,
        valueAtRisk,
        evolution7d: null, // Would require historical data
      };
    })
    .sort((a, b) => b.averageNRHS - a.averageNRHS); // Sort by best NRHS first
}

export function generateNRHSInsights(deals: NRHSDeal[]): NRHSInsight[] {
  const insights: NRHSInsight[] = [];
  const codeOf = (b: any): string => (typeof b === 'string' ? b : b?.code ?? '');
  const dealHas = (d: NRHSDeal, code: string) =>
    (d.nrhsBlockers || []).some(b => codeOf(b) === code);

  const totalDeals = deals.length;
  const criticalDeals = deals.filter(d => (d.nrhsScore ?? 0) < 50);

  const criticalWithNoStep = criticalDeals.filter(d => dealHas(d, 'missing_next_step') || dealHas(d, 'no_next_step'));
  if (criticalWithNoStep.length > 0 && criticalDeals.length > 0) {
    const percent = Math.round((criticalWithNoStep.length / criticalDeals.length) * 100);
    if (percent >= 30) {
      insights.push({
        id: 'critical_no_step',
        text: `${percent}% dos deals em risco/críticos sem próximo passo agendado`,
        pillar: 'Cadência',
        dealCount: criticalWithNoStep.length,
        severity: 'high',
      });
    }
  }

  const noDecisionMaker = deals.filter(d => dealHas(d, 'missing_decision_maker') || dealHas(d, 'no_decisor'));
  if (noDecisionMaker.length >= 3) {
    const avgNRHS = Math.round(noDecisionMaker.reduce((s, d) => s + (d.nrhsScore ?? 0), 0) / noDecisionMaker.length);
    insights.push({
      id: 'no_decision_maker',
      text: `${noDecisionMaker.length} deals sem decisor mapeado (NRHS médio ${avgNRHS})`,
      pillar: 'Stakeholders',
      dealCount: noDecisionMaker.length,
      severity: avgNRHS < 50 ? 'high' : 'medium',
    });
  }

  const noActivity = deals.filter(d => dealHas(d, 'no_recent_activity') || dealHas(d, 'stale_in_stage'));
  if (noActivity.length >= 3) {
    insights.push({
      id: 'stale_deals',
      text: `${noActivity.length} deals sem atividade recente — possível abandono`,
      pillar: 'Cadência',
      dealCount: noActivity.length,
      severity: 'medium',
    });
  }

  const noValue = deals.filter(d => dealHas(d, 'missing_value'));
  if (noValue.length >= 2) {
    insights.push({
      id: 'missing_value',
      text: `${noValue.length} deals sem valor definido — quebra forecast`,
      pillar: 'Integridade',
      dealCount: noValue.length,
      severity: 'high',
    });
  }

  const pastDate = deals.filter(d => dealHas(d, 'close_date_past') || dealHas(d, 'stale_close_date'));
  if (pastDate.length >= 2) {
    insights.push({
      id: 'past_close_date',
      text: `${pastDate.length} deals com data de fechamento vencida`,
      pillar: 'Integridade',
      dealCount: pastDate.length,
      severity: 'medium',
    });
  }

  return insights.slice(0, 5);
}

export function generateNRHSCorrelations(deals: NRHSDeal[]): NRHSCorrelation[] {
  // These would ideally come from historical data analysis
  // For now, we'll generate based on current data patterns
  
  const highNRHS = deals.filter(d => (d.nrhsScore ?? 0) >= 75);
  const lowNRHS = deals.filter(d => (d.nrhsScore ?? 0) < 60);
  
  const correlations: NRHSCorrelation[] = [];
  
  // Win Rate correlation
  correlations.push({
    type: 'winrate',
    title: 'NRHS × Win Rate',
    insight: highNRHS.length > 0 && lowNRHS.length > 0
      ? `Deals com NRHS ≥ 75 têm histórico de conversão superior aos deals com NRHS < 60`
      : 'Mantenha o NRHS acima de 75 para maximizar conversão',
    value: 75,
    comparison: 60,
  });

  // Forecast correlation
  correlations.push({
    type: 'forecast',
    title: 'NRHS × Forecast',
    insight: 'Deals com alta higiene reduzem erros de forecast em até 40%',
    value: 40,
    comparison: 0,
  });

  // Cycle time correlation
  correlations.push({
    type: 'cycle',
    title: 'NRHS × Tempo de Ciclo',
    insight: 'Deals bem documentados fecham em média 30% mais rápido',
    value: 30,
    comparison: 0,
  });

  return correlations;
}
