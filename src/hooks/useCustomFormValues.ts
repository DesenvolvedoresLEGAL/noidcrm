import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CustomFormValues {
  id: string;
  organization_id: string;
  custom_form_id: string;
  entity_id: string;
  entity_type: string;
  values: Record<string, any>;
  filled_by: string | null;
  filled_at: string;
  updated_at: string;
}

export function useCustomFormValues(formId: string | undefined, entityId: string | undefined) {
  return useQuery({
    queryKey: ['custom-form-values', formId, entityId],
    queryFn: async () => {
      if (!formId || !entityId) return null;

      const { data, error } = await supabase
        .from('custom_form_values')
        .select('*')
        .eq('custom_form_id', formId)
        .eq('entity_id', entityId)
        .maybeSingle();

      if (error) throw error;
      return data as CustomFormValues | null;
    },
    enabled: !!formId && !!entityId,
  });
}

export function useCustomFormValueMutations() {
  const queryClient = useQueryClient();

  const saveValues = useMutation({
    mutationFn: async ({
      formId,
      entityId,
      entityType,
      values,
    }: {
      formId: string;
      entityId: string;
      entityType: string;
      values: Record<string, any>;
    }) => {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) throw new Error('No organization found');

      const { data: user } = await supabase.auth.getUser();

      // Upsert the values
      const { data, error } = await supabase
        .from('custom_form_values')
        .upsert(
          {
            custom_form_id: formId,
            entity_id: entityId,
            entity_type: entityType,
            organization_id: orgId,
            values,
            filled_by: user.user?.id,
            filled_at: new Date().toISOString(),
          },
          {
            onConflict: 'custom_form_id,entity_id',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['custom-form-values', variables.formId, variables.entityId] 
      });
      toast.success('Formulário salvo com sucesso');
    },
    onError: (error) => {
      console.error('Error saving form values:', error);
      toast.error('Erro ao salvar formulário');
    },
  });

  return {
    saveValues,
    isSaving: saveValues.isPending,
  };
}
