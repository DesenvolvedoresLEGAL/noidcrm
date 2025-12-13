import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';

export type PlatformAdminRole = 'super_admin' | 'admin' | 'support' | null;

interface PlatformAdminState {
  isPlatformAdmin: boolean;
  role: PlatformAdminRole;
  loading: boolean;
}

export function usePlatformAdmin() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [state, setState] = useState<PlatformAdminState>({
    isPlatformAdmin: false,
    role: null,
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setState({ isPlatformAdmin: false, role: null, loading: false });
      return;
    }

    const checkPlatformAdmin = async () => {
      try {
        // Check if user is platform admin
        const { data: isAdmin, error: adminError } = await supabase.rpc(
          'is_platform_admin',
          { _user_id: user.id }
        );

        if (adminError || !isAdmin) {
          setState({ isPlatformAdmin: false, role: null, loading: false });
          return;
        }

        // Get the role
        const { data: role, error: roleError } = await supabase.rpc(
          'get_platform_admin_role',
          { _user_id: user.id }
        );

        setState({
          isPlatformAdmin: true,
          role: roleError ? 'admin' : (role as PlatformAdminRole),
          loading: false,
        });
      } catch (error) {
        console.error('Error checking platform admin status:', error);
        setState({ isPlatformAdmin: false, role: null, loading: false });
      }
    };

    checkPlatformAdmin();
  }, [user, authLoading]);

  return {
    ...state,
    isSuperAdmin: state.role === 'super_admin',
    isSupport: state.role === 'support',
  };
}
