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
    const startTime = Date.now();

    const fetchCurrentUser = async () => {
      try {
        console.log('⏳ [useCurrentUser] Iniciando fetch de dados do usuário...');
        
        // Verificar se há sessão ativa
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('ℹ️ [useCurrentUser] Nenhuma sessão ativa encontrada');
          if (isMounted) {
            setData(null);
            setLoading(false);
          }
          return;
        }

        console.log('✅ [useCurrentUser] Sessão ativa encontrada, chamando edge function...');
        const functionStartTime = Date.now();

        // O cliente Supabase já injeta automaticamente o Authorization header quando há sessão ativa
        const { data: userData, error: functionError } = await supabase.functions.invoke(
          'get-current-user'
        );

        const functionDuration = Date.now() - functionStartTime;
        console.log(`⏱️ [useCurrentUser] Edge function respondeu em ${functionDuration}ms`);

        if (functionError) {
          console.error('❌ [useCurrentUser] Erro na edge function:', functionError);
          throw functionError;
        }

        if (!userData) {
          throw new Error('Nenhum dado retornado pela edge function');
        }

        console.group('✅ [useCurrentUser] Dados recebidos com sucesso');
        console.log('  User:', userData.user?.email);
        console.log('  Profile:', userData.profile?.full_name);
        console.log('  Organization:', userData.organization?.name);
        console.log('  Roles:', userData.roles);
        console.log('  Is Owner:', userData.isOwner);
        console.log('  Is Org Admin:', userData.isOrgAdmin);
        console.log('  Has Admin Role:', userData.hasAdminRole);
        console.groupEnd();

        if (isMounted) {
          setData(userData);
          setError(null);
          
          const totalDuration = Date.now() - startTime;
          console.log(`⏱️ [useCurrentUser] Processo completo: ${totalDuration}ms`);
        }
      } catch (err) {
        console.error('❌ [useCurrentUser] Erro durante fetch:', err);
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
      console.log(`🔔 [useCurrentUser] Auth state changed: ${event}`);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('🔄 [useCurrentUser] Refetch necessário devido a:', event);
        setLoading(true);
        // Pequeno delay para evitar race conditions
        setTimeout(() => fetchCurrentUser(), 100);
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 [useCurrentUser] Usuário deslogou, limpando dados');
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
