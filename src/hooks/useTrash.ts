import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import {
  listDeletedItems,
  restoreFromSnapshot,
  restoreMultipleSnapshots,
  permanentlyDeleteSnapshot,
  getTrashStats,
  EntityType,
  DeletedItem,
} from '@/services/supabase/trash';
import { toast } from 'sonner';

interface UseTrashOptions {
  entityType?: EntityType;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useTrash(options: UseTrashOptions = {}) {
  const { profile } = useCurrentUser();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id;

  const queryKey = ['trash', organizationId, options];

  const {
    data: deletedItems = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => listDeletedItems(organizationId!, options),
    enabled: !!organizationId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Refetch when component mounts
  });

  const {
    data: stats,
    isLoading: isLoadingStats,
  } = useQuery({
    queryKey: ['trash-stats', organizationId],
    queryFn: () => getTrashStats(organizationId!),
    enabled: !!organizationId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const restoreMutation = useMutation({
    mutationFn: restoreFromSnapshot,
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Item restaurado com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['trash'] });
        queryClient.invalidateQueries({ queryKey: ['trash-stats'] });
        // Invalidate the entity queries
        if (result.entityType) {
          queryClient.invalidateQueries({ queryKey: [result.entityType] });
        }
      } else {
        toast.error(`Erro ao restaurar: ${result.error}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao restaurar: ${error.message}`);
    },
  });

  const restoreMultipleMutation = useMutation({
    mutationFn: restoreMultipleSnapshots,
    onSuccess: (result) => {
      if (result.successCount > 0) {
        toast.success(`${result.successCount} item(s) restaurado(s) com sucesso!`);
      }
      if (result.failCount > 0) {
        toast.error(`${result.failCount} item(s) falharam ao restaurar.`);
      }
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['trash-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao restaurar itens: ${error.message}`);
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: permanentlyDeleteSnapshot,
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Item excluído permanentemente.');
        queryClient.invalidateQueries({ queryKey: ['trash'] });
        queryClient.invalidateQueries({ queryKey: ['trash-stats'] });
      } else {
        toast.error(`Erro ao excluir: ${result.error}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  return {
    deletedItems,
    isLoading,
    error,
    stats,
    isLoadingStats,
    refetch,
    restore: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
    restoreMultiple: restoreMultipleMutation.mutate,
    isRestoringMultiple: restoreMultipleMutation.isPending,
    permanentDelete: permanentDeleteMutation.mutate,
    isPermanentlyDeleting: permanentDeleteMutation.isPending,
  };
}

export type { DeletedItem, EntityType };
