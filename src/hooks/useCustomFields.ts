import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCustomFields,
  listCustomFieldGroups,
  getCustomFieldValues,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  createCustomFieldGroup,
  updateCustomFieldGroup,
  deleteCustomFieldGroup,
  saveCustomFieldValue,
  saveMultipleCustomFieldValues,
  reorderCustomFields,
  type CustomField,
  type CustomFieldGroup,
  type CustomFieldValue,
  type EntityType,
} from '@/services/crm/custom-fields';
import { toast } from 'sonner';

// Custom field keys (kept local — only used in this hook).
const customFieldKeys = {
  all: () => ['custom-fields'] as const,
  byEntity: (entityType?: EntityType) => ['custom-fields', entityType] as const,
  groups: (entityType?: EntityType) => ['custom-field-groups', entityType] as const,
  groupsAll: () => ['custom-field-groups'] as const,
  values: (entityId: string | undefined, entityType: EntityType) =>
    ['custom-field-values', entityId, entityType] as const,
};

// Hook for listing custom fields
export function useCustomFields(entityType?: EntityType) {
  return useQuery({
    queryKey: customFieldKeys.byEntity(entityType),
    queryFn: () => listCustomFields(entityType),
  });
}

// Hook for listing custom field groups
export function useCustomFieldGroups(entityType?: EntityType) {
  return useQuery({
    queryKey: customFieldKeys.groups(entityType),
    queryFn: () => listCustomFieldGroups(entityType),
  });
}

// Hook for getting custom field values for an entity
export function useCustomFieldValues(entityId: string | undefined, entityType: EntityType) {
  return useQuery({
    queryKey: customFieldKeys.values(entityId, entityType),
    queryFn: () => getCustomFieldValues(entityId!, entityType),
    enabled: !!entityId,
  });
}

// Hook for custom field mutations
export function useCustomFieldMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createCustomField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.all() });
      toast.success('Campo criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar campo: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CustomField> }) =>
      updateCustomField(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.all() });
      toast.success('Campo atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar campo: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.all() });
      toast.success('Campo excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir campo: ${error.message}`);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderCustomFields,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.all() });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reordenar campos: ${error.message}`);
    },
  });

  return {
    createField: createMutation.mutateAsync,
    updateField: updateMutation.mutateAsync,
    deleteField: deleteMutation.mutateAsync,
    reorderFields: reorderMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Hook for custom field group mutations
export function useCustomFieldGroupMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createCustomFieldGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.groupsAll() });
      toast.success('Grupo criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar grupo: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CustomFieldGroup> }) =>
      updateCustomFieldGroup(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.groupsAll() });
      toast.success('Grupo atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar grupo: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomFieldGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.groupsAll() });
      toast.success('Grupo excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir grupo: ${error.message}`);
    },
  });

  return {
    createGroup: createMutation.mutateAsync,
    updateGroup: updateMutation.mutateAsync,
    deleteGroup: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Hook for saving custom field values
export function useCustomFieldValueMutations() {
  const queryClient = useQueryClient();

  const saveSingleMutation = useMutation({
    mutationFn: ({
      customFieldId,
      entityId,
      entityType,
      value,
    }: {
      customFieldId: string;
      entityId: string;
      entityType: EntityType;
      value: any;
    }) => saveCustomFieldValue(customFieldId, entityId, entityType, value),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: customFieldKeys.values(variables.entityId, variables.entityType),
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar valor: ${error.message}`);
    },
  });

  const saveMultipleMutation = useMutation({
    mutationFn: ({
      entityId,
      entityType,
      values,
    }: {
      entityId: string;
      entityType: EntityType;
      values: Record<string, any>;
    }) => saveMultipleCustomFieldValues(entityId, entityType, values),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: customFieldKeys.values(variables.entityId, variables.entityType),
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar valores: ${error.message}`);
    },
  });

  return {
    saveValue: saveSingleMutation.mutateAsync,
    saveMultipleValues: saveMultipleMutation.mutateAsync,
    isSaving: saveSingleMutation.isPending || saveMultipleMutation.isPending,
  };
}

// Hook to get fields filtered by location
export function useCustomFieldsByLocation(entityType: EntityType, location: string) {
  const { data: fields, ...rest } = useCustomFields(entityType);

  const filteredFields = fields?.filter((field) => {
    const config = field.visibility_config;
    return config?.locations?.includes(location) && field.is_active;
  });

  return {
    data: filteredFields,
    ...rest,
  };
}
