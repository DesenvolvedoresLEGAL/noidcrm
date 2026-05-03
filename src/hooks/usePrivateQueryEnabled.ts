// AUTH.1.3/1.4 — Helper único para gatear queries privadas.
// Usa useCurrentUser como fonte da verdade (hasSession + organização).
// Não cria queries novas: apenas lê o estado já compartilhado via React Query.
// AUTH.1.4: emite log DEV (sem PII) quando uma query privada é bloqueada por
// ausência de contexto. Usa ref para evitar spam em re-renders.
import { useRef } from 'react';
import { useCurrentUser } from './useCurrentUser';

export function usePrivateQueryEnabled(extra: boolean = true) {
  const { hasSession, sessionChecked, user, organization } = useCurrentUser();

  const enabled =
    sessionChecked &&
    hasSession &&
    !!user?.id &&
    !!organization?.id &&
    extra;

  const lastSnapshotRef = useRef<string | null>(null);

  if (import.meta.env.DEV && extra === true && !enabled) {
    const snapshot = `${sessionChecked}|${hasSession}|${!!user?.id}|${!!organization?.id}`;
    if (lastSnapshotRef.current !== snapshot) {
      lastSnapshotRef.current = snapshot;
      // eslint-disable-next-line no-console
      console.debug('[PRIVATE_QUERY_BLOCKED]', {
        sessionChecked,
        hasSession,
        hasUser: !!user?.id,
        hasOrganization: !!organization?.id,
      });
    }
  }

  return {
    enabled,
    organizationId: organization?.id ?? null,
    userId: user?.id ?? null,
    organization,
    hasSession,
    sessionChecked,
  };
}
