import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Prospect } from '@/hooks/useLeadSourcingV2';

export interface ImportResult {
  account_id: string;
  account_created: boolean;
  contact_id: string | null;
  opportunity_id: string;
  pipeline_id: string;
  stage_id: string;
  email_payload?: unknown;
}

export function hasMinimumIdentity(p: Prospect): boolean {
  return !!(p as any).cnpj || !!p.normalized_domain || !!p.website;
}

async function enqueue(prospectId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('kairos-enqueue-prospect', {
    body: { prospect_id: prospectId },
  });
  if (error) throw error;
}

/**
 * KAI.13: importação direta ao CRM foi substituída pela Qualified Queue.
 * Esta hook agora envia o prospect para a fila de triagem. A promoção ao CRM
 * acontece a partir da fila (Kairós > Qualified Queue) via `kairos-promote-to-crm`.
 */
export function useImportProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospect: Prospect) => {
      if (prospect.relationship_status === 'customer') {
        throw new Error('Esta empresa já é cliente — abra a conta existente em vez de importar.');
      }
      if (!hasMinimumIdentity(prospect)) {
        throw new Error('Prospect sem identidade mínima (CNPJ ou domínio). Enriqueça antes de enviar para a fila.');
      }
      await enqueue(prospect.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['kairos-qualified-queue'] });
      queryClient.invalidateQueries({ queryKey: ['kairos-qualified-queue-kpis'] });
      toast.success('Enviado para Qualified Queue · Promova ao CRM em Kairós > Qualified Queue');
    },
    onError: (error: Error) => {
      console.error('Enqueue error:', error);
      toast.error(error.message || 'Erro ao enviar para a fila');
    },
  });
}

export function useBulkImportProspects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospects: Prospect[]) => {
      let enqueued = 0;
      let skippedCustomers = 0;
      let skippedNoIdentity = 0;
      let errors = 0;

      for (const prospect of prospects) {
        if (prospect.relationship_status === 'customer') { skippedCustomers++; continue; }
        if (!hasMinimumIdentity(prospect)) { skippedNoIdentity++; continue; }
        try {
          await enqueue(prospect.id);
          enqueued++;
        } catch (err) {
          console.error('Bulk enqueue error for', prospect.id, err);
          errors++;
        }
      }
      return { enqueued, skippedCustomers, skippedNoIdentity, errors, total: prospects.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['kairos-qualified-queue'] });
      queryClient.invalidateQueries({ queryKey: ['kairos-qualified-queue-kpis'] });
      const parts = [`${result.enqueued} na fila`];
      if (result.skippedCustomers > 0) parts.push(`${result.skippedCustomers} já são clientes`);
      if (result.skippedNoIdentity > 0) parts.push(`${result.skippedNoIdentity} sem identidade`);
      if (result.errors > 0) parts.push(`${result.errors} erros`);
      toast.success(parts.join(' · ') + ' · Promova ao CRM em Kairós > Qualified Queue');
    },
    onError: () => {
      toast.error('Erro ao enviar prospects para a fila');
    },
  });
}
