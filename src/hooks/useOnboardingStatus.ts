import { useCallback, useEffect, useState } from 'react';
import { getOnboardingStatus, OnboardingStatus } from '@/services/onboarding';
import { useSupabaseAuth } from './useSupabaseAuth';
import { supabase } from '@/integrations/supabase/client';

export function useOnboardingStatus() {
  const { user } = useSupabaseAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      console.log('[useOnboardingStatus] User não disponível, mantendo loading=true');
      setStatus(null);
      // NÃO fazer setLoading(false) aqui - esperar o user estar disponível
      return;
    }

    try {
      const data = await getOnboardingStatus();
      
      // Se não existe linha, criar defaults
      if (!data) {
        console.log('[useOnboardingStatus] Nenhum status encontrado, criando defaults');
        setStatus({
          id: '',
          user_id: user.id,
          completed: false,
          current_step: 1,
          data: {},
          created_at: new Date().toISOString(),
          completed_at: null
        });
      } else {
        console.log('[useOnboardingStatus] Status carregado do banco:', {
          completed: data.completed,
          current_step: data.current_step,
          user_id: data.user_id
        });
        setStatus(data);
      }
    } catch (error) {
      console.error('[useOnboardingStatus] Error fetching:', error);
      // Em caso de erro, assume defaults seguros
      setStatus({
        id: '',
        user_id: user.id,
        completed: false,
        current_step: 1,
        data: {},
        created_at: new Date().toISOString(),
        completed_at: null
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    console.log('[useOnboardingStatus] Iniciando subscription para user:', user.id);
    
    const channel = supabase
      .channel('onboarding_status_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_status',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useOnboardingStatus] Realtime update recebido:', {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old
          });
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      console.log('[useOnboardingStatus] Removendo subscription');
      supabase.removeChannel(channel);
    };
  }, [user, fetchStatus]);

  return {
    status,
    onboardingCompleted: status?.completed ?? false,
    currentStep: status?.current_step ?? 1,
    loading,
  };
}
