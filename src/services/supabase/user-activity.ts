import { supabase } from '@/integrations/supabase/client';

export interface UserActivityInfo {
  lastLogin: Date | null;
  lastActivity: Date | null;
  isActive: boolean;
  activityCount24h: number;
}

/**
 * Check if a date is within the last 24 hours
 */
function isWithinLast24Hours(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return diffMs < 24 * 60 * 60 * 1000;
}

/**
 * Get user ID from email via profiles table
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .limit(1)
    .single();
  
  return data?.user_id || null;
}

/**
 * Get the last real activity for a user
 * Combines auth_audit_log (login events) with audit_log (actual actions)
 */
export async function getLastUserActivity(email: string): Promise<UserActivityInfo> {
  // Get user ID first
  const userId = await getUserIdByEmail(email);
  
  // Query auth_audit_log for last login/session_refresh
  const authLogPromise = supabase
    .from('auth_audit_log')
    .select('created_at')
    .eq('email', email)
    .in('event_type', ['login', 'session_refresh'])
    .eq('success', true)
    .order('created_at', { ascending: false })
    .limit(1);
  
  // Query audit_log for last real activity (if we have a user ID)
  const activityPromise = userId
    ? supabase
        .from('audit_log')
        .select('created_at')
        .eq('actor_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
    : Promise.resolve({ data: null });

  // Query activity count in last 24 hours
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const activityCountPromise = userId
    ? supabase
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('actor_user_id', userId)
        .gte('created_at', yesterday.toISOString())
    : Promise.resolve({ count: 0 });

  const [authLogResult, activityResult, countResult] = await Promise.all([
    authLogPromise,
    activityPromise,
    activityCountPromise,
  ]);

  const lastLoginStr = authLogResult.data?.[0]?.created_at || null;
  const lastActivityStr = activityResult.data?.[0]?.created_at || null;

  return {
    lastLogin: lastLoginStr ? new Date(lastLoginStr) : null,
    lastActivity: lastActivityStr ? new Date(lastActivityStr) : null,
    isActive: isWithinLast24Hours(lastActivityStr),
    activityCount24h: countResult.count || 0,
  };
}

/**
 * Get activity summary for a user over a period
 */
export async function getUserActivitySummary(
  email: string,
  days: number = 30
): Promise<{ date: string; count: number }[]> {
  const userId = await getUserIdByEmail(email);
  if (!userId) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await supabase
    .from('audit_log')
    .select('created_at')
    .eq('actor_user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (!data) return [];

  // Group by date
  const grouped = data.reduce((acc, row) => {
    const date = new Date(row.created_at).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get the most reliable "last seen" date for a user
 * Prefers actual activity over login events
 */
export async function getLastSeen(email: string): Promise<Date | null> {
  const activity = await getLastUserActivity(email);
  
  // Prefer actual activity over login events
  if (activity.lastActivity && activity.lastLogin) {
    return activity.lastActivity > activity.lastLogin 
      ? activity.lastActivity 
      : activity.lastLogin;
  }
  
  return activity.lastActivity || activity.lastLogin;
}
