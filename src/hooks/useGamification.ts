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

export function useGamification(sellerId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: badges = [], isLoading: loadingBadges } = useQuery({
    queryKey: ['seller-badges', sellerId],
    queryFn: () => getSellerBadges(sellerId!),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const { data: level, isLoading: loadingLevel } = useQuery({
    queryKey: ['seller-level', sellerId],
    queryFn: () => getSellerXP(sellerId!),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const { data: achievements = [], isLoading: loadingAchievements } = useQuery({
    queryKey: ['seller-achievements', sellerId],
    queryFn: () => getSellerAchievements(sellerId!),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const { data: inProgressAchievements = [] } = useQuery({
    queryKey: ['seller-achievements-progress', sellerId],
    queryFn: () => getInProgressAchievements(sellerId!),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const { data: recentUnlocks = [] } = useQuery({
    queryKey: ['seller-recent-unlocks', sellerId],
    queryFn: () => getRecentUnlocks(sellerId!, 5),
    enabled: !!sellerId,
    staleTime: 60000,
  });

  const checkBadgesMutation = useMutation({
    mutationFn: (sessionId?: string) => checkAndUnlockBadges(sellerId!, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-badges', sellerId] });
      queryClient.invalidateQueries({ queryKey: ['seller-level', sellerId] });
      queryClient.invalidateQueries({ queryKey: ['seller-achievements', sellerId] });
      queryClient.invalidateQueries({ queryKey: ['seller-recent-unlocks', sellerId] });
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
