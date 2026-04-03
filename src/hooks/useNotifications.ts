import { useState, useEffect, useCallback } from 'react';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/services/crm/notifications';
import type { Notification } from '@/services/crm/notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const loadNotifications = async () => {
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(),
        getUnreadCount()
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewNotification = useCallback((payload: any) => {
    const newNotification = payload.new as Notification;
    console.log('useNotifications: New notification received:', newNotification);

    // Update notifications list
    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);

    // Proactive toast for proposal declined
    if (newNotification.type === 'proposal_declined') {
      const meta = (newNotification as any).metadata || {};
      const clientName = meta.account_name || meta.client_name || 'Cliente';
      const reason = meta.declined_reason ? ` — ${meta.declined_reason}` : '';
      toast.error(`Proposta Recusada: ${clientName}${reason}`, {
        description: 'Classifique a oportunidade com o motivo de perda.',
        duration: 15000,
      });
    }

    // Proactive toast for email reply received
    if (newNotification.type === 'email_reply_received') {
      const meta = (newNotification as any).metadata || {};
      const fromEmail = meta.from_email || 'Cliente';
      const subject = meta.subject || 'E-mail';
      const accountName = meta.account_name ? ` (${meta.account_name})` : '';
      toast.info(`Nova resposta: ${fromEmail}${accountName}`, {
        description: `Re: ${subject}`,
        duration: 10000,
      });
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    // Only subscribe if we have a user ID
    if (!userId) return;

    // Subscribe to realtime updates filtered by user_id
    const channel = supabase
      .channel(`notifications-list-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        handleNewNotification
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe((status) => {
        console.log('useNotifications: Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, handleNewNotification]);

  const markNotificationAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await markAllAsRead();
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    refresh: loadNotifications,
  };
}
