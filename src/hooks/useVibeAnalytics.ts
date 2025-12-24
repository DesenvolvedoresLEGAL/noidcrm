import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { startOfMonth, subMonths, format } from 'date-fns';

export interface VibeAnalytics {
  // Taxa de retomada de conversa (deals que voltaram de silêncio)
  conversationResumptionRate: number;
  conversationResumptionCount: number;
  
  // Taxa de resposta após silêncio
  responseAfterSilenceRate: number;
  
  // Tempo médio quente silencioso → ganho (em dias)
  avgHotSilentToWonDays: number;
  
  // Vendas fechadas sem desconto
  noDiscountWinsCount: number;
  noDiscountWinsRate: number;
  
  // Distribuição por vibe_state
  vibeStateDistribution: { state: string; count: number; percentage: number }[];
  
  // Métricas adicionais
  totalDealsAnalyzed: number;
  highRiskDeals: number;
  hotDeals: number;
}

export function useVibeAnalytics() {
  const { profile } = useCurrentUser();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['vibe-analytics', organizationId],
    queryFn: async (): Promise<VibeAnalytics> => {
      if (!organizationId) {
        return getEmptyAnalytics();
      }

      const sixMonthsAgo = format(subMonths(startOfMonth(new Date()), 6), 'yyyy-MM-dd');

      // Buscar todas as oportunidades
      const { data: opportunities, error: oppError } = await supabase
        .from('opportunities')
        .select(`
          id,
          status,
          valor_previsto,
          created_at
        `)
        .eq('organization_id', organizationId)
        .gte('created_at', sixMonthsAgo);

      if (oppError) throw oppError;

      // Buscar memórias emocionais
      const { data: memories, error: memError } = await supabase
        .from('lead_emotional_memory')
        .select('*')
        .eq('organization_id', organizationId);

      if (memError) throw memError;

      // Buscar alertas de vibe como proxy para transições
      const { data: vibeAlerts, error: alertError } = await supabase
        .from('vibe_alerts')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('created_at', sixMonthsAgo);

      if (alertError) throw alertError;

      // Calcular métricas
      const totalDeals = opportunities?.length || 0;
      const wonDeals = opportunities?.filter(o => o.status === 'won') || [];
      
      // Vendas sem desconto (usando wonDeals.length como proxy já que não temos discount_percent)
      const noDiscountWinsCount = wonDeals.length; // Placeholder
      const noDiscountWinsRate = wonDeals.length > 0 ? 100 : 0; // Placeholder

      // Distribuição por vibe_state
      const stateCount: Record<string, number> = {};
      memories?.forEach(m => {
        const state = m.last_emotional_state || 'desconhecido';
        stateCount[state] = (stateCount[state] || 0) + 1;
      });

      const totalMemories = memories?.length || 1;
      const vibeStateDistribution = Object.entries(stateCount).map(([state, count]) => ({
        state,
        count,
        percentage: (count / totalMemories) * 100
      })).sort((a, b) => b.count - a.count);

      // Deals de alto risco
      const highRiskDeals = memories?.filter(m => 
        m.risk_of_vibe_break === 'high' || m.risk_of_vibe_break === 'critical'
      ).length || 0;

      // Deals quentes
      const hotDeals = memories?.filter(m => 
        m.last_emotional_state === 'quente_silencioso' || 
        m.last_emotional_state === 'pronto_inseguro' ||
        m.last_emotional_state === 'em_decisao'
      ).length || 0;

      // Taxa de retomada usando vibe_alerts como proxy
      const resumptionAlerts = vibeAlerts?.filter(a => 
        a.alert_type === 'energy_recovery' || a.alert_type === 'hot_timing'
      ) || [];
      const conversationResumptionCount = resumptionAlerts.length;
      const silentDeals = memories?.filter(m => 
        m.last_emotional_state?.includes('silencioso')
      ).length || 0;
      const conversationResumptionRate = silentDeals > 0 
        ? (conversationResumptionCount / (silentDeals + conversationResumptionCount)) * 100 
        : 0;

      // Taxa de resposta após silêncio (similar)
      const responseAfterSilenceRate = conversationResumptionRate;

      // Tempo médio quente silencioso → ganho (estimativa baseada em dados disponíveis)
      const avgHotSilentToWonDays = 5; // Placeholder - requer tracking mais detalhado

      return {
        conversationResumptionRate,
        conversationResumptionCount,
        responseAfterSilenceRate,
        avgHotSilentToWonDays,
        noDiscountWinsCount,
        noDiscountWinsRate,
        vibeStateDistribution,
        totalDealsAnalyzed: totalDeals,
        highRiskDeals,
        hotDeals
      };
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5
  });
}

function getEmptyAnalytics(): VibeAnalytics {
  return {
    conversationResumptionRate: 0,
    conversationResumptionCount: 0,
    responseAfterSilenceRate: 0,
    avgHotSilentToWonDays: 0,
    noDiscountWinsCount: 0,
    noDiscountWinsRate: 0,
    vibeStateDistribution: [],
    totalDealsAnalyzed: 0,
    highRiskDeals: 0,
    hotDeals: 0
  };
}
