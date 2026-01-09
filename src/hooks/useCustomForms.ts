import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CustomFormField {
  id: string;
  source: 'native' | 'custom';
  field_key: string;
  entity_source: 'opportunity' | 'account' | 'contact';
  is_required: boolean;
  display_order: number;
  label?: string;
  type?: string;
}

export interface CustomForm {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  entity_type: string;
  pipeline_ids: string[];
  activity_type_ids: string[];
  fields: CustomFormField[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  public_token?: string | null;
  public_settings?: Record<string, any>;
}

export function useCustomForms(entityType?: string) {
  return useQuery({
    queryKey: ['custom-forms', entityType],
    queryFn: async () => {
      let query = supabase
        .from('custom_forms')
        .select('*')
        .order('display_order', { ascending: true });

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(form => ({
        ...form,
        fields: (Array.isArray(form.fields) ? form.fields : []) as unknown as CustomFormField[],
        pipeline_ids: form.pipeline_ids || [],
        activity_type_ids: form.activity_type_ids || [],
        is_public: (form as any).is_public || false,
        public_token: (form as any).public_token || null,
        public_settings: (form as any).public_settings || {},
      })) as CustomForm[];
    },
  });
}

export function useCustomFormsByPipeline(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ['custom-forms-by-pipeline', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];

      const { data, error } = await supabase
        .from('custom_forms')
        .select('*')
        .in('entity_type', ['opportunity', 'account'])
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Filter forms that match this pipeline or have no pipeline restriction
      return (data || [])
        .filter(form => {
          const pipelineIds = form.pipeline_ids || [];
          return pipelineIds.length === 0 || pipelineIds.includes(pipelineId);
        })
        .map(form => ({
          ...form,
          fields: (Array.isArray(form.fields) ? form.fields : []) as unknown as CustomFormField[],
          pipeline_ids: form.pipeline_ids || [],
          activity_type_ids: form.activity_type_ids || [],
        })) as CustomForm[];
    },
    enabled: !!pipelineId,
  });
}

export function useCustomFormMutations() {
  const queryClient = useQueryClient();

  const createForm = useMutation({
    mutationFn: async (data: Omit<CustomForm, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) throw new Error('No organization found');

      const { data: result, error } = await supabase
        .from('custom_forms')
        .insert({
          ...data,
          organization_id: orgId,
          fields: data.fields as any,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-forms'] });
      toast.success('Formulário criado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating form:', error);
      toast.error('Erro ao criar formulário');
    },
  });

  const updateForm = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CustomForm> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('custom_forms')
        .update({
          ...data,
          fields: data.fields as any,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-forms'] });
      toast.success('Formulário atualizado com sucesso');
    },
    onError: (error) => {
      console.error('Error updating form:', error);
      toast.error('Erro ao atualizar formulário');
    },
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_forms')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-forms'] });
      toast.success('Formulário excluído com sucesso');
    },
    onError: (error) => {
      console.error('Error deleting form:', error);
      toast.error('Erro ao excluir formulário');
    },
  });

  const duplicateForm = useMutation({
    mutationFn: async (id: string) => {
      const { data: original, error: fetchError } = await supabase
        .from('custom_forms')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) throw new Error('No organization found');

      const { data: result, error } = await supabase
        .from('custom_forms')
        .insert({
          organization_id: orgId,
          name: `${original.name} (Cópia)`,
          description: original.description,
          entity_type: original.entity_type,
          pipeline_ids: original.pipeline_ids,
          activity_type_ids: original.activity_type_ids,
          fields: original.fields,
          is_active: false,
          display_order: original.display_order + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-forms'] });
      toast.success('Formulário duplicado com sucesso');
    },
    onError: (error) => {
      console.error('Error duplicating form:', error);
      toast.error('Erro ao duplicar formulário');
    },
  });

  return {
    createForm,
    updateForm,
    deleteForm,
    duplicateForm,
    isCreating: createForm.isPending,
    isUpdating: updateForm.isPending,
    isDeleting: deleteForm.isPending,
  };
}
