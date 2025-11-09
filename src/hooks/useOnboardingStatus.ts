import { useCallback, useEffect, useState } from 'react';
import { getOnboardingStatus, OnboardingStatus } from '@/services/onboarding';
import { supabase } from '@/integrations/supabase/client';

export function useOnboardingStatus(userId?: string | null) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      const data = await getOnboardingStatus();
      
      // Se não existe linha, criar defaults
      if (!data) {
        setStatus({
          id: '',
          user_id: userId,
          completed: false,
          current_step: 1,
          data: {},
          created_at: new Date().toISOString(),
          completed_at: null
        });
      } else {
        setStatus(data);
      }
    } catch (error) {
      console.error('[useOnboardingStatus] Error fetching:', error);
      // Em caso de erro, assume defaults seguros
      setStatus({
        id: '',
        user_id: userId ?? '',
        completed: false,
        current_step: 1,
        data: {},
        created_at: new Date().toISOString(),
        completed_at: null
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('onboarding_status_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_status',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchStatus]);

  return {
    status,
    onboardingCompleted: status?.completed ?? false,
    currentStep: status?.current_step ?? 1,
    loading,
  };
}
