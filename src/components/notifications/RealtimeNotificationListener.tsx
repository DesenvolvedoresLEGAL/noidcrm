import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

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
                  onClick: () => navigate(row.action_url),
                }
              : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, settings?.realtime_in_app_enabled, queryClient, navigate]);

  return null;
}
