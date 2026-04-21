import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  ingestLead, 
  ingestLeadsBulk, 
  LeadIngestionData, 
  LeadIngestionResult 
} from '@/services/crm/lead-ingestion';
import { useCurrentUser } from './useCurrentUser';
import { opportunityKeys, accountKeys, contactKeys } from '@/lib/query-keys';

export function useIngestLead() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentUser();

  return useMutation({
    mutationFn: async (lead: LeadIngestionData): Promise<LeadIngestionResult> => {
      if (!organization?.id) {
        throw new Error('Organization not found');
      }
      return ingestLead(lead, organization.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      toast.success(`Lead criado com grade ${result.lead_grade}`, {
        description: `Atribuído ao vendedor e pipeline ${result.pipeline_type}`,
      });
    },
    onError: (error) => {
      toast.error('Erro ao processar lead', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    },
  });
}

export function useIngestLeadsBulk() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ 
      leads, 
      onProgress 
    }: { 
      leads: LeadIngestionData[]; 
      onProgress?: (current: number, total: number) => void;
    }) => {
      if (!organization?.id) {
        throw new Error('Organization not found');
      }
      return ingestLeadsBulk(leads, organization.id, onProgress);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      
      toast.success(`${result.success.length} leads processados`, {
        description: result.failed.length > 0 
          ? `${result.failed.length} falharam` 
          : 'Todos os leads foram criados com sucesso',
      });
    },
    onError: (error) => {
      toast.error('Erro no processamento em lote', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    },
  });
}
