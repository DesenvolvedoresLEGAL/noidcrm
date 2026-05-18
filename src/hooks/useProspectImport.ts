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
  email_payload?: {
    subject: string;
    body: string;
    to: string;
    opportunity_id: string;
    account_id: string;
    contact_id: string | null;
    organization_id: string;
  } | null;
}

export function hasMinimumIdentity(p: Prospect): boolean {
  return !!(p as any).cnpj || !!p.normalized_domain || !!p.website;
}

function needsCompanyEnrichment(p: Prospect): boolean {
  const anyP = p as any;
  return !!anyP.cnpj && (!anyP.cnae_code || !anyP.endereco || !anyP.cep);
}

async function enrichIfNeeded(prospect: Prospect): Promise<void> {
  if (!needsCompanyEnrichment(prospect)) return;
  try {
    await supabase.functions.invoke('enrich-prospect-identity', {
      body: { prospect_id: prospect.id },
    });
  } catch (err) {
    console.warn('[import] enrichment failed, proceeding anyway', err);
  }
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

async function dispatchInitialEmail(payload: ImportResult['email_payload']): Promise<{ sent: boolean; draft: boolean } | null> {
  if (!payload) return null;
  try {
    const { data, error } = await supabase.functions.invoke('send-kairos-initial-email', {
      body: payload,
    });
    if (error) throw error;
    return data as { sent: boolean; draft: boolean };
  } catch (err) {
    console.warn('[import] email dispatch failed', err);
    return null;
  }
}

export function useImportProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospect: Prospect) => {
      if (prospect.relationship_status === 'customer') {
        throw new Error('Esta empresa já é cliente — abra a conta existente em vez de importar.');
      }
      if (!hasMinimumIdentity(prospect)) {
        throw new Error('Prospect sem identidade mínima (CNPJ ou domínio). Enriqueça antes de importar.');
      }
      await enrichIfNeeded(prospect);
      const result = await importViaRpc(prospect.id, 'qualification');
      const emailResult = await dispatchInitialEmail(result.email_payload);
      return { result, emailResult };
    },
    onSuccess: ({ result, emailResult }) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      const base = result.account_created
        ? 'Importado: conta e oportunidade criadas no PRÉ VENDAS'
        : 'Importado: oportunidade criada na conta existente';
      const emailMsg = emailResult?.sent
        ? ' · ✉️ E-mail inicial disparado via SMTP'
        : emailResult?.draft
          ? ' · ✉️ E-mail inicial salvo como rascunho (configure SMTP para envio automático)'
          : '';
      toast.success(base + emailMsg);
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
      let emailsSent = 0;
      let emailsDrafted = 0;
      let skippedNoIdentity = 0;
      let errors = 0;

      for (const prospect of prospects) {
        if (!hasMinimumIdentity(prospect)) {
          skippedNoIdentity++;
          continue;
        }
        try {
          await enrichIfNeeded(prospect);
          const result = await importViaRpc(prospect.id, 'qualification');
          if (result.account_created) accountsCreated++;
          opportunitiesCreated++;
          const emailResult = await dispatchInitialEmail(result.email_payload);
          if (emailResult?.sent) emailsSent++;
          else if (emailResult?.draft) emailsDrafted++;
        } catch (err) {
          console.error('Bulk import error for', prospect.id, err);
          errors++;
        }
      }

      return { accountsCreated, opportunitiesCreated, emailsSent, emailsDrafted, skippedNoIdentity, errors, total: prospects.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      const parts = [`${result.opportunitiesCreated} importados`];
      if (result.accountsCreated > 0) parts.push(`${result.accountsCreated} contas criadas`);
      if (result.emailsSent > 0) parts.push(`${result.emailsSent} e-mails enviados`);
      if (result.emailsDrafted > 0) parts.push(`${result.emailsDrafted} rascunhos`);
      if (result.skippedNoIdentity > 0) parts.push(`${result.skippedNoIdentity} sem identidade`);
      if (result.errors > 0) parts.push(`${result.errors} erros`);
      toast.success(parts.join(' · '));
    },
    onError: () => {
      toast.error('Erro ao importar prospects');
    },
  });
}
