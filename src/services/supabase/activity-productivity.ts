import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfWeek, subDays, format } from 'date-fns';

export interface DailyProductivity {
  date: string;
  count: number;
  userId?: string;
  userName?: string;
}

export interface SellerProductivity {
  userId: string;
  userName: string;
  totalCompleted: number;
  thisWeek: number;
  lastWeek: number;
  avgPerDay: number;
}

export interface ProductivityStats {
  daily: DailyProductivity[];
  bySeller: SellerProductivity[];
  totals: {
    today: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
  };
}

export async function getProductivityStats(days: number = 30): Promise<ProductivityStats> {
  const now = new Date();
  const startDate = subDays(now, days);
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const startOfLastWeek = subDays(startOfThisWeek, 7);
  const startOfToday = startOfDay(now);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch completed activities in the date range
  const { data: activities, error } = await supabase
    .from('activities')
    .select('id, completed_at, owner_user_id')
    .in('status', ['completed', 'no_show'])
    .gte('completed_at', startDate.toISOString())
    .order('completed_at', { ascending: true });

  if (error) throw error;

  // Get unique owner IDs
  const ownerIds = [...new Set((activities || []).map(a => a.owner_user_id).filter(Boolean))];

  // Fetch owner names
  let ownerNames: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', ownerIds);

    if (profiles) {
      ownerNames = Object.fromEntries(
        profiles.map(p => [p.user_id, p.full_name || 'Sem nome'])
      );
    }
  }

  // Group by day
  const dailyMap = new Map<string, number>();
  const sellerMap = new Map<string, {
    totalCompleted: number;
    thisWeek: number;
    lastWeek: number;
    dates: Set<string>;
  }>();

  let todayCount = 0;
  let thisWeekCount = 0;
  let lastWeekCount = 0;
  let thisMonthCount = 0;

  (activities || []).forEach(activity => {
    if (!activity.completed_at) return;

    const completedDate = new Date(activity.completed_at);
    const dateKey = format(completedDate, 'yyyy-MM-dd');

    // Daily totals
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);

    // Per seller stats
    const ownerId = activity.owner_user_id;
    if (ownerId) {
      if (!sellerMap.has(ownerId)) {
        sellerMap.set(ownerId, {
          totalCompleted: 0,
          thisWeek: 0,
          lastWeek: 0,
          dates: new Set(),
        });
      }
      const seller = sellerMap.get(ownerId)!;
      seller.totalCompleted++;
      seller.dates.add(dateKey);

      if (completedDate >= startOfThisWeek) {
        seller.thisWeek++;
      } else if (completedDate >= startOfLastWeek && completedDate < startOfThisWeek) {
        seller.lastWeek++;
      }
    }

    // Global totals
    if (completedDate >= startOfToday) {
      todayCount++;
    }
    if (completedDate >= startOfThisWeek) {
      thisWeekCount++;
    } else if (completedDate >= startOfLastWeek && completedDate < startOfThisWeek) {
      lastWeekCount++;
    }
    if (completedDate >= startOfMonth) {
      thisMonthCount++;
    }
  });

  // Convert daily map to array (fill in missing days)
  const daily: DailyProductivity[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(now, i);
    const dateKey = format(date, 'yyyy-MM-dd');
    daily.push({
      date: dateKey,
      count: dailyMap.get(dateKey) || 0,
    });
  }

  // Convert seller map to array
  const bySeller: SellerProductivity[] = Array.from(sellerMap.entries())
    .map(([userId, stats]) => ({
      userId,
      userName: ownerNames[userId] || 'Sem nome',
      totalCompleted: stats.totalCompleted,
      thisWeek: stats.thisWeek,
      lastWeek: stats.lastWeek,
      avgPerDay: stats.dates.size > 0 ? Math.round((stats.totalCompleted / stats.dates.size) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.totalCompleted - a.totalCompleted);

  return {
    daily,
    bySeller,
    totals: {
      today: todayCount,
      thisWeek: thisWeekCount,
      lastWeek: lastWeekCount,
      thisMonth: thisMonthCount,
    },
  };
}
