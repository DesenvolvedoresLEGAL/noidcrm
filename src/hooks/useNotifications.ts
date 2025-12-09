import { useState, useEffect, useCallback } from 'react';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/services/crm/notifications';
import type { Notification } from '@/services/crm/notifications';
import { supabase } from '@/integrations/supabase/client';

// Celebration notification types
const CELEBRATION_TYPES = ['deal_won', 'team_deal_won', 'new_contract', 'new_onboarding'];

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [celebrationNotification, setCelebrationNotification] = useState<Notification | null>(null);

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
    console.log('New notification received:', newNotification);
    
    // Check if this is a celebration notification
    if (
      CELEBRATION_TYPES.includes(newNotification.type) &&
      newNotification.metadata?.show_celebration
    ) {
      setCelebrationNotification(newNotification);
    }

    // Update notifications list
    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    loadNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        handleNewNotification
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleNewNotification]);

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

  const dismissCelebration = useCallback(() => {
    setCelebrationNotification(null);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    celebrationNotification,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    refresh: loadNotifications,
    dismissCelebration,
  };
}
