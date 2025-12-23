import { useCallback, useEffect, useState } from 'react';
import { getOnboardingStatus, OnboardingStatus } from '@/services/onboarding';
import { supabase } from '@/integrations/supabase/client';

export function useOnboardingStatus(userId?: string | null) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      setHasActiveMembership(false);
      setLoading(false);
      return;
    }

    try {
      // Check if user has an active membership in any organization
      // This is the PRIMARY check - if user was invited to an org, they should NOT go to onboarding
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('id, organization_id, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        console.error('[useOnboardingStatus] Error checking membership:', membershipError);
      }

      // If user has active membership, they're already onboarded (invited users)
      if (membership) {
        setHasActiveMembership(true);
        setStatus({
          id: '',
          user_id: userId,
          completed: true, // Treat as completed since they have an org
          current_step: 3,
          data: {},
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        });
        setLoading(false);
        return;
      }

      // No active membership - check onboarding_status table
      const data = await getOnboardingStatus();
      
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

  // User is "onboarded" if they completed onboarding OR if they have active membership (invited users)
  const isOnboarded = hasActiveMembership || (status?.completed ?? false);

  return {
    status,
    onboardingCompleted: isOnboarded,
    currentStep: status?.current_step ?? 1,
    loading,
    hasActiveMembership,
  };
}
