import { useQuery } from '@tanstack/react-query';
import { getTodayTrainings, getOverallAverage, getCurrentStreak } from '@/services/roleplay/stats';

export function useRoleplayStats(sellerId: string | undefined) {
  const { data: todayTrainings, isLoading: loadingToday } = useQuery({
    queryKey: ['roleplay-today-trainings', sellerId],
    queryFn: () => getTodayTrainings(sellerId!),
    enabled: !!sellerId,
    staleTime: 30000, // 30 seconds
  });

  const { data: overallAverage, isLoading: loadingAverage } = useQuery({
    queryKey: ['roleplay-overall-average', sellerId],
    queryFn: () => getOverallAverage(sellerId!),
    enabled: !!sellerId,
    staleTime: 30000,
  });

  const { data: currentStreak, isLoading: loadingStreak } = useQuery({
    queryKey: ['roleplay-current-streak', sellerId],
    queryFn: () => getCurrentStreak(sellerId!),
    enabled: !!sellerId,
    staleTime: 30000,
  });

  return {
    todayTrainings: todayTrainings ?? 0,
    overallAverage: overallAverage ?? null,
    currentStreak: currentStreak ?? 0,
    isLoading: loadingToday || loadingAverage || loadingStreak,
  };
}
