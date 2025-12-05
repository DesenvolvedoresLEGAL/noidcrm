import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTeamVisibility } from './useTeamVisibility';

export interface TeamMemberMetrics {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  opportunities_count: number;
  opportunities_value: number;
  won_count: number;
  won_value: number;
  lost_count: number;
  activities_pending: number;
  activities_completed: number;
  conversion_rate: number;
}

export interface TeamKPIs {
  total_opportunities: number;
  total_pipeline_value: number;
  total_won_value: number;
  total_activities_pending: number;
  avg_conversion_rate: number;
  total_members: number;
}

export interface TeamRankingEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  won_value: number;
  won_count: number;
  rank: number;
}

export function useTeamDashboard() {
  const { isTeamManager, visibleUserIds, currentUserId, loading: visibilityLoading } = useTeamVisibility();
  const [members, setMembers] = useState<TeamMemberMetrics[]>([]);
  const [kpis, setKPIs] = useState<TeamKPIs | null>(null);
  const [ranking, setRanking] = useState<TeamRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTeamData = useCallback(async () => {
    if (visibilityLoading || !currentUserId) return;
    
    // Se não é gestor de time ou não tem IDs visíveis específicos, não carrega
    if (!isTeamManager && visibleUserIds === null) {
      setLoading(false);
      return;
    }

    const teamUserIds = visibleUserIds || [];
    if (teamUserIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Buscar profiles dos membros do time
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', teamUserIds);

      if (profilesError) throw profilesError;

      // Buscar oportunidades dos membros
      const { data: opportunities, error: oppError } = await supabase
        .from('opportunities')
        .select('id, owner_user_id, valor_previsto, status')
        .in('owner_user_id', teamUserIds);

      if (oppError) throw oppError;

      // Buscar atividades pendentes dos membros
      const { data: activities, error: actError } = await supabase
        .from('activities')
        .select('id, owner_user_id, status')
        .in('owner_user_id', teamUserIds);

      if (actError) throw actError;

      // Calcular métricas por membro
      const memberMetrics: TeamMemberMetrics[] = (profiles || []).map(profile => {
        const userOpps = (opportunities || []).filter(o => o.owner_user_id === profile.user_id);
        const userActivities = (activities || []).filter(a => a.owner_user_id === profile.user_id);
        
        const wonOpps = userOpps.filter(o => o.status === 'won');
        const lostOpps = userOpps.filter(o => o.status === 'lost');
        const closedOpps = wonOpps.length + lostOpps.length;
        
        return {
          user_id: profile.user_id,
          full_name: profile.full_name || 'Sem nome',
          avatar_url: profile.avatar_url,
          opportunities_count: userOpps.length,
          opportunities_value: userOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          won_count: wonOpps.length,
          won_value: wonOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          lost_count: lostOpps.length,
          activities_pending: userActivities.filter(a => a.status === 'pending').length,
          activities_completed: userActivities.filter(a => a.status === 'completed').length,
          conversion_rate: closedOpps > 0 ? (wonOpps.length / closedOpps) * 100 : 0,
        };
      });

      setMembers(memberMetrics);

      // Calcular KPIs consolidados
      const totalKPIs: TeamKPIs = {
        total_opportunities: memberMetrics.reduce((sum, m) => sum + m.opportunities_count, 0),
        total_pipeline_value: memberMetrics.reduce((sum, m) => sum + m.opportunities_value, 0),
        total_won_value: memberMetrics.reduce((sum, m) => sum + m.won_value, 0),
        total_activities_pending: memberMetrics.reduce((sum, m) => sum + m.activities_pending, 0),
        avg_conversion_rate: memberMetrics.length > 0 
          ? memberMetrics.reduce((sum, m) => sum + m.conversion_rate, 0) / memberMetrics.length 
          : 0,
        total_members: memberMetrics.length,
      };
      setKPIs(totalKPIs);

      // Criar ranking por valor ganho
      const sortedByValue = [...memberMetrics]
        .sort((a, b) => b.won_value - a.won_value)
        .map((m, index) => ({
          user_id: m.user_id,
          full_name: m.full_name,
          avatar_url: m.avatar_url,
          won_value: m.won_value,
          won_count: m.won_count,
          rank: index + 1,
        }));
      setRanking(sortedByValue);

    } catch (err) {
      console.error('Error fetching team dashboard:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [visibilityLoading, currentUserId, isTeamManager, visibleUserIds]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  return {
    members,
    kpis,
    ranking,
    loading: loading || visibilityLoading,
    error,
    isTeamManager,
    refetch: fetchTeamData,
  };
}
