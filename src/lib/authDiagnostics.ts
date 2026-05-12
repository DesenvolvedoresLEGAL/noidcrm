const NETWORK_AUTH_MESSAGE =
  'Não foi possível conectar ao servidor de autenticação. Tente novamente em instantes ou acione o suporte.';

type AuthLikeError = {
  message?: string;
  status?: number;
  name?: string;
};

function getAuthErrorShape(error: unknown): AuthLikeError {
  if (!error || typeof error !== 'object') {
    return { message: String(error || '') };
  }

  const value = error as AuthLikeError;
  return {
    message: value.message,
    status: value.status,
    name: value.name,
  };
}

export function isNetworkAuthError(error: unknown) {
  const { message, status, name } = getAuthErrorShape(error);
  const text = `${message || ''} ${name || ''}`.toLowerCase();

  return (
    status === 0 ||
    status === 522 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('cors') ||
    text.includes('err_failed') ||
    text.includes('timeout') ||
    text.includes('load failed')
  );
}

export function getLoginErrorDescription(error: unknown) {
  const { message } = getAuthErrorShape(error);
  const text = String(message || '').toLowerCase();

  if (text.includes('invalid login credentials')) {
    return 'Email ou senha incorretos.';
  }

  if (text.includes('email not confirmed')) {
    return 'Por favor, confirme seu email antes de fazer login.';
  }

  if (isNetworkAuthError(error)) {
    return NETWORK_AUTH_MESSAGE;
  }

  return 'Não foi possível concluir o login agora. Tente novamente em instantes.';
}

export function logAuthLoginError(error: unknown) {
  const { message, status, name } = getAuthErrorShape(error);

  // Não logar email, senha, token, sessão nem payload completo.
  console.error('[AUTH_LOGIN_ERROR]', {
    message,
    status,
    name,
  });
}

export function logAuthConfigCheck() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let supabaseHost: string | null = null;
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : null;
  } catch {
    supabaseHost = 'invalid-url';
  }

  console.info('[AUTH_CONFIG_CHECK]', {
    hasSupabaseUrl: Boolean(supabaseUrl),
    supabaseHost,
    hasAnonKey: Boolean(anonKey),
    anonKeyLooksJwt: typeof anonKey === 'string' && anonKey.split('.').length === 3,
    serviceRoleInFrontend: typeof anonKey === 'string' && anonKey.toLowerCase().includes('service_role'),
  });
}
