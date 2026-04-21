import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trackNotificationClick } from '@/lib/notifications/trackClick';

// Priority event types that trigger browser push
const PUSH_PRIORITY_TYPES = new Set([
  'proposal_viewed',
  'client_replied',
  'proposal_expiring_24h',
  'proposal_expired',
  'activity_overdue_critical',
  'daily_digest',
]);

async function triggerBrowserPush(row: any) {
  // Only trigger for priority events when tab is not focused
  if (document.hasFocus()) return;
  if (!PUSH_PRIORITY_TYPES.has(row.type)) return;

  try {
    await supabase.functions.invoke('send-browser-push', {
      body: {
        user_id: row.user_id,
        title: row.title,
        body: row.message || '',
        action_url: row.action_url || '/app/dashboard',
        notification_id: row.id,
      },
    });
  } catch (err) {
    console.error('Browser push trigger failed:', err);
  }
}

export function RealtimeNotificationListener() {
  const { user } = useCurrentUser();
  const { settings } = useNotificationSettings();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !settings?.realtime_in_app_enabled) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications_v2',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any;

          if (!row.channel_in_app) return;
          if (row.status !== 'pending' && row.status !== 'sent') return;

          // Invalidate notification center cache
          queryClient.invalidateQueries({ queryKey: ['notifications-center', userId] });
            );
          }

          // Determine toast type by priority
          const isCritical = row.priority === 'critical';
          const isHigh = row.priority === 'high';
          const toastFn = isCritical ? toast.warning : isHigh ? toast.info : toast;

          const actionLabel = row.type === 'client_replied' ? 'Abrir conversa' : 'Abrir';

          toastFn(row.title, {
            description: row.message || undefined,
            duration: isCritical ? 15000 : isHigh ? 10000 : 8000,
            action: row.action_url
              ? {
                  label: actionLabel,
                  onClick: () => {
                    trackNotificationClick(row.id);
                    navigate(row.action_url);
                  },
                }
              : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    userId,
    settings?.realtime_in_app_enabled,
    settings?.realtime_browser_push_enabled,
    queryClient,
    navigate,
  ]);

  return null;
}
