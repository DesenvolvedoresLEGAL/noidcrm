import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface SecureDeleteOptions {
  entityType: string;
  onDelete: (ids: string[]) => Promise<void>;
  onSuccess?: () => void;
  threshold?: number; // Number of items that triggers enhanced confirmation
}

interface DeleteState {
  isDialogOpen: boolean;
  itemsToDelete: string[];
  itemTitles: string[];
  isDeleting: boolean;
}

export function useSecureDelete({
  entityType,
  onDelete,
  onSuccess,
  threshold = 5,
}: SecureDeleteOptions) {
  const [state, setState] = useState<DeleteState>({
    isDialogOpen: false,
    itemsToDelete: [],
    itemTitles: [],
    isDeleting: false,
  });

  const requestDelete = useCallback((ids: string[], titles?: string[]) => {
    if (ids.length === 0) {
      toast.warning('Nenhum item selecionado para exclusão');
      return;
    }

    setState({
      isDialogOpen: true,
      itemsToDelete: ids,
      itemTitles: titles || [],
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (state.itemsToDelete.length === 0) return;

    setState((prev) => ({ ...prev, isDeleting: true }));

    try {
      await onDelete(state.itemsToDelete);
      
      toast.success(
        state.itemsToDelete.length === 1
          ? `${entityType} excluído com sucesso`
          : `${state.itemsToDelete.length} ${entityType}s excluídos com sucesso`
      );

      setState({
        isDialogOpen: false,
        itemsToDelete: [],
        itemTitles: [],
        isDeleting: false,
      });

      onSuccess?.();
    } catch (error: any) {
      console.error('Error deleting items:', error);
      
      // Check for rate limit error
      if (error.message?.includes('Rate limit')) {
        toast.error('Limite de exclusões atingido', {
          description: 'Aguarde alguns minutos antes de excluir mais itens.',
        });
      } else {
        toast.error('Erro ao excluir', {
          description: error.message || 'Tente novamente mais tarde',
        });
      }

      setState((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [state.itemsToDelete, entityType, onDelete, onSuccess]);

  const cancelDelete = useCallback(() => {
    setState({
      isDialogOpen: false,
      itemsToDelete: [],
      itemTitles: [],
      isDeleting: false,
    });
  }, []);

  const isMassDeletion = state.itemsToDelete.length >= threshold;

  return {
    isDialogOpen: state.isDialogOpen,
    itemCount: state.itemsToDelete.length,
    itemTitles: state.itemTitles,
    isDeleting: state.isDeleting,
    isMassDeletion,
    requestDelete,
    confirmDelete,
    cancelDelete,
    setDialogOpen: (open: boolean) => {
      if (!open) {
        cancelDelete();
      }
    },
  };
}
