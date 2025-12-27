import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';

interface OpportunityPublicForm {
  id: string;
  opportunity_id: string;
  form_id: string;
  organization_id: string;
  is_enabled: boolean;
  public_token: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useOpportunityPublicForms(opportunityId: string | undefined) {
  const { organization } = useCurrentUser();

  return useQuery({
    queryKey: ['opportunity-public-forms', opportunityId],
    queryFn: async () => {
      if (!opportunityId || !organization?.id) return [];

      const { data, error } = await supabase
        .from('opportunity_public_forms')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .eq('organization_id', organization.id);

      if (error) throw error;
      return (data || []) as OpportunityPublicForm[];
    },
    enabled: !!opportunityId && !!organization?.id,
  });
}

export function useOpportunityPublicFormMutations() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentUser();

  const togglePublicForm = useMutation({
    mutationFn: async ({
      opportunityId,
      formId,
      isEnabled,
    }: {
      opportunityId: string;
      formId: string;
      isEnabled: boolean;
    }) => {
      if (!organization?.id) throw new Error('Organização não encontrada');

      // Check if record exists
      const { data: existing } = await supabase
        .from('opportunity_public_forms')
        .select('id, public_token')
        .eq('opportunity_id', opportunityId)
        .eq('form_id', formId)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('opportunity_public_forms')
          .update({ 
            is_enabled: isEnabled,
            public_token: isEnabled && !existing.public_token 
              ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) 
              : existing.public_token,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new
        const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const { error } = await supabase
          .from('opportunity_public_forms')
          .insert({
            opportunity_id: opportunityId,
            form_id: formId,
            organization_id: organization.id,
            is_enabled: isEnabled,
            public_token: isEnabled ? token : null,
          });

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['opportunity-public-forms', variables.opportunityId] 
      });
      toast.success(variables.isEnabled 
        ? 'Link público habilitado' 
        : 'Link público desabilitado'
      );
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar formulário: ' + error.message);
    },
  });

  return {
    togglePublicForm,
    isToggling: togglePublicForm.isPending,
  };
}
