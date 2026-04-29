import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';
import { useOrganizationPipelines } from './useOrganizationPipelines';
import { opportunityKeys } from '@/lib/query-keys';

export interface OpportunityScoreFilters {
  scoreRange?: 'high' | 'medium' | 'low' | null;
  hasHighRisk?: boolean | null;
  ownerId?: string | null;
  search?: string;
  pipelineId?: string | null;          // Sprint 1.3 — explicit pipeline filter
  showWon?: boolean;                    // Sprint 1.3 — opt-in
  showLost?: boolean;                   // Sprint 1.3 — opt-in
  showOperational?: boolean;            // Sprint 1.3 — opt-in
}

export interface OpportunityWithScore {
  id: string;
  title: string;
  valor_previsto: number | null;
  opportunity_score: number | null;
  engagement_score: number | null;
  velocity_score: number | null;
  risk_score: number | null;
  risk_level: string | null;
  deal_health: string | null;
  win_probability_ai: number | null;
  score_confidence: string | null;
  owner_user_id: string | null;
  status: string | null;
  pipeline_id: string | null;
  account?: {
    razao_social: string;
    nome_fantasia: string | null;
  } | null;
}

export function useOpportunityScoreAnalytics() {
  const { organization } = useCurrentOrganization();
  const { pipelines } = useOrganizationPipelines();

  // Sprint 1.3 — defaults: sales pipelines only, no won/lost, no operacional.
  const [filters, setFilters] = useState<OpportunityScoreFilters>({
    showWon: false,
    showLost: false,
    showOperational: false,
  });

  // Resolve which pipeline_ids to allow given current filters.
  const allowedPipelineIds = useMemo(() => {
    if (!pipelines || pipelines.length === 0) return null;
    if (filters.pipelineId) return [filters.pipelineId];
    const types = new Set<string>(['sales']);
    if (filters.showOperational) types.add('onboarding');
    return pipelines
      .filter((p) => types.has((p as any).pipeline_type))
      .map((p) => p.id);
  }, [pipelines, filters.pipelineId, filters.showOperational]);

  const allowedStatuses = useMemo(() => {
    const s: string[] = ['new', 'open'];
    if (filters.showWon) s.push('won');
    if (filters.showLost) s.push('lost');
    return s;
  }, [filters.showWon, filters.showLost]);

  const queryKey = [
    ...opportunityKeys.scoreAnalytics(),
    organization?.id,
    allowedPipelineIds?.join(',') ?? 'all',
    allowedStatuses.join(','),
  ];

  const { data: opportunities, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organization?.id) return [];

      let q = supabase
        .from('opportunities')
        .select(`id, title, valor_previsto, opportunity_score, engagement_score, velocity_score, risk_score, risk_level, deal_health, win_probability_ai, score_confidence, owner_user_id, status, pipeline_id, account:accounts(razao_social, nome_fantasia)`)
        .eq('organization_id', organization.id)
        .is('deleted_at', null)
        .in('status', allowedStatuses)
        .order('opportunity_score', { ascending: false })
        .limit(500);

      if (allowedPipelineIds && allowedPipelineIds.length > 0) {
        q = q.in('pipeline_id', allowedPipelineIds);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as OpportunityWithScore[];
    },
    enabled: !!organization?.id,
    staleTime: 30000,
  });

  const filteredOpportunities = useMemo(() => {
    if (!opportunities) return [];
    return opportunities.filter(opp => {
      if (filters.scoreRange) {
        const score = opp.opportunity_score || 0;
        if (filters.scoreRange === 'high' && score < 70) return false;
        if (filters.scoreRange === 'medium' && (score < 40 || score >= 70)) return false;
        if (filters.scoreRange === 'low' && score >= 40) return false;
      }
      if (filters.hasHighRisk === true && (opp.risk_score || 0) < 60) return false;
      if (filters.ownerId && opp.owner_user_id !== filters.ownerId) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const title = (opp.title || '').toLowerCase();
        const account = (opp.account?.nome_fantasia || opp.account?.razao_social || '').toLowerCase();
        if (!title.includes(searchLower) && !account.includes(searchLower)) return false;
      }
      return true;
    });
  }, [opportunities, filters]);

  const kpis = useMemo(() => {
    const list = filteredOpportunities;
    if (!list || list.length === 0) {
      return { totalOpportunities: 0, averageScore: 0, highScore: 0, mediumScore: 0, lowScore: 0, highRisk: 0, totalValue: 0, valueAtRisk: 0, averageWinProbability: 0 };
    }
    const withScore = list.filter(o => o.opportunity_score !== null);
    const avgScore = withScore.length > 0 ? withScore.reduce((sum, o) => sum + (o.opportunity_score || 0), 0) / withScore.length : 0;
    const withWinProb = list.filter(o => o.win_probability_ai !== null);
    const avgWinProb = withWinProb.length > 0 ? withWinProb.reduce((sum, o) => sum + (o.win_probability_ai || 0), 0) / withWinProb.length : 0;

    // Sprint 1.3 — Valor em Risco: only OPEN opportunities (excludes won),
    // flagged as high risk OR risk_level=high OR deal_health in risk/stalled.
    const isOpen = (s: string | null) => s === 'new' || s === 'open';
    const atRisk = list.filter((o) =>
      isOpen(o.status) && (
        (o.risk_score ?? 0) >= 70 ||
        o.risk_level === 'high' ||
        o.deal_health === 'risk' ||
        o.deal_health === 'stalled'
      )
    );
    const highRiskOpps = list.filter(o => (o.risk_score || 0) >= 60);

    return {
      totalOpportunities: list.length,
      averageScore: Math.round(avgScore),
      highScore: list.filter(o => (o.opportunity_score || 0) >= 70).length,
      mediumScore: list.filter(o => (o.opportunity_score || 0) >= 40 && (o.opportunity_score || 0) < 70).length,
      lowScore: list.filter(o => (o.opportunity_score || 0) < 40).length,
      highRisk: highRiskOpps.length,
      totalValue: list.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
      valueAtRisk: atRisk.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
      averageWinProbability: Math.round(avgWinProb),
    };
  }, [filteredOpportunities]);

  const scoreDistribution = useMemo(() => [
    { range: 'Alto', label: 'Score ≥ 70', count: kpis.highScore, color: '#22c55e' },
    { range: 'Médio', label: 'Score 40-69', count: kpis.mediumScore, color: '#eab308' },
    { range: 'Baixo', label: 'Score < 40', count: kpis.lowScore, color: '#ef4444' },
  ], [kpis]);

  const topByWinProbability = useMemo(() => {
    return [...filteredOpportunities]
      .filter(o => o.win_probability_ai !== null)
      .sort((a, b) => (b.win_probability_ai || 0) - (a.win_probability_ai || 0))
      .slice(0, 5);
  }, [filteredOpportunities]);

  const riskAnalysis = useMemo(() => {
    const list = filteredOpportunities;
    const high = list.filter(o => (o.risk_score || 0) >= 70);
    return {
      high: high.length,
      medium: list.filter(o => (o.risk_score || 0) >= 40 && (o.risk_score || 0) < 70).length,
      low: list.filter(o => (o.risk_score || 0) < 40).length,
      highRiskValue: high.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
    };
  }, [filteredOpportunities]);

  const clearFilters = () => setFilters({
    showWon: false, showLost: false, showOperational: false,
  });

  return {
    opportunities: filteredOpportunities,
    allOpportunities: opportunities || [],
    kpis,
    scoreDistribution,
    topByWinProbability,
    riskAnalysis,
    filters,
    setFilters,
    clearFilters,
    isLoading,
    error,
  };
}
