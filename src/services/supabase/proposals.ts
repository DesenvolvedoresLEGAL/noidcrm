import { supabase } from '@/integrations/supabase/client';
import { Proposal } from '../crm/types';

export async function sendProposal(id: string): Promise<Proposal> {
  const { data, error } = await supabase
    .from('proposals')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Proposal;
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Proposal | null;
}

export async function createProposal(proposal: Partial<Proposal>): Promise<Proposal> {
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      opportunity_id: proposal.opportunity_id,
      status: proposal.status || 'draft',
      pdf_url: proposal.pdf_url,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Proposal;
}

export async function listProposals(opportunityId?: string): Promise<Proposal[]> {
  let query = supabase
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false });

  if (opportunityId) {
    query = query.eq('opportunity_id', opportunityId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Proposal[];
}
