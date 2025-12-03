import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listDynamicVariables,
  getVariablesByCategory,
  createDynamicVariable,
  updateDynamicVariable,
  deleteDynamicVariable,
  replaceAllVariables,
  resolveVariable,
  type DynamicVariable,
  type VariableContext,
} from '@/services/crm/dynamic-variables';
import { toast } from 'sonner';
import { useMemo } from 'react';

// Hook for listing all dynamic variables
export function useDynamicVariables() {
  return useQuery({
    queryKey: ['dynamic-variables'],
    queryFn: listDynamicVariables,
  });
}

// Hook for getting variables grouped by category
export function useVariablesByCategory() {
  return useQuery({
    queryKey: ['dynamic-variables-by-category'],
    queryFn: getVariablesByCategory,
  });
}

// Hook for dynamic variable mutations
export function useDynamicVariableMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createDynamicVariable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-variables'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-variables-by-category'] });
      toast.success('Variável criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar variável: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DynamicVariable> }) =>
      updateDynamicVariable(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-variables'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-variables-by-category'] });
      toast.success('Variável atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar variável: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDynamicVariable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-variables'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-variables-by-category'] });
      toast.success('Variável excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir variável: ${error.message}`);
    },
  });

  return {
    createVariable: createMutation.mutateAsync,
    updateVariable: updateMutation.mutateAsync,
    deleteVariable: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Hook to resolve variables in a text
export function useResolveVariables(text: string, context: VariableContext) {
  const resolvedText = useMemo(() => {
    if (!text) return '';
    return replaceAllVariables(text, context);
  }, [text, context]);

  return resolvedText;
}

// Hook to get a single variable value
export function useVariableValue(variableKey: string, context: VariableContext) {
  const value = useMemo(() => {
    return resolveVariable(variableKey, context);
  }, [variableKey, context]);

  return value;
}

// Hook to get preview values for all variables
export function useVariablePreview(context: VariableContext) {
  const { data: variables } = useDynamicVariables();

  const preview = useMemo(() => {
    if (!variables) return {};

    const result: Record<string, string> = {};
    for (const variable of variables) {
      result[variable.variable_key] = resolveVariable(variable.variable_key, context);
    }
    return result;
  }, [variables, context]);

  return preview;
}
