import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

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
  logo_url?: string | null;
  primary_color?: string | null;
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

async function fetchCurrentUser(): Promise<CurrentUserData | null> {
  // Verificar se há sessão ativa
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  // O cliente Supabase já injeta automaticamente o Authorization header quando há sessão ativa
  const { data: userData, error: functionError } = await supabase.functions.invoke(
    'get-current-user'
  );

  // Verificar erro na resposta (pode estar em functionError ou em data.error)
  const hasError = functionError || userData?.error;
  
  if (hasError) {
    const errorMessage = functionError?.message || userData?.error || '';
    const errorString = JSON.stringify(functionError || userData);
    
    console.error('❌ [useCurrentUser] Erro na edge function:', errorMessage, errorString);
    
    // Se o erro for 401 (não autenticado), fazer logout silencioso
    // Isso acontece quando o JWT expirou mas getSession ainda retorna sessão em cache
    const isAuthError = 
      errorMessage.includes('401') || 
      errorMessage.includes('Não autenticado') ||
      errorMessage.includes('not authenticated') ||
      errorString.includes('401') ||
      errorString.includes('Não autenticado');
    
    if (isAuthError) {
      console.warn('[useCurrentUser] JWT expirado, fazendo logout silencioso...');
      await supabase.auth.signOut();
      return null;
    }
    
    throw new Error(errorMessage || 'Erro ao buscar dados do usuário');
  }

  if (!userData) {
    throw new Error('Nenhum dado retornado pela edge function');
  }

  return userData;
}

/**
 * Hook único que substitui useSupabaseAuth, useUserProfile, useCurrentOrganization e useUserRole
 * Usa React Query para compartilhar cache entre todos os componentes
 */
export function useCurrentUser() {
  const queryClient = useQueryClient();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Verificar sessão inicial
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setSessionChecked(true);
    };
    
    checkSession();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setHasSession(!!session);
      setSessionChecked(true);
      
      // Só invalida no login real - refresh de token não altera dados do usuário
      if (event === 'SIGNED_IN') {
        queryClient.invalidateQueries({ queryKey: ['current-user'] });
      } else if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(['current-user'], null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const {
    data,
    isLoading: queryLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 10, // 10 minutos
    retry: 1,
    enabled: sessionChecked && hasSession, // Só executa se verificou sessão e há sessão ativa
  });

  // Estado de loading mais preciso:
  // - Se ainda não verificamos a sessão, está carregando
  // - Se está carregando a query E não temos dados em cache, está carregando
  // - Se já temos dados, refetch acontece silenciosamente em background
  const loading = !sessionChecked || (hasSession && queryLoading && !data);

  return {
    // Dados completos
    data: data || null,
    
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
    error: error as Error | null,
    
    // Helpers adicionais
    sessionChecked,
    hasSession,
  };
}
