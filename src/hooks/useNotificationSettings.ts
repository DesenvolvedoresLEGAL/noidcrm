import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export interface NotificationSettings {
  id: string;
  user_id: string;
  daily_digest_enabled: boolean;
  daily_digest_time: string;
  daily_digest_email_enabled: boolean;
  daily_digest_dashboard_enabled: boolean;
  realtime_in_app_enabled: boolean;
  realtime_browser_push_enabled: boolean;
  realtime_email_enabled: boolean;
  proposal_view_alert_enabled: boolean;
  proposal_expiring_alert_enabled: boolean;
  client_reply_alert_enabled: boolean;
  activity_due_alert_enabled: boolean;
  activity_overdue_alert_enabled: boolean;
  team_events_enabled: boolean;
  notify_scope: 'mine_only' | 'mine_and_team';
}

const DEFAULTS: Omit<NotificationSettings, 'id' | 'user_id'> = {
  daily_digest_enabled: true,
  daily_digest_time: '06:00',
  daily_digest_email_enabled: true,
  daily_digest_dashboard_enabled: true,
  realtime_in_app_enabled: true,
  realtime_browser_push_enabled: false,
  realtime_email_enabled: false,
  proposal_view_alert_enabled: true,
  proposal_expiring_alert_enabled: true,
  client_reply_alert_enabled: true,
  activity_due_alert_enabled: true,
  activity_overdue_alert_enabled: true,
  team_events_enabled: false,
  notify_scope: 'mine_only',
};

export function useNotificationSettings() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return (data as NotificationSettings | null) ?? { ...DEFAULTS, user_id: userId, id: '' };
    },
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<Omit<NotificationSettings, 'id' | 'user_id'>>) => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('notification_settings')
        .upsert(
          { user_id: userId, ...updates },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings', userId] });
      toast.success('Preferências salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar preferências');
    },
  });

  return {
    settings: settings ?? { ...DEFAULTS, user_id: userId ?? '', id: '' } as NotificationSettings,
    isLoading,
    isSaving: mutation.isPending,
    saveSettings: mutation.mutate,
  };
}
