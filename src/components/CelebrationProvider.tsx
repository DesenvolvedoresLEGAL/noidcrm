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

  // Handle new celebration notification
  const handleCelebration = useCallback((notification: Notification) => {
    console.log('🎉 Celebration notification received:', notification);
    
    // Trigger effects IMMEDIATELY before showing modal
    if (enabled) {
      console.log('🎊 Triggering confetti...');
      triggerConfetti();
    }
    
    if (soundEnabled) {
      console.log('🔊 Playing celebration sound...');
      playCelebrationSound();
    }
    
    // Then show the modal
    setCelebrationNotification(notification);
  }, [enabled, soundEnabled, triggerConfetti, playCelebrationSound]);

  // Subscribe to realtime notifications filtered by user_id
  useEffect(() => {
    if (!user?.id) {
      console.log('CelebrationProvider: No user, skipping subscription');
      return;
    }

    console.log('CelebrationProvider: Setting up realtime subscription for user:', user.id);

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
          console.log('CelebrationProvider: New notification received:', notification);
          
          // Check if this is a celebration notification
          if (
            CELEBRATION_TYPES.includes(notification.type) &&
            notification.metadata?.show_celebration
          ) {
            handleCelebration(notification);
          }
        }
      )
      .subscribe((status) => {
        console.log('CelebrationProvider: Subscription status:', status);
      });

    return () => {
      console.log('CelebrationProvider: Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleCelebration]);

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
