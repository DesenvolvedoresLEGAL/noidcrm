import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCelebrationSettings } from '@/hooks/useCelebrationSettings';
import { DealWonCelebrationModal } from '@/components/notifications/DealWonCelebrationModal';
import type { Notification } from '@/services/crm/notifications';
import confetti from 'canvas-confetti';

const CELEBRATION_TYPES = ['deal_won', 'team_deal_won', 'new_contract', 'new_onboarding'];

interface CelebrationProviderProps {
  children: ReactNode;
}

export function CelebrationProvider({ children }: CelebrationProviderProps) {
  const { user } = useSupabaseAuth();
  const [celebrationNotification, setCelebrationNotification] = useState<Notification | null>(null);
  const hasTriggeredRef = useRef(false);
  
  const { 
    enabled, 
    soundEnabled, 
    playCelebrationSound, 
    getParticleCount,
    animationDuration 
  } = useCelebrationSettings();

  // Trigger confetti animation
  const triggerConfetti = useCallback(() => {
    const duration = animationDuration;
    const particles = getParticleCount();
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = particles * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
      });
    }, 250);

    setTimeout(() => clearInterval(interval), duration + 100);
  }, [animationDuration, getParticleCount]);

  // Keep latest handler in a ref so the realtime subscription doesn't
  // re-subscribe every time settings/callbacks change reference.
  const handlerRef = useRef<(notification: Notification) => void>(() => {});
  handlerRef.current = (notification: Notification) => {
    if (enabled) triggerConfetti();
    if (soundEnabled) playCelebrationSound();
    setCelebrationNotification(notification);
  };

  // Subscribe to realtime notifications filtered by user_id (only re-subscribe when user changes)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`celebrations-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          if (
            CELEBRATION_TYPES.includes(notification.type) &&
            notification.metadata?.show_celebration
          ) {
            handlerRef.current(notification);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dismissCelebration = useCallback(() => {
    setCelebrationNotification(null);
  }, []);

  return (
    <>
      {children}
      <DealWonCelebrationModal
        notification={celebrationNotification}
        open={!!celebrationNotification}
        onClose={dismissCelebration}
      />
    </>
  );
}
