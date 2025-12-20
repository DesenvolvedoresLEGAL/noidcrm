import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listAllDeletedItems, getAdminTrashStats, AdminDeletedItem } from '@/services/supabase/adminTrash';
import { restoreFromSnapshot, restoreMultipleSnapshots, permanentlyDeleteSnapshot, EntityType } from '@/services/supabase/trash';

interface UseAdminTrashOptions {
  organizationId?: string;
  entityType?: EntityType;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useAdminTrash(options?: UseAdminTrashOptions) {
  const queryClient = useQueryClient();

  const {
    data: deletedItems = [],
    isLoading: isLoadingItems,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['admin-trash-items', options],
    queryFn: () => listAllDeletedItems({
      organizationId: options?.organizationId,
      entityType: options?.entityType,
      search: options?.search,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
    }),
  });

  const {
    data: stats,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['admin-trash-stats'],
    queryFn: getAdminTrashStats,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreFromSnapshot,
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Item restaurado com sucesso');
        queryClient.invalidateQueries({ queryKey: ['admin-trash-items'] });
        queryClient.invalidateQueries({ queryKey: ['admin-trash-stats'] });
      } else {
        toast.error(`Erro ao restaurar: ${result.error}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao restaurar item: ${error.message}`);
    },
  });

  const restoreMultipleMutation = useMutation({
    mutationFn: restoreMultipleSnapshots,
    onSuccess: (result) => {
      if (result.successCount > 0) {
        toast.success(`${result.successCount} item(ns) restaurado(s) com sucesso`);
      }
      if (result.failCount > 0) {
        toast.error(`${result.failCount} item(ns) falharam ao restaurar`);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-trash-items'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trash-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao restaurar itens: ${error.message}`);
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: permanentlyDeleteSnapshot,
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Item excluído permanentemente');
        queryClient.invalidateQueries({ queryKey: ['admin-trash-items'] });
        queryClient.invalidateQueries({ queryKey: ['admin-trash-stats'] });
      } else {
        toast.error(`Erro ao excluir: ${result.error}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir item: ${error.message}`);
    },
  });

  return {
    deletedItems,
    stats,
    isLoadingItems,
    isLoadingStats,
    itemsError,
    refetchItems,
    refetchStats,
    restore: restoreMutation.mutate,
    restoreMultiple: restoreMultipleMutation.mutate,
    permanentDelete: permanentDeleteMutation.mutate,
    isRestoring: restoreMutation.isPending || restoreMultipleMutation.isPending,
    isDeleting: permanentDeleteMutation.isPending,
  };
}

export type { AdminDeletedItem };
