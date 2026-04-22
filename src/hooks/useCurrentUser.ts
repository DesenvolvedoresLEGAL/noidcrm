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
  default_pipeline_id: string | null;
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

  // Verificar se o token não está expirado (verificação local antes de chamar edge function)
  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    // Token expirado - tentar refresh silenciosamente
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) {
      // Refresh falhou - sessão inválida
      return null;
    }
  }

  // O cliente Supabase já injeta automaticamente o Authorization header quando há sessão ativa
  const { data: userData, error: functionError } = await supabase.functions.invoke(
    'get-current-user'
  );

  // Verificar erro na resposta (pode estar em functionError ou em data.error)
  const responseError = userData?.error;
  const hasError = functionError || responseError;
  
  if (hasError) {
    // Tentar extrair mensagem de erro de várias fontes
    let errorDetails = '';
    
    // Se functionError existe, tentar extrair o corpo da resposta
    if (functionError) {
      try {
        // FunctionsHttpError pode ter context com a resposta
        const context = (functionError as any)?.context;
        if (context?.json) {
          const jsonBody = await context.json();
          errorDetails = jsonBody?.error || JSON.stringify(jsonBody);
        }
      } catch {
        // Ignorar erro ao extrair contexto
      }
    }
    
    const errorMessage = String(functionError?.message || responseError || errorDetails || '');
    const allErrorText = `${errorMessage} ${responseError || ''} ${errorDetails}`.toLowerCase();
    
    // Se o erro for 401 (não autenticado), é um erro esperado quando sessão é inválida
    const isAuthError = 
      allErrorText.includes('401') || 
      allErrorText.includes('não autenticado') ||
      allErrorText.includes('not authenticated') ||
      allErrorText.includes('unauthorized') ||
      (functionError && errorMessage.includes('non-2xx'));
    
    if (isAuthError) {
      // Auth error esperado - tentar refresh silenciosamente
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        // Verificar se há uma sessão de roleplay ativa antes de fazer logout
        try {
          const { useRoleplaySessionStore } = await import('./useRoleplaySession');
          const isInActiveSession = useRoleplaySessionStore.getState().isInActiveSession;
          
          if (isInActiveSession) {
            // Sessão de roleplay ativa - não fazer logout
            throw new Error('Sessão expirada. Salve seu progresso e faça login novamente.');
          }
        } catch (importError) {
          // Ignorar erro de importação do roleplay store
        }
        
        // Refresh falhou - fazer logout silencioso
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignorar erro de signOut
        }
        return null;
      }
      
      // Token renovado - retry silencioso
      const { data: retryData, error: retryError } = await supabase.functions.invoke('get-current-user');
      
      if (retryError || retryData?.error) {
        return null;
      }
      
      return retryData;
    }
    
    // Para outros erros, apenas retornar null
    return null;
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
    // Retry 2x com backoff para tolerar timeouts transientes do backend
    // (cold-start de edge functions ou pico momentâneo no Postgres)
    retry: (failureCount, error: any) => {
      // Não retry em auth errors (401)
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('401') || msg.includes('não autenticado') || msg.includes('unauthorized')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
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
