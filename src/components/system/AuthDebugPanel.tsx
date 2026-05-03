// AUTH.1.4 — DEV-only auth observability panel.
// Mostra estado seguro de sessão/organização. NUNCA exibe token, email completo ou sessão.
import { useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';

function shortId(id?: string | null) {
  if (!id) return '—';
  return id.slice(0, 8);
}

export function AuthDebugPanel() {
  if (!import.meta.env.DEV) return null;

  const location = useLocation();
  const {
    loading,
    sessionChecked,
    hasSession,
    user,
    organization,
    lastAuthEvent,
    lastAuthEventAt,
  } = useCurrentUser() as ReturnType<typeof useCurrentUser> & {
    lastAuthEvent?: string | null;
    lastAuthEventAt?: string | null;
  };

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );

  return (
    <div className="fixed bottom-3 right-3 z-[9999] max-w-xs rounded-xl border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">AUTH DEBUG</div>
        <div className="text-[10px] text-muted-foreground">DEV</div>
      </div>
      <div className="space-y-1">
        <Row k="authLoading" v={String(loading)} />
        <Row k="sessionChecked" v={String(sessionChecked)} />
        <Row k="hasSession" v={String(hasSession)} />
        <Row k="hasUser" v={String(!!user?.id)} />
        <Row k="userId" v={shortId(user?.id)} />
        <Row k="organizationId" v={shortId(organization?.id)} />
        <Row k="orgLoaded" v={String(!!organization?.id)} />
        <Row k="path" v={<span className="truncate max-w-[140px] inline-block">{location.pathname}</span>} />
        <Row k="lastEvent" v={lastAuthEvent ?? '—'} />
        <Row k="lastEventAt" v={lastAuthEventAt ? new Date(lastAuthEventAt).toLocaleTimeString() : '—'} />
      </div>
    </div>
  );
}
