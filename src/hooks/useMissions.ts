import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getSellerMissions, 
  claimMission, 
  trackMissionAction,
  getTimeUntilReset,
  SellerMission 
} from '@/services/gamification/missions';
import { useState, useEffect } from 'react';
import { gamificationKeys } from '@/lib/query-keys';

export function useMissions(sellerId: string | undefined) {
  const queryClient = useQueryClient();
  const [dailyResetTime, setDailyResetTime] = useState(getTimeUntilReset('daily'));
  const [weeklyResetTime, setWeeklyResetTime] = useState(getTimeUntilReset('weekly'));

  // Update reset timers every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setDailyResetTime(getTimeUntilReset('daily'));
      setWeeklyResetTime(getTimeUntilReset('weekly'));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const { data: missions = [], isLoading, refetch } = useQuery({
    queryKey: gamificationKeys.missions(sellerId),
    queryFn: () => getSellerMissions(sellerId!),
    enabled: !!sellerId,
    staleTime: 30000,
  });

  const claimMutation = useMutation({
    mutationFn: ({ missionId }: { missionId: string }) => claimMission(sellerId!, missionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.missions(sellerId) });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.level(sellerId) });
    }
  });

  const trackActionMutation = useMutation({
    mutationFn: ({ action, metadata }: { action: Parameters<typeof trackMissionAction>[1]; metadata?: Parameters<typeof trackMissionAction>[2] }) => 
      trackMissionAction(sellerId!, action, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.missions(sellerId) });
    }
  });

  // Separate daily and weekly missions
  const today = new Date().toISOString().split('T')[0];
  const dailyMissions = missions.filter(m => m.period_start === today);
  const weeklyMissions = missions.filter(m => m.period_start !== today);

  // Calculate stats
  const dailyCompleted = dailyMissions.filter(m => m.completed).length;
  const dailyTotal = dailyMissions.length;
  const weeklyCompleted = weeklyMissions.filter(m => m.completed).length;
  const weeklyTotal = weeklyMissions.length;

  const unclaimedMissions = missions.filter(m => m.completed && !m.claimed);
  const totalUnclaimedXP = unclaimedMissions.reduce((sum, m) => sum + (m.mission?.xp_reward || 0), 0);

  return {
    missions,
    dailyMissions,
    weeklyMissions,
    isLoading,
    refetch,

    // Stats
    dailyCompleted,
    dailyTotal,
    weeklyCompleted,
    weeklyTotal,
    unclaimedMissions,
    totalUnclaimedXP,

    // Reset timers
    dailyResetTime,
    weeklyResetTime,

    // Actions
    claimMission: claimMutation.mutateAsync,
    isClaiming: claimMutation.isPending,
    trackAction: trackActionMutation.mutateAsync,
  };
}
