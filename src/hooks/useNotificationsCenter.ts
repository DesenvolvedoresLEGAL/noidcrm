import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationFilter = 'all' | 'unread' | 'proposals' | 'activities' | 'replies';

export interface NotificationItem {
  id: string;
  user_id: string;
  event_id: string | null;
  type: string;
  title: string;
  message: string | null;
  priority: NotificationPriority;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_push: boolean;
  status: string;
  action_url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  sent_at: string | null;
  created_at: string;
}

const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function filterByType(items: NotificationItem[], filter: NotificationFilter): NotificationItem[] {
  switch (filter) {
    case 'unread':
      return items.filter(n => !n.read_at && !n.dismissed_at);
    case 'proposals':
      return items.filter(n => n.type.startsWith('proposal_'));
    case 'activities':
      return items.filter(n => n.type.startsWith('activity_'));
    case 'replies':
      return items.filter(n => n.type === 'client_replied');
    default:
      return items;
  }
}

function sortByPriority(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3;
    const pb = PRIORITY_ORDER[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function useNotificationsCenter(filter: NotificationFilter = 'all') {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: rawNotifications = [], isLoading } = useQuery({
    queryKey: ['notifications-center', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications_v2')
        .select('*')
        .eq('user_id', userId)
        .eq('channel_in_app', true)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as NotificationItem[];
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });

  const filtered = sortByPriority(filterByType(rawNotifications, filter));
  const unreadCount = rawNotifications.filter(n => !n.read_at && !n.dismissed_at).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications-center', userId] });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications_v2')
        .update({ read_at: new Date().toISOString(), status: 'read' as any })
        .eq('id', id)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications_v2')
        .update({ read_at: new Date().toISOString(), status: 'read' as any })
        .eq('user_id', userId!)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications_v2')
        .update({ dismissed_at: new Date().toISOString(), status: 'dismissed' as any })
        .eq('id', id)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    notifications: filtered,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    dismiss: dismiss.mutate,
  };
}
