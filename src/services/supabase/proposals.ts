import { supabase } from '@/integrations/supabase/client';
import { Proposal } from '../crm/types';
import { z } from 'zod';

const proposalSchema = z.object({
  opportunity_id: z.string().uuid('Invalid opportunity ID'),
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected']).optional(),
  pdf_url: z.string().url('Invalid PDF URL').optional(),
}).passthrough();

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

export async function createProposal(dto: unknown): Promise<Proposal> {
  // Validate input
  const validated = proposalSchema.parse(dto);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization to create proposals');
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      opportunity_id: validated.opportunity_id,
      status: validated.status || 'draft',
      pdf_url: validated.pdf_url,
      organization_id: memberData.organization_id,
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
