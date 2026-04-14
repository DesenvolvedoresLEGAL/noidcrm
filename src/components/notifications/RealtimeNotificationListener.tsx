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

          // Show toast
          toast(row.title, {
            description: row.message || undefined,
            duration: 8000,
            action: row.action_url
              ? {
                  label: 'Abrir',
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
