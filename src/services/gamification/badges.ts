import { supabase } from '@/integrations/supabase/client';

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: 'training' | 'streak' | 'performance' | 'special';
  rarity: number;
  criteria: { type: string; value: number };
  xp_reward: number;
  is_active: boolean;
  unlocked?: boolean;
  unlocked_at?: string;
}

export interface SellerLevel {
  level: number;
  title: string;
  totalXP: number;
  nextLevelXP: number;
  progress: number;
}

const LEVELS = [
  { level: 1, xp: 0, title: 'Iniciante' },
  { level: 2, xp: 100, title: 'Aprendiz' },
  { level: 3, xp: 300, title: 'Vendedor Jr.' },
  { level: 4, xp: 600, title: 'Vendedor' },
  { level: 5, xp: 1000, title: 'Vendedor Sr.' },
  { level: 6, xp: 1500, title: 'Especialista' },
  { level: 7, xp: 2200, title: 'Expert' },
  { level: 8, xp: 3000, title: 'Mestre' },
  { level: 9, xp: 4000, title: 'Campeão' },
  { level: 10, xp: 5500, title: 'Lenda de Vendas' },
];

export function getLevelFromXP(xp: number): SellerLevel {
  let currentLevel = LEVELS[0];
  let nextLevel = LEVELS[1];
  
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }
  
  const xpForCurrentLevel = xp - currentLevel.xp;
  const xpNeededForNext = nextLevel.xp - currentLevel.xp;
  const progress = xpNeededForNext > 0 ? (xpForCurrentLevel / xpNeededForNext) * 100 : 100;
  
  return {
    level: currentLevel.level,
    title: currentLevel.title,
    totalXP: xp,
    nextLevelXP: nextLevel.xp,
    progress: Math.min(progress, 100)
  };
}

function mapBadgeFromDB(dbBadge: any): Badge {
  return {
    id: dbBadge.id,
    code: dbBadge.code,
    name: dbBadge.name,
    description: dbBadge.description,
    icon: dbBadge.icon,
    category: dbBadge.category as Badge['category'],
    rarity: dbBadge.rarity,
    criteria: dbBadge.criteria as { type: string; value: number },
    xp_reward: dbBadge.xp_reward,
    is_active: dbBadge.is_active,
    unlocked: dbBadge.unlocked,
    unlocked_at: dbBadge.unlocked_at,
  };
}

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('rarity');

  if (error) {
    console.error('Error fetching badges:', error);
    return [];
  }

  return (data || []).map(mapBadgeFromDB);
}

export async function getSellerBadges(sellerId: string): Promise<Badge[]> {
  const [allBadgesResult, unlockedResult] = await Promise.all([
    supabase.from('badges').select('*').eq('is_active', true),
    supabase.from('seller_badges').select('badge_id, unlocked_at').eq('seller_id', sellerId)
  ]);

  if (allBadgesResult.error || unlockedResult.error) {
    console.error('Error fetching seller badges');
    return [];
  }

  const unlockedMap = new Map(
    unlockedResult.data?.map(b => [b.badge_id, b.unlocked_at]) || []
  );

  return (allBadgesResult.data || []).map(badge => mapBadgeFromDB({
    ...badge,
    unlocked: unlockedMap.has(badge.id),
    unlocked_at: unlockedMap.get(badge.id)
  }));
}

export async function getSellerXP(sellerId: string): Promise<SellerLevel> {
  const { data, error } = await supabase
    .from('sellers')
    .select('total_xp, current_level, current_title')
    .eq('id', sellerId)
    .single();

  if (error || !data) {
    return getLevelFromXP(0);
  }

  return getLevelFromXP(data.total_xp || 0);
}

export async function checkAndUnlockBadges(sellerId: string, sessionId?: string): Promise<{
  newBadges: Badge[];
  xpEarned: number;
  leveledUp: boolean;
  level: SellerLevel;
}> {
  const { data, error } = await supabase.functions.invoke('gamification-engine', {
    body: { sellerId, sessionId }
  });

  if (error || !data?.success) {
    console.error('Error checking badges:', error || data?.error);
    return {
      newBadges: [],
      xpEarned: 0,
      leveledUp: false,
      level: getLevelFromXP(0)
    };
  }

  return {
    newBadges: (data.newBadges || []).map(mapBadgeFromDB),
    xpEarned: data.xpEarned || 0,
    leveledUp: data.leveledUp || false,
    level: data.level || getLevelFromXP(0)
  };
}

export async function getRecentUnlocks(sellerId: string, limit = 5): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('seller_badges')
    .select(`
      badge_id,
      unlocked_at,
      badges (*)
    `)
    .eq('seller_id', sellerId)
    .order('unlocked_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent unlocks:', error);
    return [];
  }

  return (data || []).map(item => mapBadgeFromDB({
    ...(item.badges as any),
    unlocked: true,
    unlocked_at: item.unlocked_at
  }));
}

export function getRarityLabel(rarity: number): string {
  const labels: Record<number, string> = {
    1: 'Comum',
    2: 'Incomum',
    3: 'Raro',
    4: 'Épico',
    5: 'Lendário'
  };
  return labels[rarity] || 'Comum';
}

export function getRarityColor(rarity: number): string {
  const colors: Record<number, string> = {
    1: 'text-muted-foreground',
    2: 'text-green-500',
    3: 'text-blue-500',
    4: 'text-purple-500',
    5: 'text-amber-500'
  };
  return colors[rarity] || 'text-muted-foreground';
}
