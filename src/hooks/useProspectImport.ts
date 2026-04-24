import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Prospect } from '@/hooks/useLeadSourcingV2';
import { opportunityKeys, accountKeys, contactKeys } from '@/lib/query-keys';

export interface ImportResult {
  account_id: string;
  account_created: boolean;
  contact_id: string | null;
  opportunity_id: string;
  pipeline_id: string;
  stage_id: string;
}

/** Considera-se identidade mínima quando há CNPJ OU domínio normalizado. */
export function hasMinimumIdentity(p: Prospect): boolean {
  return !!(p as any).cnpj || !!p.normalized_domain || !!p.website;
}

async function importViaRpc(
  prospectId: string,
  targetPipelineType: 'qualification' | 'sales' = 'qualification',
): Promise<ImportResult> {
  const { data, error } = await supabase.rpc('import_prospect_to_pipeline', {
    p_prospect_id: prospectId,
    p_target_pipeline_type: targetPipelineType,
  });
  if (error) throw error;
  return data as unknown as ImportResult;
}

export function useImportProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospect: Prospect) => {
      if (!hasMinimumIdentity(prospect)) {
        throw new Error('Prospect sem identidade mínima (CNPJ ou domínio). Enriqueça antes de importar.');
      }
      return importViaRpc(prospect.id, 'qualification');
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      toast.success(
        result.account_created
          ? 'Importado: conta e oportunidade criadas no PRÉ VENDAS'
          : 'Importado: oportunidade criada na conta existente',
      );
    },
    onError: (error: Error) => {
      console.error('Import error:', error);
      toast.error(error.message || 'Erro ao importar prospect no CRM');
    },
  });
}

export function useBulkImportProspects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospects: Prospect[]) => {
      let accountsCreated = 0;
      let opportunitiesCreated = 0;
      let skippedNoIdentity = 0;
      let errors = 0;

      for (const prospect of prospects) {
        if (!hasMinimumIdentity(prospect)) {
          skippedNoIdentity++;
          continue;
        }
        try {
          const result = await importViaRpc(prospect.id, 'qualification');
          if (result.account_created) accountsCreated++;
          opportunitiesCreated++;
        } catch (err) {
          console.error('Bulk import error for', prospect.id, err);
          errors++;
        }
      }

      return { accountsCreated, opportunitiesCreated, skippedNoIdentity, errors, total: prospects.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      const parts = [`${result.opportunitiesCreated} importados`];
      if (result.accountsCreated > 0) parts.push(`${result.accountsCreated} contas criadas`);
      if (result.skippedNoIdentity > 0) parts.push(`${result.skippedNoIdentity} sem identidade (enriqueça primeiro)`);
      if (result.errors > 0) parts.push(`${result.errors} erros`);
      toast.success(parts.join(' · '));
    },
    onError: () => {
      toast.error('Erro ao importar prospects');
    },
  });
}
