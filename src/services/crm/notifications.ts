import { supabase } from '@/integrations/supabase/client';

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

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
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

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('read', false);

  if (error) throw error;
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);

  if (error) throw error;
  return count || 0;
}
