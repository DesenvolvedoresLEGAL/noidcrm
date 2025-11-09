import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CurrentUserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  monthly_goal: number | null;
  birth_date: string | null;
  cpf: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentUserOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  trial_ends_at: string | null;
  current_plan_id: string | null;
}

export interface CurrentUserMembership {
  id: string;
  role: string;
  org_role: string | null;
  status: string;
  joined_at: string | null;
  created_at: string;
}

export interface CurrentUserData {
  user: {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    created_at: string;
  } | null;
  profile: CurrentUserProfile | null;
  organization: CurrentUserOrganization | null;
  membership: CurrentUserMembership | null;
  roles: string[];
  isOwner: boolean;
  isOrgAdmin: boolean;
  hasAdminRole: boolean;
}

/**
 * Hook único que substitui useSupabaseAuth, useUserProfile, useCurrentOrganization e useUserRole
 * Faz uma única chamada à edge function get-current-user que retorna todos os dados necessários
 */
export function useCurrentUser() {
  const [data, setData] = useState<CurrentUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchCurrentUser = async () => {
      try {
        console.log('[useCurrentUser] Fetching current user data...');
        
        // Verificar se há sessão ativa
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('[useCurrentUser] No active session');
          if (isMounted) {
            setData(null);
            setLoading(false);
          }
          return;
        }

        // Chamar edge function
        const { data: userData, error: functionError } = await supabase.functions.invoke(
          'get-current-user',
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (functionError) {
          console.error('[useCurrentUser] Function error:', functionError);
          throw functionError;
        }

        if (!userData) {
          throw new Error('Nenhum dado retornado');
        }

        console.log('[useCurrentUser] Data received:', {
          hasUser: !!userData.user,
          hasProfile: !!userData.profile,
          hasOrg: !!userData.organization,
          roles: userData.roles,
        });

        if (isMounted) {
          setData(userData);
          setError(null);
        }
      } catch (err) {
        console.error('[useCurrentUser] Error:', err);
        if (isMounted) {
          setError(err as Error);
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCurrentUser();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useCurrentUser] Auth state changed:', event);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchCurrentUser();
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setData(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    // Dados completos
    data,
    
    // Dados individuais para compatibilidade
    user: data?.user || null,
    profile: data?.profile || null,
    organization: data?.organization || null,
    membership: data?.membership || null,
    roles: data?.roles || [],
    
    // Flags booleanas
    isOwner: data?.isOwner || false,
    isOrgAdmin: data?.isOrgAdmin || false,
    hasAdminRole: data?.hasAdminRole || false,
    isAuthenticated: !!data?.user,
    
    // Estado
    loading,
    error,
  };
}
