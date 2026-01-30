import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserActivityData {
  user_id: string;
  lastActivity: string | null;
  lastLogin: string | null;
  activityCount24h: number;
  activityCount7d: number;
}

/**
 * Fetch last real activity for all users (based on audit_log actions)
 * This provides the most accurate "last seen" data, not just login events
 */
export function useUserActivityData() {
  return useQuery({
    queryKey: ["admin-users-activity"],
    queryFn: async (): Promise<Map<string, UserActivityData>> => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get last activity from audit_log for each user
      const { data: activityData, error: activityError } = await supabase
        .from("audit_log")
        .select("actor_user_id, created_at")
        .not("actor_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (activityError) {
        console.error("Error fetching audit_log:", activityError);
      }

      // Get last login from auth_audit_log
      const { data: loginData, error: loginError } = await supabase
        .from("auth_audit_log")
        .select("user_id, created_at, event_type")
        .in("event_type", ["login", "session_refresh"])
        .eq("success", true)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (loginError) {
        console.error("Error fetching auth_audit_log:", loginError);
      }

      // Build activity map
      const activityMap = new Map<string, UserActivityData>();

      // Process activity data (audit_log)
      if (activityData) {
        for (const row of activityData) {
          const userId = row.actor_user_id;
          if (!userId) continue;

          const createdAt = new Date(row.created_at);
          const existing = activityMap.get(userId);

          if (!existing) {
            activityMap.set(userId, {
              user_id: userId,
              lastActivity: row.created_at,
              lastLogin: null,
              activityCount24h: createdAt >= yesterday ? 1 : 0,
              activityCount7d: createdAt >= weekAgo ? 1 : 0,
            });
          } else {
            // Count activities
            if (createdAt >= yesterday) {
              existing.activityCount24h++;
            }
            if (createdAt >= weekAgo) {
              existing.activityCount7d++;
            }
          }
        }
      }

      // Process login data (auth_audit_log)
      if (loginData) {
        for (const row of loginData) {
          const userId = row.user_id;
          if (!userId) continue;

          const existing = activityMap.get(userId);
          if (existing && !existing.lastLogin) {
            existing.lastLogin = row.created_at;
          } else if (!existing) {
            activityMap.set(userId, {
              user_id: userId,
              lastActivity: null,
              lastLogin: row.created_at,
              activityCount24h: 0,
              activityCount7d: 0,
            });
          }
        }
      }

      return activityMap;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get the most reliable "last seen" date for a user
 * Prefers actual activity over login events
 */
export function getLastSeen(activity: UserActivityData | undefined): Date | null {
  if (!activity) return null;

  const lastActivity = activity.lastActivity ? new Date(activity.lastActivity) : null;
  const lastLogin = activity.lastLogin ? new Date(activity.lastLogin) : null;

  if (lastActivity && lastLogin) {
    return lastActivity > lastLogin ? lastActivity : lastLogin;
  }

  return lastActivity || lastLogin;
}
