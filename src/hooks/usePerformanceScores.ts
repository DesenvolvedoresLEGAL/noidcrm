import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { performanceKeys } from '@/lib/query-keys';
import {
  getSellerPerformanceScores,
  getTeamPerformanceScores,
  getPerformanceHistory,
  getSellerDynamicMissions,
  generateMissionsForSeller,
  getAtRiskSellers,
  getScoreBreakdowns,
  PerformanceScore,
  DynamicMission
} from '@/services/performance/performanceScores';

export function useSellerPerformanceScores(sellerId: string | undefined) {
  const { data: scores, isLoading, error, refetch } = useQuery({
    queryKey: performanceKeys.seller(sellerId),
    queryFn: () => getSellerPerformanceScores(sellerId!),
    enabled: !!sellerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const breakdowns = scores ? getScoreBreakdowns(scores) : [];

  return {
    scores,
    breakdowns,
    isLoading,
    error,
    refetch
  };
}

export function useTeamPerformanceScores() {
  const { data } = useCurrentUser();
  const organizationId = data?.organization?.id;

  const { data: teamScores = [], isLoading, error, refetch } = useQuery({
    queryKey: performanceKeys.team(organizationId),
    queryFn: () => getTeamPerformanceScores(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate team averages
  const teamAverages = teamScores.length > 0 ? {
    cs: teamScores.reduce((sum, s) => sum + (s.cs_final || 0), 0) / teamScores.length,
    bs: teamScores.reduce((sum, s) => sum + (s.bs_final || 0), 0) / teamScores.length,
    ds: teamScores.reduce((sum, s) => sum + (s.ds_final || 0), 0) / teamScores.length,
    ras: teamScores.reduce((sum, s) => sum + (s.ras_final || 0), 0) / teamScores.length,
  } : { cs: 0, bs: 0, ds: 0, ras: 0 };

  return {
    teamScores,
    teamAverages,
    isLoading,
    error,
    refetch
  };
}

export function usePerformanceHistory(sellerId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: performanceKeys.history(sellerId, days),
    queryFn: () => getPerformanceHistory(sellerId!, days),
    enabled: !!sellerId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDynamicMissions(sellerId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: missions = [], isLoading, error, refetch } = useQuery({
    queryKey: performanceKeys.dynamicMissions(sellerId),
    queryFn: () => getSellerDynamicMissions(sellerId!),
    enabled: !!sellerId,
    staleTime: 5 * 60 * 1000,
  });

  const generateMissions = useMutation({
    mutationFn: () => generateMissionsForSeller(sellerId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: performanceKeys.dynamicMissions(sellerId) });
    }
  });

  // Group missions by type
  const gapCloseMissions = missions.filter(m => m.mission_type === 'gap_close');
  const skillMissions = missions.filter(m => m.mission_type === 'skill_develop');
  const streakMissions = missions.filter(m => m.mission_type === 'streak_build');

  return {
    missions,
    gapCloseMissions,
    skillMissions,
    streakMissions,
    isLoading,
    error,
    refetch,
    generateMissions: generateMissions.mutateAsync,
    isGenerating: generateMissions.isPending
  };
}

export function useAtRiskSellers() {
  const { data } = useCurrentUser();
  const organizationId = data?.organization?.id;

  return useQuery({
    queryKey: performanceKeys.atRiskSellers(organizationId),
    queryFn: () => getAtRiskSellers(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}
