const NETWORK_AUTH_MESSAGE =
  'Não foi possível conectar ao servidor de autenticação. Tente novamente em instantes ou acione o suporte.';

type AuthLikeError = {
  message?: string;
  status?: number;
  name?: string;
};

export type AuthAuditWarning = {
  status?: number;
  message: string;
  isHtmlResponse: boolean;
  origin: string | null;
  timestamp: string;
};

const AUTH_AUDIT_WARNING_KEY = 'auth_audit_last_warning';

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
  const viteAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const vitePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const anonKey = viteAnonKey || vitePublishableKey;

  let supabaseHost: string | null = null;
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : null;
  } catch {
    supabaseHost = 'invalid-url';
  }

  console.info('[AUTH_CONFIG_CHECK]', {
    supabaseUrlHost: supabaseHost,
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(anonKey),
    anonKeyPrefix: typeof anonKey === 'string' ? anonKey.slice(0, 8) : null,
    anonKeyLooksLikeJwt: typeof anonKey === 'string' && anonKey.split('.').length === 3,
    serviceRoleInFrontend: typeof anonKey === 'string' && anonKey.toLowerCase().includes('service_role'),
    clientSingleton: true,
    origin: typeof window !== 'undefined' ? window.location.origin : null,
    mode: import.meta.env.MODE,
    envKeyMap: {
      VITE_SUPABASE_ANON_KEY: Boolean(viteAnonKey),
      VITE_SUPABASE_PUBLISHABLE_KEY: Boolean(vitePublishableKey),
      SUPABASE_ANON_KEY: false,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: false,
      REACT_APP_SUPABASE_ANON_KEY: false,
    },
  });
}


export function logAuthDiagnostic() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  console.info('[AUTH_DIAGNOSTIC]', {
    origin: typeof window !== 'undefined' ? window.location.origin : null,
    supabaseUrl,
    hasAnonKey: Boolean(anonKey),
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    timestamp: new Date().toISOString(),
    buildMode: import.meta.env.MODE,
  });
}

export function safeMaskUserId(userId?: string | null) {
  if (!userId) return 'unknown';
  if (userId.length <= 8) return `${userId.slice(0, 2)}***`;
  return `${userId.slice(0, 4)}***${userId.slice(-4)}`;
}

export function persistAuthAuditWarning(warning: AuthAuditWarning) {
  try {
    localStorage.setItem(AUTH_AUDIT_WARNING_KEY, JSON.stringify(warning));
  } catch {
    // best effort only
  }
}

export function getLastAuthAuditWarning(): AuthAuditWarning | null {
  try {
    const raw = localStorage.getItem(AUTH_AUDIT_WARNING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthAuditWarning;
  } catch {
    return null;
  }
}

export function logAuthAuditBestEffortFailed(payload: Omit<AuthAuditWarning, 'timestamp' | 'origin'>) {
  const warning: AuthAuditWarning = {
    ...payload,
    origin: typeof window !== 'undefined' ? window.location.origin : null,
    timestamp: new Date().toISOString(),
  };

  persistAuthAuditWarning(warning);
  console.warn('[AUTH_AUDIT_BEST_EFFORT_FAILED]', warning);
}

export function logAuthLoginSuccessWithAuditWarning(userId?: string | null) {
  console.info('[AUTH_LOGIN_SUCCESS_WITH_AUDIT_WARNING]', {
    userId: safeMaskUserId(userId),
    timestamp: new Date().toISOString(),
  });
}
