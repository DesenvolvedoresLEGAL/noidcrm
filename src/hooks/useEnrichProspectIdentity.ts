import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useEnrichProspectIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospectId: string) => {
      const { data, error } = await supabase.functions.invoke('enrich-prospect-identity', {
        body: { prospect_id: prospectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        success: boolean;
        updates: Record<string, any>;
        log: any;
        has_minimum_data: boolean;
      };
    },
    onSuccess: (data, prospectId) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['enrichment-run', prospectId] });
      const u = data.updates || {};
      const found: string[] = [];
      if (u.cnpj) found.push('CNPJ');
      if (u.normalized_domain) found.push('site');
      if (u.email_public) found.push('e-mail');
      if (u.phone_public) found.push('telefone');
      toast.success(found.length > 0 ? `Identidade enriquecida: ${found.join(', ')}` : 'Enriquecimento concluído (sem novos dados)');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enriquecer: ${error.message}`);
    },
  });
}
