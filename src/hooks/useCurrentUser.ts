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
  const responseError = userData?.error;
  const hasError = functionError || responseError;
  
  if (hasError) {
    const errorMessage = String(functionError?.message || responseError || '');
    const responseErrorStr = String(responseError || '');
    
    console.error('❌ [useCurrentUser] Erro na edge function:', { 
      functionError, 
      responseError,
      errorMessage 
    });
    
    // Se o erro for 401 (não autenticado), fazer logout silencioso
    // Isso acontece quando o JWT expirou mas getSession ainda retorna sessão em cache
    // Verificar em múltiplos lugares pois a estrutura do erro pode variar
    const isAuthError = 
      errorMessage.toLowerCase().includes('401') || 
      errorMessage.toLowerCase().includes('não autenticado') ||
      errorMessage.toLowerCase().includes('not authenticated') ||
      errorMessage.toLowerCase().includes('unauthorized') ||
      responseErrorStr.toLowerCase().includes('não autenticado') ||
      responseErrorStr.toLowerCase().includes('not authenticated');
    
    if (isAuthError) {
      console.warn('[useCurrentUser] Sessão inválida, fazendo logout silencioso...');
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
    retry: false, // Não retry - erros de auth fazem logout silencioso
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
