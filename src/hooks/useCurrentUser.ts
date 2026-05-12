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
      // Auth error esperado - tentar refresh silenciosamente UMA vez.
      // Se falhar de novo, NÃO tentamos novamente nesta chamada — propagamos
      // erro para o React Query parar (o retry da query já está desabilitado
      // para 401), evitando o loop de POSTs 401 visto em produção.
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshData.session) {
        // HARDENING: NÃO deslogar automaticamente em falha de refresh.
        // Erros transitórios (522/CORS/timeout do backend) faziam o app
        // chutar todo mundo pra /login. A sessão local pode continuar
        // válida — apenas reportamos o erro pro React Query e deixamos
        // o usuário no app. Logout só acontece via ação explícita ou
        // quando getSession() comprovar ausência de sessão.
        const refreshMsg = String(refreshError?.message || '').toLowerCase();
        const isTransient =
          !refreshError ||
          refreshMsg.includes('fetch') ||
          refreshMsg.includes('network') ||
          refreshMsg.includes('timeout') ||
          refreshMsg.includes('522') ||
          refreshMsg.includes('failed');
        if (isTransient) {
          throw new Error('transient_auth_error');
        }
        return null;
      }

      // Token renovado - retry silencioso (única tentativa)
      const { data: retryData, error: retryError } = await supabase.functions.invoke('get-current-user');

      if (retryError || retryData?.error) {
        // Não retornar null aqui — lançar erro para o React Query marcar como
        // "errored" e respeitar o `retry: false` para 401, parando a cascata.
        throw new Error('unauthenticated');
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
  // AUTH.1.4 — observabilidade segura: registra último evento de auth (sem token).
  const [lastAuthEvent, setLastAuthEvent] = useState<string | null>(null);
  const [lastAuthEventAt, setLastAuthEventAt] = useState<string | null>(null);

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
      setLastAuthEvent(event);
      setLastAuthEventAt(new Date().toISOString());

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[AUTH_EVENT]', {
          event,
          hasSession: !!session,
          userId: session?.user?.id?.slice(0, 8) ?? null,
        });
      }

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
      // Não retry em auth errors (401) — evita cascata de POSTs 401 quando
      // a sessão está realmente expirada.
      const msg = String(error?.message || '').toLowerCase();
      if (
        msg.includes('401') ||
        msg.includes('não autenticado') ||
        msg.includes('unauthenticated') ||
        msg.includes('unauthorized')
      ) {
        return false;
      }
      // Retry apenas 1x para erros 5xx/timeouts transitórios
      return failureCount < 1;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    enabled: sessionChecked && hasSession, // Só executa se verificou sessão e há sessão ativa
  });

  // Estado de loading mais preciso:
  // - Se ainda não verificamos a sessão, está carregando
  // - Se está carregando a query E não temos dados em cache, está carregando
  // - Se já temos dados, refetch acontece silenciosamente em background
  const loading = !sessionChecked || (hasSession && queryLoading && !data);

  // AUTH.1.2: a verdade da autenticação é a sessão Supabase (hasSession),
  // NÃO o sucesso da edge function get-current-user. Se o profile fetch falhar
  // (cold start, 5xx transitório), o usuário continua autenticado — só o perfil
  // está em loading. Isso evita falso logout / kick para /login.
  if (import.meta.env.DEV) {
    // Log mínimo para diagnóstico — sem token, sem email, sem sessão completa
    // eslint-disable-next-line no-console
    console.info('[AUTH_DEBUG]', {
      sessionChecked,
      hasSession,
      profileLoaded: !!data?.user,
      loading,
    });
  }

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
    // Fonte da verdade: sessão Supabase (não a edge function de perfil).
    isAuthenticated: hasSession,
    hasProfile: !!data?.user,

    // Estado
    loading,
    error: error as Error | null,

    // Helpers adicionais
    sessionChecked,
    hasSession,
    lastAuthEvent,
    lastAuthEventAt,
  };
}
