import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useUserRole } from './useUserRole';

interface TeamVisibility {
  /** Se true, o usuário pode ver todos os dados (admin/owner) */
  canViewAll: boolean;
  /** Se true, o usuário é gestor de time */
  isTeamManager: boolean;
  /** Array de user_ids que o usuário pode visualizar (null = sem filtro) */
  visibleUserIds: string[] | null;
  /** ID do usuário atual */
  currentUserId: string | undefined;
  /** Loading state */
  loading: boolean;
  /** 
   * Aplica o filtro de visibilidade em uma query do Supabase
   * Usa o campo owner_user_id por padrão
   */
  applyVisibilityFilter: <T extends { in: (column: string, values: string[]) => T }>(
    query: T,
    column?: string
  ) => T;
  /**
   * Retorna objeto de filtro para queries manuais
   * { owner_user_id: userId } para vendedor
   * {} para admin/manager sem time
   */
  getVisibilityFilter: () => Record<string, string | undefined>;
}

/**
 * Hook para controlar visibilidade de dados baseado na hierarquia de times.
 * 
 * Hierarquia:
 * - Admin/Owner: Veem todos os dados da organização
 * - Manager com time: Veem dados dos membros do seu time + próprios dados
 * - Manager sem time: Veem todos os dados (fallback de compatibilidade)
 * - Sales/outros: Veem apenas seus próprios dados (owner_user_id = user.id)
 */
export function useTeamVisibility(): TeamVisibility {
  const { user } = useSupabaseAuth();
  const { isAdmin, isManager } = useUserRole();
  const [visibleUserIds, setVisibleUserIds] = useState<string[] | null>(null);
  const [isTeamManager, setIsTeamManager] = useState(false);
  const [canViewAll, setCanViewAll] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user can view all (owner, admin, finance) via organization_members
  useEffect(() => {
    const checkCanViewAll = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('organization_members')
        .select('org_role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
      
      // Owner, admin, and finance can view all data
      const role = data?.org_role;
      setCanViewAll(role === 'owner' || role === 'admin' || role === 'finance');
    };
    
    checkCanViewAll();
  }, [user?.id]);

  useEffect(() => {
    const fetchVisibility = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      // Admin/Owner não precisa de filtro
      if (canViewAll) {
        setVisibleUserIds(null);
        setIsTeamManager(false);
        setLoading(false);
        return;
      }

      try {
        // Buscar IDs visíveis via função SQL
        const { data, error } = await supabase.rpc('get_visible_user_ids', {
          _user_id: user.id
        });

        if (error) {
          console.error('Error fetching visibility:', error);
          // Fallback: apenas próprios dados
          setVisibleUserIds([user.id]);
          setLoading(false);
          return;
        }

        // NULL = sem filtro (admin/manager sem time)
        // Array = lista de IDs visíveis
        setVisibleUserIds(data);

        // Verificar se é gestor de time
        const { data: isManagerData } = await supabase.rpc('is_team_manager', {
          _user_id: user.id
        });
        setIsTeamManager(!!isManagerData);

      } catch (err) {
        console.error('Error in useTeamVisibility:', err);
        // Fallback seguro: apenas próprios dados
        setVisibleUserIds([user.id]);
      } finally {
        setLoading(false);
      }
    };

    fetchVisibility();
  }, [user?.id, canViewAll]);

  /**
   * Aplica filtro de visibilidade em query do Supabase
   */
  const applyVisibilityFilter = useCallback(<T extends { in: (column: string, values: string[]) => T }>(
    query: T,
    column: string = 'owner_user_id'
  ): T => {
    // Sem filtro = vê tudo
    if (visibleUserIds === null) {
      return query;
    }

    // Aplicar filtro de IDs
    if (visibleUserIds.length > 0) {
      return query.in(column, visibleUserIds);
    }

    // Array vazio = sem acesso (não deveria acontecer)
    return query.in(column, ['00000000-0000-0000-0000-000000000000']);
  }, [visibleUserIds]);

  /**
   * Retorna objeto de filtro para queries manuais
   */
  const getVisibilityFilter = useCallback((): Record<string, string | undefined> => {
    // Sem filtro = vê tudo
    if (visibleUserIds === null) {
      return {};
    }

    // Se só tem 1 ID (próprio usuário), usa filtro simples
    if (visibleUserIds.length === 1) {
      return { owner_user_id: visibleUserIds[0] };
    }

    // Para múltiplos IDs, não pode usar filtro simples de objeto
    // O chamador deve usar applyVisibilityFilter ou lógica customizada
    return {};
  }, [visibleUserIds]);

  return {
    canViewAll,
    isTeamManager,
    visibleUserIds,
    currentUserId: user?.id,
    loading,
    applyVisibilityFilter,
    getVisibilityFilter,
  };
}
