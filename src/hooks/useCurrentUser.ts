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
  // Apenas leitura local da sessão — NÃO dispara refresh manual.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  // IMPORTANTE: NÃO chamamos `supabase.auth.refreshSession()` aqui.
  // O cliente Supabase já tem `autoRefreshToken: true` e gerencia o refresh
  // em background. Chamar refreshSession manualmente em paralelo causava
  // uma tempestade de POSTs `/auth/v1/token?grant_type=refresh_token` que o
  // GoTrue rapidamente rate-limitava (HTTP 429), travando o usuário fora do
  // sistema (visto em produção: rate limit reached para gustavo.lacerda@*).

  const { data: userData, error: functionError } = await supabase.functions.invoke(
    'get-current-user'
  );

  const responseError = userData?.error;
  const hasError = functionError || responseError;

  if (hasError) {
    let errorDetails = '';
    if (functionError) {
      try {
        const context = (functionError as any)?.context;
        if (context?.json) {
          const jsonBody = await context.json();
          errorDetails = jsonBody?.error || JSON.stringify(jsonBody);
        }
      } catch {
        // ignore
      }
    }

    const errorMessage = String(functionError?.message || responseError || errorDetails || '');
    const allErrorText = `${errorMessage} ${responseError || ''} ${errorDetails}`.toLowerCase();

    const isAuthError =
      allErrorText.includes('401') ||
      allErrorText.includes('não autenticado') ||
      allErrorText.includes('not authenticated') ||
      allErrorText.includes('unauthorized') ||
      (functionError && errorMessage.includes('non-2xx'));

    if (isAuthError) {
      // Não tentamos refresh manual — o cliente Supabase já cuida disso.
      // Propagamos para o React Query parar (retry desabilitado em 401).
      throw new Error('unauthenticated');
    }

    // Outros erros (5xx/timeout) — propagar para retry controlado.
    throw new Error(errorMessage || 'profile_fetch_failed');
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
