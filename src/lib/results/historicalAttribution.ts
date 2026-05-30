/**
 * Sprint OTE — Atribuição Histórica Imutável
 * ------------------------------------------
 * Helpers para garantir que Resultados/OTE/Comissão usem o vendedor (ou SDR)
 * responsável NO MOMENTO DO EVENTO (ganho, qualificação) e não o dono atual
 * do registro. Transferência operacional de carteira (ex.: exclusão de usuário
 * com transferência para outro) NÃO pode reescrever performance histórica.
 *
 * Fonte de verdade:
 *   - Receita histórica por vendedor: `commercial_won_revenue_historical_view`
 *     (resolve seller via `opportunity_owner_history`).
 *   - SDR histórico por qualificação: `opportunity_qualification_history`.
 *   - Status do usuário (ativo/inativo/excluído): `crm_active_users_view`.
 */

export type AttributionStatus = 'active' | 'inactive' | 'unknown';

export interface HistoricalUserDisplay {
  userId: string;
  name: string;
  status: AttributionStatus;
  /** Label curto para badge: "Inativo" / "Excluído" / "" */
  badgeLabel: string;
}

/**
 * Marca usuário como inativo/excluído quando ele NÃO consta em
 * `crm_active_users_view` (fonte oficial de usuários ativos da org).
 */
export function buildHistoricalUserDisplay(
  userId: string,
  fallbackName: string | null | undefined,
  activeUserIds: Set<string>,
  profileMap?: Map<string, { full_name?: string | null }>,
): HistoricalUserDisplay {
  const isActive = activeUserIds.has(userId);
  const profileName = profileMap?.get(userId)?.full_name ?? null;
  const name = profileName || fallbackName || 'Usuário';
  return {
    userId,
    name,
    status: isActive ? 'active' : 'inactive',
    badgeLabel: isActive ? '' : 'Inativo',
  };
}
