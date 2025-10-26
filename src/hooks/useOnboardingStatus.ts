import { useEffect, useState } from 'react';
import { getOnboardingStatus, OnboardingStatus } from '@/services/onboarding';
import { useSupabaseAuth } from './useSupabaseAuth';

export function useOnboardingStatus() {
  const { user } = useSupabaseAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const data = await getOnboardingStatus();
        
        // Se não existe linha, criar defaults
        if (!data) {
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
          setStatus(data);
        }
      } catch (error) {
        console.error('Error fetching onboarding status:', error);
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
    };

    fetchStatus();
  }, [user]);

  return {
    status,
    onboardingCompleted: status?.completed ?? false,
    currentStep: status?.current_step ?? 1,
    loading,
  };
}
