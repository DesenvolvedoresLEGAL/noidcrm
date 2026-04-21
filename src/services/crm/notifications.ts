import { supabase } from '@/integrations/supabase/client';

/**
 * LEGACY (v1 notifications table).
 *
 * @deprecated Prefer v2/unified notification flows for all new features:
 * - useUnifiedInbox (UI inbox composition: v2 + legacy compatibility + release notes)
 * - useNotificationsCenter (v2 focused center interactions)
 *
 * Runtime behavior is intentionally preserved for backward compatibility.
 */
const LEGACY_NOTIFICATIONS_DEPRECATION_MESSAGE =
  '[legacy-notifications] src/services/crm/notifications.ts is legacy (v1 table). Prefer notifications_v2 via useUnifiedInbox/useNotificationsCenter for new code.';

let hasWarnedLegacyNotificationsService = false;

function warnLegacyNotificationsServiceOnce() {
  if (hasWarnedLegacyNotificationsService) return;
  hasWarnedLegacyNotificationsService = true;
  console.warn(LEGACY_NOTIFICATIONS_DEPRECATION_MESSAGE);
}

/** @deprecated Legacy v1 notification shape from `public.notifications`. */
export interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  type: string;
  title: string;
  message: string;
  metadata: any;
  read: boolean;
  created_at: string;
  read_at: string | null;
}

/** @deprecated Legacy v1 API. Prefer v2/unified notification hooks/services for new code. */
export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  warnLegacyNotificationsServiceOnce();
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Notification[];
}

/** @deprecated Legacy v1 API. Prefer v2/unified notification hooks/services for new code. */
export async function markAsRead(notificationId: string): Promise<void> {
  warnLegacyNotificationsServiceOnce();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw error;
}

/** @deprecated Legacy v1 API. Prefer v2/unified notification hooks/services for new code. */
export async function markAllAsRead(): Promise<void> {
  warnLegacyNotificationsServiceOnce();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('read', false);

  if (error) throw error;
}

/** @deprecated Legacy v1 API. Prefer v2/unified notification hooks/services for new code. */
export async function getUnreadCount(): Promise<number> {
  warnLegacyNotificationsServiceOnce();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);

  if (error) throw error;
  return count || 0;
}
