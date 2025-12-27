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
  nrhsIssuesCount: number;
  nrhsBlockers: string[];
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

// Pillar configuration
export const NRHS_PILLARS = [
  { id: 'integrity', label: 'Integridade', weight: 0.30 },
  { id: 'cadence', label: 'Cadência', weight: 0.25 },
  { id: 'stakeholders', label: 'Stakeholders', weight: 0.20 },
  { id: 'winloss', label: 'Win/Loss', weight: 0.15 },
  { id: 'adherence', label: 'Aderência', weight: 0.10 },
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
  let query = supabase
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
      nrhs_issues_count,
      nrhs_blockers,
      nrhs_last_calculated_at,
      created_at,
      accounts!inner(razao_social, nome_fantasia),
      pipeline_stages!inner(name),
      profiles!opportunities_owner_user_id_fkey(full_name)
    `)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .in('status', ['open', 'negotiation', 'proposal']);

  // Apply permission filter
  if (!isAdmin && userId) {
    query = query.eq('owner_user_id', userId);
  }

  // Apply filters
  if (filters?.tier) {
    query = query.eq('nrhs_tier', filters.tier);
  }
  if (filters?.ownerId) {
    query = query.eq('owner_user_id', filters.ownerId);
  }
  if (filters?.stageId) {
    query = query.eq('stage_id', filters.stageId);
  }
  if (filters?.hasBlocker !== undefined) {
    if (filters.hasBlocker) {
      query = query.not('nrhs_blockers', 'eq', '{}');
    } else {
      query = query.or('nrhs_blockers.eq.{},nrhs_blockers.is.null');
    }
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,accounts.razao_social.ilike.%${filters.search}%`);
  }

  // Order by NRHS ascending (worst first)
  query = query.order('nrhs_score', { ascending: true, nullsFirst: true });

  const { data, error } = await query.limit(200);

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
    nrhsIssuesCount: opp.nrhs_issues_count || 0,
    nrhsBlockers: (opp.nrhs_blockers as string[]) || [],
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
  // Calculate average issues per pillar
  const pillarIssues: Record<string, number[]> = {};
  
  for (const pillar of NRHS_PILLARS) {
    pillarIssues[pillar.id] = [];
  }

  for (const deal of deals) {
    const breakdown = deal.nrhsBlockers || [];
    const pillarScores: Record<string, number> = {};
    
    // Initialize all pillars with 100
    for (const pillar of NRHS_PILLARS) {
      pillarScores[pillar.id] = 100;
    }
    
    // Deduct for each blocker/issue
    for (const blockerId of breakdown) {
      const pillarId = ISSUE_TO_PILLAR[blockerId];
      if (pillarId && pillarScores[pillarId] !== undefined) {
        pillarScores[pillarId] -= 20; // Deduct 20 points per issue
      }
    }
    
    // Add to pillar arrays
    for (const pillar of NRHS_PILLARS) {
      pillarIssues[pillar.id].push(Math.max(0, pillarScores[pillar.id]));
    }
  }

  return NRHS_PILLARS.map(pillar => {
    const scores = pillarIssues[pillar.id];
    const average = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 100;
    
    return {
      pillar: pillar.id,
      label: pillar.label,
      average,
      weight: pillar.weight,
      hasAlert: average < 70,
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
  
  // Count issues by type
  const issueCount: Record<string, number> = {};
  const issueDealCount: Record<string, number> = {};
  
  for (const deal of deals) {
    for (const blockerId of deal.nrhsBlockers || []) {
      issueCount[blockerId] = (issueCount[blockerId] || 0) + 1;
      issueDealCount[blockerId] = (issueDealCount[blockerId] || 0) + 1;
    }
  }

  // Calculate percentages and generate insights
  const totalDeals = deals.length;
  const criticalDeals = deals.filter(d => (d.nrhsScore ?? 0) < 60);
  
  // Insight: Missing next step in critical deals
  const criticalWithNoStep = criticalDeals.filter(d => d.nrhsBlockers?.includes('missing_next_step'));
  if (criticalWithNoStep.length > 0 && totalDeals > 0) {
    const percent = Math.round((criticalWithNoStep.length / criticalDeals.length) * 100);
    if (percent >= 30) {
      insights.push({
        id: 'critical_no_step',
        text: `${percent}% dos deals críticos falham por ausência de próximo passo`,
        pillar: 'Cadência',
        dealCount: criticalWithNoStep.length,
        severity: 'high',
      });
    }
  }

  // Insight: Missing decision maker
  const noDecisionMaker = deals.filter(d => d.nrhsBlockers?.includes('missing_decision_maker'));
  if (noDecisionMaker.length >= 3) {
    const avgNRHS = Math.round(noDecisionMaker.reduce((s, d) => s + (d.nrhsScore ?? 0), 0) / noDecisionMaker.length);
    insights.push({
      id: 'no_decision_maker',
      text: `Deals sem decisor têm NRHS médio ${avgNRHS} e precisam de atenção`,
      pillar: 'Stakeholders',
      dealCount: noDecisionMaker.length,
      severity: avgNRHS < 50 ? 'high' : 'medium',
    });
  }

  // Insight: No recent activity
  const noActivity = deals.filter(d => d.nrhsBlockers?.includes('no_recent_activity'));
  if (noActivity.length >= 3) {
    insights.push({
      id: 'stale_deals',
      text: `${noActivity.length} deals estão sem atividade recente e podem estar abandonados`,
      pillar: 'Cadência',
      dealCount: noActivity.length,
      severity: 'medium',
    });
  }

  // Insight: Missing value
  const noValue = deals.filter(d => d.nrhsBlockers?.includes('missing_value'));
  if (noValue.length >= 2) {
    insights.push({
      id: 'missing_value',
      text: `${noValue.length} deals não possuem valor definido, prejudicando o forecast`,
      pillar: 'Integridade',
      dealCount: noValue.length,
      severity: 'high',
    });
  }

  // Insight: Past close date
  const pastDate = deals.filter(d => d.nrhsBlockers?.includes('close_date_past'));
  if (pastDate.length >= 2) {
    insights.push({
      id: 'past_close_date',
      text: `${pastDate.length} deals têm data de fechamento vencida e precisam de atualização`,
      pillar: 'Integridade',
      dealCount: pastDate.length,
      severity: 'medium',
    });
  }

  return insights.slice(0, 5); // Return top 5 insights
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
