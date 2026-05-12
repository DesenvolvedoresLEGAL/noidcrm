import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getLastAuthAuditWarning } from '@/lib/authDiagnostics';

type AuthStatusState = {
  authHealth: 'idle' | 'ok' | 'error';
  restHealth: 'idle' | 'ok' | 'error';
  authStatusCode?: number;
  restStatusCode?: number;
  authMessage?: string;
  restMessage?: string;
  lastAuthError?: string;
  authClientOk?: boolean;
  bestEffortModeActive?: boolean;
  lastAuthAuditError?: string;
};

export default function AuthStatus() {
  const [state, setState] = useState<AuthStatusState>({ authHealth: 'idle', restHealth: 'idle' });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  useEffect(() => {
    let active = true;

    const runChecks = async () => {
      const next: AuthStatusState = { authHealth: 'idle', restHealth: 'idle' };

      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET' });
        next.authHealth = res.ok ? 'ok' : 'error';
        next.authStatusCode = res.status;
        next.authMessage = res.ok ? 'auth healthcheck ok' : `auth healthcheck failed (${res.status})`;
      } catch (e: any) {
        next.authHealth = 'error';
        next.authMessage = String(e?.message || e || 'auth healthcheck fetch failed');
      }

      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'GET',
          headers: { apikey: anonKey },
        });
        next.restHealth = res.ok ? 'ok' : 'error';
        next.restStatusCode = res.status;
        next.restMessage = res.ok ? 'rest healthcheck ok' : `rest healthcheck failed (${res.status})`;
      } catch (e: any) {
        next.restHealth = 'error';
        next.restMessage = String(e?.message || e || 'rest healthcheck fetch failed');
      }

      const { error } = await supabase.auth.getSession();
      next.authClientOk = !error;
      next.bestEffortModeActive = true;
      if (error) {
        next.lastAuthError = error.message;
      }

      const lastAuditWarning = getLastAuthAuditWarning();
      if (lastAuditWarning) {
        next.lastAuthAuditError = `${lastAuditWarning.timestamp} | ${lastAuditWarning.message}`;
      }

      if (active) setState(next);
    };

    runChecks();
    return () => {
      active = false;
    };
  }, [anonKey, supabaseUrl]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-4 rounded-xl border bg-card p-6">
        <h1 className="text-xl font-semibold">Auth Status</h1>
        <p className="text-sm text-muted-foreground">Rota técnica para diagnóstico seguro de autenticação.</p>
        <ul className="space-y-2 text-sm">
          <li><strong>Supabase URL:</strong> {supabaseUrl || 'missing'}</li>
          <li><strong>hasAnonKey:</strong> {String(Boolean(anonKey))}</li>
          <li><strong>origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'n/a'}</li>
          <li><strong>auth client ok:</strong> {String(Boolean(state.authClientOk))}</li>
          <li><strong>auth audit best effort mode:</strong> {String(Boolean(state.bestEffortModeActive))}</li>
          <li><strong>environment:</strong> {import.meta.env.MODE}</li>
          <li><strong>build version:</strong> {import.meta.env.VITE_APP_VERSION || 'n/a'}</li>
          <li><strong>auth health:</strong> {state.authHealth} {state.authStatusCode ? `(${state.authStatusCode})` : ''}</li>
          <li><strong>rest health:</strong> {state.restHealth} {state.restStatusCode ? `(${state.restStatusCode})` : ''}</li>
          <li><strong>auth health message:</strong> {state.authMessage || 'n/a'}</li>
          <li><strong>rest health message:</strong> {state.restMessage || 'n/a'}</li>
          <li><strong>last auth error:</strong> {state.lastAuthError || 'none'}</li>
          <li><strong>last auth audit error:</strong> {state.lastAuthAuditError || 'none'}</li>
        </ul>
      </div>
    </main>
  );
}
