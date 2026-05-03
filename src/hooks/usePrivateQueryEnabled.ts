// AUTH.1.3 — Helper único para gatear queries privadas.
// Usa useCurrentUser como fonte da verdade (hasSession + organização).
// Não cria queries novas: apenas lê o estado já compartilhado via React Query.
import { useCurrentUser } from './useCurrentUser';

export function usePrivateQueryEnabled(extra: boolean = true) {
  const { hasSession, sessionChecked, user, organization } = useCurrentUser();

  const enabled =
    sessionChecked &&
    hasSession &&
    !!user?.id &&
    !!organization?.id &&
    extra;

  return {
    enabled,
    organizationId: organization?.id ?? null,
    userId: user?.id ?? null,
    organization,
    hasSession,
    sessionChecked,
  };
}
