import { supabase } from '@/integrations/supabase/client';

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'milestone' | 'weekly' | 'monthly' | 'special';
  target_value: number;
  xp_reward: number;
  icon: string;
  is_active: boolean;
  current_progress?: number;
  completed?: boolean;
  completed_at?: string;
}

export async function getAllAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('target_value');

  if (error) {
    console.error('Error fetching achievements:', error);
    return [];
  }

  return data as Achievement[];
}

export async function getSellerAchievements(sellerId: string): Promise<Achievement[]> {
  const [achievementsResult, progressResult] = await Promise.all([
    supabase.from('achievements').select('*').eq('is_active', true),
    supabase.from('seller_achievements').select('*').eq('seller_id', sellerId)
  ]);

  if (achievementsResult.error || progressResult.error) {
    console.error('Error fetching seller achievements');
    return [];
  }

  const progressMap = new Map(
    progressResult.data?.map(p => [p.achievement_id, p]) || []
  );

  return achievementsResult.data?.map(achievement => {
    const progress = progressMap.get(achievement.id);
    return {
      ...achievement,
      current_progress: progress?.current_progress || 0,
      completed: progress?.completed || false,
      completed_at: progress?.completed_at
    };
  }) as Achievement[];
}

export async function getInProgressAchievements(sellerId: string): Promise<Achievement[]> {
  const achievements = await getSellerAchievements(sellerId);
  return achievements.filter(a => !a.completed && (a.current_progress || 0) > 0);
}

export async function getCompletedAchievements(sellerId: string): Promise<Achievement[]> {
  const achievements = await getSellerAchievements(sellerId);
  return achievements.filter(a => a.completed);
}
