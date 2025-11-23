import { useUserRole } from './useUserRole';
import { useSupabaseAuth } from './useSupabaseAuth';

/**
 * Hook para controlar visibilidade de dados baseado no role do usuário.
 * 
 * Admin/Manager: Veem todos os dados da organização
 * Sales: Veem apenas seus próprios dados (owner_user_id = user.id)
 */
export function useDataVisibility() {
  const { isAdmin, isManager } = useUserRole();
  const { user } = useSupabaseAuth();
  
  // Admin e Manager podem ver tudo
  const canViewAll = isAdmin || isManager;
  
  /**
   * Retorna filtros de visibilidade para queries do Supabase.
   * - Se admin/manager: retorna {} (sem filtro, vê tudo)
   * - Se sales: retorna { owner_user_id: user.id } (filtra por owner)
   */
  const getVisibilityFilter = () => {
    if (canViewAll) {
      return {}; // Sem filtro - vê tudo da organização
    }
    return { owner_user_id: user?.id }; // Filtra por owner (apenas seus registros)
  };
  
  return { 
    canViewAll, 
    getVisibilityFilter,
    currentUserId: user?.id,
  };
}
