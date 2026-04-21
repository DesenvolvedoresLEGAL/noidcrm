import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getSellerBadges, 
  getSellerXP, 
  checkAndUnlockBadges, 
  getRecentUnlocks,
  Badge,
  SellerLevel
} from '@/services/gamification/badges';
import { 
  getSellerAchievements, 
  getInProgressAchievements,
  Achievement 
} from '@/services/gamification/achievements';
import { gamificationKeys } from '@/lib/query-keys';

export function useGamification(sellerId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: badges = [], isLoading: loadingBadges } = useQuery({
    queryKey: gamificationKeys.badges(sellerId),
    queryFn: () => getSellerBadges(sellerId!),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const { data: level, isLoading: loadingLevel } = useQuery({
    queryKey: gamificationKeys.level(sellerId),
    queryFn: () => getSellerXP(sellerId!),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const { data: achievements = [], isLoading: loadingAchievements } = useQuery({
    queryKey: gamificationKeys.achievements(sellerId),
    queryFn: () => getSellerAchievements(sellerId!),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const { data: inProgressAchievements = [] } = useQuery({
    queryKey: gamificationKeys.achievementsProgress(sellerId),
    queryFn: () => getInProgressAchievements(sellerId!),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const { data: recentUnlocks = [] } = useQuery({
    queryKey: gamificationKeys.recentUnlocks(sellerId),
    queryFn: () => getRecentUnlocks(sellerId!, 5),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const checkBadgesMutation = useMutation({
    mutationFn: (sessionId?: string) => checkAndUnlockBadges(sellerId!, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.badges(sellerId) });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.level(sellerId) });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.achievements(sellerId) });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.recentUnlocks(sellerId) });
    }
  });

  const unlockedBadges = badges.filter(b => b.unlocked);
  const lockedBadges = badges.filter(b => !b.unlocked);
  const completedAchievements = achievements.filter(a => a.completed);

  const badgesByCategory = badges.reduce((acc, badge) => {
    if (!acc[badge.category]) acc[badge.category] = [];
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  return {
    // Badge data
    badges,
    unlockedBadges,
    lockedBadges,
    badgesByCategory,
    recentUnlocks,

    // Level data
    level: level || { level: 1, title: 'Iniciante', totalXP: 0, nextLevelXP: 100, progress: 0 },

    // Achievement data
    achievements,
    inProgressAchievements,
    completedAchievements,

    // Loading states
    isLoading: loadingBadges || loadingLevel || loadingAchievements,

    // Actions
    checkForNewBadges: checkBadgesMutation.mutateAsync,
    isCheckingBadges: checkBadgesMutation.isPending,
  };
}
