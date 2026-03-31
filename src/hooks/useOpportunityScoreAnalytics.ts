import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';

export interface OpportunityScoreFilters {
  scoreRange?: 'high' | 'medium' | 'low' | null;
  hasHighRisk?: boolean | null;
  ownerId?: string | null;
  search?: string;
}

export interface OpportunityWithScore {
  id: string;
  title: string;
  valor_previsto: number | null;
  opportunity_score: number | null;
  engagement_score: number | null;
  velocity_score: number | null;
  risk_score: number | null;
  win_probability_ai: number | null;
  score_confidence: string | null;
  owner_user_id: string | null;
  status: string | null;
  account?: {
    razao_social: string;
    nome_fantasia: string | null;
  } | null;
}

export function useOpportunityScoreAnalytics() {
  const { organization } = useCurrentOrganization();
  const [filters, setFilters] = useState<OpportunityScoreFilters>({});

  const { data: opportunities, isLoading, error } = useQuery({
    queryKey: ['opportunity-score-analytics', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('opportunities')
        .select(`id, title, valor_previsto, opportunity_score, engagement_score, velocity_score, risk_score, win_probability_ai, score_confidence, owner_user_id, status, account:accounts(razao_social, nome_fantasia)`)
        .eq('organization_id', organization.id)
        .in('status', ['new', 'open'])
        .order('opportunity_score', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as OpportunityWithScore[];
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
    if (!opportunities || opportunities.length === 0) {
      return { totalOpportunities: 0, averageScore: 0, highScore: 0, mediumScore: 0, lowScore: 0, highRisk: 0, totalValue: 0, valueAtRisk: 0, averageWinProbability: 0 };
    }
    const withScore = opportunities.filter(o => o.opportunity_score !== null);
    const avgScore = withScore.length > 0 ? withScore.reduce((sum, o) => sum + (o.opportunity_score || 0), 0) / withScore.length : 0;
    const withWinProb = opportunities.filter(o => o.win_probability_ai !== null);
    const avgWinProb = withWinProb.length > 0 ? withWinProb.reduce((sum, o) => sum + (o.win_probability_ai || 0), 0) / withWinProb.length : 0;
    const highRiskOpps = opportunities.filter(o => (o.risk_score || 0) >= 60);

    return {
      totalOpportunities: opportunities.length,
      averageScore: Math.round(avgScore),
      highScore: opportunities.filter(o => (o.opportunity_score || 0) >= 70).length,
      mediumScore: opportunities.filter(o => (o.opportunity_score || 0) >= 40 && (o.opportunity_score || 0) < 70).length,
      lowScore: opportunities.filter(o => (o.opportunity_score || 0) < 40).length,
      highRisk: highRiskOpps.length,
      totalValue: opportunities.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
      valueAtRisk: highRiskOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
      averageWinProbability: Math.round(avgWinProb),
    };
  }, [opportunities]);

  const scoreDistribution = useMemo(() => [
    { range: 'Alto', label: 'Score ≥ 70', count: kpis.highScore, color: '#22c55e' },
    { range: 'Médio', label: 'Score 40-69', count: kpis.mediumScore, color: '#eab308' },
    { range: 'Baixo', label: 'Score < 40', count: kpis.lowScore, color: '#ef4444' },
  ], [kpis]);

  const topByWinProbability = useMemo(() => {
    if (!opportunities) return [];
    return [...opportunities].filter(o => o.win_probability_ai !== null).sort((a, b) => (b.win_probability_ai || 0) - (a.win_probability_ai || 0)).slice(0, 5);
  }, [opportunities]);

  const riskAnalysis = useMemo(() => {
    if (!opportunities) return { high: 0, medium: 0, low: 0, highRiskValue: 0 };
    const high = opportunities.filter(o => (o.risk_score || 0) >= 70);
    return { high: high.length, medium: opportunities.filter(o => (o.risk_score || 0) >= 40 && (o.risk_score || 0) < 70).length, low: opportunities.filter(o => (o.risk_score || 0) < 40).length, highRiskValue: high.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) };
  }, [opportunities]);

  const clearFilters = () => setFilters({});

  return { opportunities: filteredOpportunities, allOpportunities: opportunities || [], kpis, scoreDistribution, topByWinProbability, riskAnalysis, filters, setFilters, clearFilters, isLoading, error };
}
