import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { toast } from 'sonner';
import type { Prospect } from '@/hooks/useLeadSourcingV2';
import { opportunityKeys, accountKeys, contactKeys } from '@/lib/query-keys';

interface ImportResult {
  accountId: string;
  accountCreated: boolean;
  contactId: string | null;
  opportunityId: string;
}

async function importSingleProspect(
  prospect: Prospect,
  organizationId: string,
  userId: string,
): Promise<ImportResult> {
  const now = new Date().toISOString();
  let accountId: string;
  let accountCreated = false;

  // 1. Dedupe: use existing account or create new
  if (prospect.dedupe_status === 'strong_match' && prospect.matched_account_id) {
    accountId = prospect.matched_account_id;
  } else {
    const { data: newAccount, error: accErr } = await supabase
      .from('accounts')
      .insert({
        organization_id: organizationId,
        razao_social: prospect.company_name,
        nome_fantasia: prospect.company_name,
        website: prospect.normalized_domain ? `https://${prospect.normalized_domain}` : prospect.website,
        cidade: prospect.city,
        uf: prospect.state,
        segmento: prospect.industry,
        origem_principal: 'lead_sourcing',
        tipo_pessoa: 'PJ' as const,
        created_by: userId,
      })
      .select('id')
      .single();
    if (accErr) throw accErr;
    accountId = newAccount.id;
    accountCreated = true;
  }

  // 2. Create contact if public data available
  let contactId: string | null = null;
  if (prospect.email_public || prospect.phone_public) {
    const emails = prospect.email_public
      ? [{ value: prospect.email_public, type: 'work' as const, is_primary: true }]
      : [];
    const telefones = prospect.phone_public
      ? [{ value: prospect.phone_public, type: 'mobile' as const, is_primary: true }]
      : [];

    const { data: newContact, error: contErr } = await supabase
      .from('contacts')
      .insert({
        organization_id: organizationId,
        account_id: accountId,
        nome: prospect.company_name,
        primeiro_nome: prospect.company_name,
        emails,
        telefones,
      })
      .select('id')
      .single();
    if (contErr) {
      console.warn('Contact creation failed, continuing:', contErr);
    } else {
      contactId = newContact.id;
    }
  }

  // 3. Build scores and signals
  const score = prospect.prospect_scores?.[0];
  const priorityScore = score?.priority_score ?? 0;
  const reasoning = score?.reasoning as any;
  const signals: string[] = reasoning?.signals || [];

  const sourceMetadata = {
    source: 'lead_sourcing',
    playbook_run_id: prospect.playbook_run_id,
    prospect_id: prospect.id,
    priority_score: priorityScore,
    signals,
    import_timestamp: now,
  };

  // 4. Create opportunity
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .insert({
      organization_id: organizationId,
      account_id: accountId,
      contact_id: contactId,
      title: prospect.company_name,
      origem: 'lead_sourcing',
      status: 'open',
      playbook_run_id: prospect.playbook_run_id,
      prospect_id: prospect.id,
      priority_score: priorityScore,
      source_metadata: sourceMetadata,
    })
    .select('id')
    .single();
  if (oppErr) throw oppErr;

  // 5. Update prospect status
  await supabase
    .from('prospects')
    .update({
      approval_status: 'imported',
      status: 'converted',
      approved_by: userId,
      approved_at: now,
      matched_account_id: accountId,
    })
    .eq('id', prospect.id);

  return {
    accountId,
    accountCreated,
    contactId,
    opportunityId: opp.id,
  };
}

export function useImportProspect() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (prospect: Prospect) => {
      if (!organization?.id) throw new Error('No organization');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      return importSingleProspect(prospect, organization.id, user.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      toast.success(
        result.accountCreated
          ? 'Prospect importado: conta e oportunidade criadas'
          : 'Prospect importado: oportunidade criada na conta existente'
      );
    },
    onError: (error) => {
      console.error('Import error:', error);
      toast.error('Erro ao importar prospect no CRM');
    },
  });
}

export function useBulkImportProspects() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (prospects: Prospect[]) => {
      if (!organization?.id) throw new Error('No organization');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let accountsCreated = 0;
      let opportunitiesCreated = 0;
      let errors = 0;

      for (const prospect of prospects) {
        try {
          const result = await importSingleProspect(prospect, organization.id, user.id);
          if (result.accountCreated) accountsCreated++;
          opportunitiesCreated++;
        } catch (err) {
          console.error('Bulk import error for', prospect.id, err);
          errors++;
        }
      }

      return { accountsCreated, opportunitiesCreated, errors, total: prospects.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      const parts = [`${result.opportunitiesCreated} importados`];
      if (result.accountsCreated > 0) parts.push(`${result.accountsCreated} contas criadas`);
      if (result.errors > 0) parts.push(`${result.errors} erros`);
      toast.success(parts.join(', '));
    },
    onError: () => {
      toast.error('Erro ao importar prospects');
    },
  });
}
