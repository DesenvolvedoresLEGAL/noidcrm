import { supabase } from '@/integrations/supabase/client';
import { getOpportunity } from './opportunities';
import { getAccount } from './accounts';
import { getContact } from './contacts';
import { getDefaultTemplate, getTemplateById } from './proposal-templates';
import { replaceVariables, VariableContext } from '@/lib/proposalVariables';

export interface AutoFillProposalData {
  title: string;
  client_name: string;
  client_email: string;
  introduction: string;
  terms: string;
  notes: string;
  value: number;
  expires_at: string;
  opportunity_id: string;
  layout_id?: string;
  currency?: string;
}

/**
 * Auto-fills proposal data based on opportunity context
 * Reduces 80% of manual data entry
 */
export async function autoFillProposal(opportunityId: string): Promise<AutoFillProposalData> {
  try {
    // Fetch all required data in parallel
    const [opportunity, defaultTemplate, { data: { user } }] = await Promise.all([
      getOpportunity(opportunityId),
      getDefaultTemplate(),
      supabase.auth.getUser(),
    ]);

    if (!opportunity) {
      throw new Error('Oportunidade não encontrada');
    }

    // Fetch related entities
    const [account, contact] = await Promise.all([
      opportunity.account_id ? getAccount(opportunity.account_id) : Promise.resolve(null),
      (opportunity as any).contact_id ? getContact((opportunity as any).contact_id) : Promise.resolve(null),
    ]);

    // Fetch organization data
    const { data: orgId } = await supabase.rpc('get_user_organization_id');
    const { data: organization } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    // Fetch user profile
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    // Build variable context
    const context: VariableContext = {
      organization: organization || undefined,
      account: account || undefined,
      contact: contact || undefined,
      opportunity,
      proposal: {
        id: '',
        version: 1,
        created_at: new Date().toISOString(),
        expires_at: addDays(new Date(), 30).toISOString(),
        total_amount: opportunity.valor_previsto || 0,
      },
      owner: ownerProfile || undefined,
    };

    // Calculate default expiration using template's validity_days or default to 30
    const validityDays = defaultTemplate?.validity_days || 30;
    const expiresAt = addDays(new Date(), validityDays);

    // Build auto-filled data
    const autoFilledData: AutoFillProposalData = {
      title: `Proposta Comercial - ${account?.razao_social || 'Cliente'}`,
      client_name: contact?.nome || account?.nome_fantasia || account?.razao_social || '',
      client_email: contact?.emails?.[0]?.value || '',
      introduction: defaultTemplate?.introduction 
        ? replaceVariables(defaultTemplate.introduction, context)
        : '',
      terms: defaultTemplate?.terms 
        ? replaceVariables(defaultTemplate.terms, context)
        : '',
      notes: defaultTemplate?.notes || '',
      value: opportunity.valor_previsto || 0,
      expires_at: expiresAt.toISOString().split('T')[0],
      opportunity_id: opportunityId,
      // Use template's layout_id (not template.id)
      layout_id: defaultTemplate?.layout_id || undefined,
      currency: defaultTemplate?.currency || (organization as any)?.default_currency || 'BRL',
    };

    return autoFilledData;
  } catch (error) {
    console.error('Error auto-filling proposal:', error);
    throw error;
  }
}

/**
 * Suggests proposal items based on historical data for similar accounts
 */
export async function suggestProposalItems(accountId: string, opportunityId: string): Promise<{
  suggestions: Array<{
    product_id: string;
    product_name: string;
    frequency: number;
    avg_quantity: number;
    avg_unit_price: number;
  }>;
  message: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-proposal-suggestions', {
      body: { accountId, opportunityId },
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching proposal item suggestions:', error);
    return { suggestions: [], message: '' };
  }
}

/**
 * Syncs account data to proposal in draft status
 * If account changes CNPJ or other key fields, proposal auto-updates
 */
export async function syncAccountDataToProposal(proposalId: string): Promise<void> {
  try {
    // Get proposal with opportunity and account
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        *,
        opportunities!inner(
          account_id,
          contact_id
        )
      `)
      .eq('id', proposalId)
      .eq('status', 'draft')
      .single();

    if (proposalError) throw proposalError;
    if (!proposal || proposal.status !== 'draft') {
      // Only sync draft proposals
      return;
    }

    const accountId = (proposal.opportunities as any).account_id;
    const contactId = (proposal.opportunities as any).contact_id;

    if (!accountId) return;

    // Fetch latest account and contact data
    const [account, contact] = await Promise.all([
      getAccount(accountId),
      contactId ? getContact(contactId) : Promise.resolve(null),
    ]);

    // Update proposal with latest data
    const updates: any = {};
    
    if (account) {
      // Update client name if changed
      const latestClientName = contact?.nome || account.nome_fantasia || account.razao_social;
      if (latestClientName !== proposal.client_name) {
        updates.client_name = latestClientName;
      }
    }

    if (contact && contact.emails?.[0]?.value !== proposal.client_email) {
      updates.client_email = contact.emails[0]?.value;
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', proposalId);

      if (updateError) throw updateError;
    }
  } catch (error) {
    console.error('Error syncing account data to proposal:', error);
    throw error;
  }
}

// Helper function to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
