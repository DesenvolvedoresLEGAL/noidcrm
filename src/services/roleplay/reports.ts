import { supabase } from '@/integrations/supabase/client';

export interface SellerPerformance {
  seller_id: string;
  seller_name: string;
  avatar_url?: string;
  total_sessions: number;
  avg_score: number;
  approval_rate: number;
  last_session: string | null;
  trend: number;
  total_time_hours: number;
}

export interface TeamMetrics {
  total_sessions: number;
  avg_score: number;
  approval_rate: number;
  total_hours: number;
  sellers_performance: SellerPerformance[];
}

export interface TrainingTrend {
  date: string;
  sessions_count: number;
  avg_score: number;
}

export interface PredictiveInsight {
  type: 'forecast' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export async function getTeamPerformanceReport(
  organizationId: string,
  period: string = '30d',
  sellerId?: string
): Promise<TeamMetrics> {
  try {
    // Calculate date filter
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear(), 0, 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get sellers in organization
    let sellersQuery = supabase
      .from('sellers')
      .select('id, name, user_id, profiles(avatar_url)')
      .eq('organization_id', organizationId)
      .eq('active', true);

    if (sellerId) {
      sellersQuery = sellersQuery.eq('id', sellerId);
    }

    const { data: sellers, error: sellersError } = await sellersQuery;

    if (sellersError) throw sellersError;
    if (!sellers || sellers.length === 0) {
      return {
        total_sessions: 0,
        avg_score: 0,
        approval_rate: 0,
        total_hours: 0,
        sellers_performance: []
      };
    }

    // Get performance for each seller
    const sellersPerformance = await Promise.all(
      sellers.map(async (seller) => {
        const { data: sessions, error: sessionsError } = await supabase
          .from('roleplay_sessions')
          .select('id, score_overall, passed, finished_at, started_at, time_spent_sec, exchanges_count')
          .eq('seller_id', seller.id)
          .gte('exchanges_count', 5)
          .gte('started_at', startDate.toISOString());

        if (sessionsError) throw sessionsError;

        const validSessions = sessions || [];
        const totalSessions = validSessions.length;
        
        const avgScore = totalSessions > 0
          ? validSessions.reduce((sum, s) => sum + (s.score_overall || 0), 0) / totalSessions
          : 0;
        
        const passedSessions = validSessions.filter(s => s.passed).length;
        const approvalRate = totalSessions > 0 ? (passedSessions / totalSessions) * 100 : 0;
        
        const totalSeconds = validSessions.reduce((sum, s) => sum + (s.time_spent_sec || 0), 0);
        const totalHours = totalSeconds / 3600;
        
        const lastSession = validSessions.length > 0
          ? validSessions[0]?.finished_at || validSessions[0]?.started_at
          : null;

        // Calculate trend (last 5 vs previous 5 sessions)
        const recentSessions = validSessions
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
          .slice(0, 10);
        
        const last5Avg = recentSessions.slice(0, 5).reduce((sum, s) => sum + (s.score_overall || 0), 0) / 5 || 0;
        const prev5Avg = recentSessions.slice(5, 10).reduce((sum, s) => sum + (s.score_overall || 0), 0) / 5 || 0;
        const trend = last5Avg - prev5Avg;

        return {
          seller_id: seller.id,
          seller_name: seller.name,
          avatar_url: (seller.profiles as any)?.avatar_url,
          total_sessions: totalSessions,
          avg_score: avgScore,
          approval_rate: approvalRate,
          last_session: lastSession,
          trend,
          total_time_hours: totalHours
        };
      })
    );

    // Calculate team totals
    const totalSessions = sellersPerformance.reduce((sum, s) => sum + s.total_sessions, 0);
    const avgScore = sellersPerformance.length > 0
      ? sellersPerformance.reduce((sum, s) => sum + s.avg_score, 0) / sellersPerformance.length
      : 0;
    const approvalRate = sellersPerformance.length > 0
      ? sellersPerformance.reduce((sum, s) => sum + s.approval_rate, 0) / sellersPerformance.length
      : 0;
    const totalHours = sellersPerformance.reduce((sum, s) => sum + s.total_time_hours, 0);

    return {
      total_sessions: totalSessions,
      avg_score: avgScore,
      approval_rate: approvalRate,
      total_hours: totalHours,
      sellers_performance: sellersPerformance
    };
  } catch (error) {
    console.error('Error fetching team performance:', error);
    throw error;
  }
}

export async function getTrainingTrends(
  organizationId: string,
  period: string = '30d'
): Promise<TrainingTrend[]> {
  try {
    const now = new Date();
    let startDate = new Date();
    let groupBy: 'day' | 'week' = 'day';
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        groupBy = 'day';
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        groupBy = 'day';
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        groupBy = 'week';
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear(), 0, 1);
        groupBy = 'week';
        break;
      default:
        startDate.setDate(now.getDate() - 30);
        groupBy = 'day';
    }

    // Get all sellers in org
    const { data: sellers } = await supabase
      .from('sellers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('active', true);

    if (!sellers || sellers.length === 0) return [];

    const sellerIds = sellers.map(s => s.id);

    // Get sessions grouped by date
    const { data: sessions, error } = await supabase
      .from('roleplay_sessions')
      .select('started_at, score_overall, exchanges_count')
      .in('seller_id', sellerIds)
      .gte('exchanges_count', 5)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: true });

    if (error) throw error;
    if (!sessions || sessions.length === 0) return [];

    // Group by date
    const grouped = new Map<string, { count: number; scores: number[] }>();

    sessions.forEach((session) => {
      const date = new Date(session.started_at);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else {
        // Group by week
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      }

      if (!grouped.has(key)) {
        grouped.set(key, { count: 0, scores: [] });
      }

      const group = grouped.get(key)!;
      group.count++;
      if (session.score_overall) {
        group.scores.push(session.score_overall);
      }
    });

    // Convert to array
    const trends: TrainingTrend[] = Array.from(grouped.entries()).map(([date, data]) => ({
      date,
      sessions_count: data.count,
      avg_score: data.scores.length > 0
        ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
        : 0
    }));

    return trends;
  } catch (error) {
    console.error('Error fetching training trends:', error);
    throw error;
  }
}

export async function getPredictiveAnalytics(
  organizationId: string
): Promise<PredictiveInsight[]> {
  try {
    const insights: PredictiveInsight[] = [];

    // Get team performance for last 30 days
    const metrics = await getTeamPerformanceReport(organizationId, '30d');

    // Insight 1: Forecast who will reach gate
    const sellersNearGate = metrics.sellers_performance.filter(
      s => s.avg_score >= 6.5 && s.avg_score < 7.0 && s.trend > 0
    );

    if (sellersNearGate.length > 0) {
      insights.push({
        type: 'forecast',
        title: 'Vendedores Próximos ao Gate',
        description: `${sellersNearGate.length} vendedor(es) podem atingir o gate de distribuição (nota ≥7.0) nas próximas 2-3 sessões baseado no desempenho atual.`,
        impact: 'positive',
        confidence: 0.75
      });
    }

    // Insight 2: Identify high performers
    const highPerformers = metrics.sellers_performance.filter(
      s => s.avg_score >= 8.0 && s.trend > 0.2
    );

    if (highPerformers.length > 0) {
      insights.push({
        type: 'trend',
        title: 'Tendência Positiva',
        description: `${highPerformers.length} vendedor(es) está(ão) em forte tendência de alta. Performance acima de 8.0 e crescente.`,
        impact: 'positive',
        confidence: 0.85
      });
    }

    // Insight 3: Identify sellers needing support
    const needsSupport = metrics.sellers_performance.filter(
      s => s.avg_score < 7.0 || s.trend < -0.3
    );

    if (needsSupport.length > 0) {
      insights.push({
        type: 'recommendation',
        title: 'Ação Recomendada',
        description: `${needsSupport.length} vendedor(es) com nota abaixo de 7.0 ou em tendência de queda. Considere agendar sessões de coaching ou treinos extras.`,
        impact: 'negative',
        confidence: 0.80
      });
    }

    // Insight 4: Overall team trajectory
    if (metrics.avg_score >= 7.5) {
      insights.push({
        type: 'forecast',
        title: 'Projeção de Performance',
        description: `Mantendo o ritmo atual, o time pode atingir média geral de 8.0+ até o final do trimestre.`,
        impact: 'positive',
        confidence: 0.70
      });
    }

    // Insight 5: Low engagement warning
    const lowEngagement = metrics.sellers_performance.filter(
      s => s.total_sessions < 3
    );

    if (lowEngagement.length > 0) {
      insights.push({
        type: 'recommendation',
        title: 'Baixo Engajamento',
        description: `${lowEngagement.length} vendedor(es) realizou menos de 3 treinos no período. Aumente a frequência para melhorar resultados.`,
        impact: 'neutral',
        confidence: 0.90
      });
    }

    return insights;
  } catch (error) {
    console.error('Error generating predictive analytics:', error);
    throw error;
  }
}
