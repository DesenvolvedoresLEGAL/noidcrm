import { supabase } from '@/integrations/supabase/client';
import { Proposal } from '../crm/types';
import { z } from 'zod';
import { calculateProposalTotal } from './proposal-items';

// Extended schema to include all proposal fields
const proposalSchema = z.object({
  opportunity_id: z.string().uuid('Invalid opportunity ID'),
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected']).optional(),
  pdf_url: z.string().url('Invalid PDF URL').optional().nullable(),
  title: z.string().optional(),
  client_name: z.string().optional().nullable(),
  client_email: z.string().email().optional().nullable().or(z.literal('')),
  value: z.number().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  introduction: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  layout_id: z.string().uuid().optional().nullable(),
  currency: z.enum(['BRL', 'USD', 'EUR']).optional().nullable(),
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
  
  // Fetch organization_id explicitly (required for RLS)
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) {
    throw new Error('Usuário deve pertencer a uma organização');
  }

  // Build insert object with ALL fields
  const insertData: Record<string, any> = {
    opportunity_id: validated.opportunity_id,
    organization_id: orgId,
    status: validated.status || 'draft',
  };

  // Add all optional fields if provided
  if (validated.title) insertData.title = validated.title;
  if (validated.client_name) insertData.client_name = validated.client_name;
  if (validated.client_email && validated.client_email !== '') insertData.client_email = validated.client_email;
  if (validated.value !== undefined && validated.value !== null) insertData.value = validated.value;
  if (validated.expires_at) insertData.expires_at = validated.expires_at;
  if (validated.introduction) insertData.introduction = validated.introduction;
  if (validated.terms) insertData.terms = validated.terms;
  if (validated.notes) insertData.notes = validated.notes;
  if (validated.layout_id) insertData.layout_id = validated.layout_id;
  if (validated.currency) insertData.currency = validated.currency;
  if (validated.pdf_url) insertData.pdf_url = validated.pdf_url;

  const { data, error } = await supabase
    .from('proposals')
    .insert(insertData as any)
    .select()
    .single();

  if (error) throw error;
  return data as Proposal;
}

export async function listProposals(params?: {
  opportunityId?: string;
  status?: string;
  q?: string;
}): Promise<{ data: Proposal[]; total: number }> {
  let query = supabase
    .from('proposals')
    .select(`
      *,
      opportunity:opportunities(
        id,
        title,
        account:accounts(id, razao_social, nome_fantasia)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (params?.opportunityId) {
    query = query.eq('opportunity_id', params.opportunityId);
  }

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  if (params?.q) {
    query = query.ilike('title', `%${params.q}%`);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  
  // Fetch items count for each proposal
  const proposalsWithItems = await Promise.all(
    (data || []).map(async (proposal) => {
      const { count: itemsCount } = await supabase
        .from('proposal_items')
        .select('*', { count: 'exact', head: true })
        .eq('proposal_id', proposal.id);
      
      return {
        ...proposal,
        items_count: itemsCount || 0,
      };
    })
  );
  
  return { data: proposalsWithItems as any[], total: count || 0 };
}

export async function updateProposal(id: string, dto: unknown): Promise<Proposal> {
  // Parse with partial schema to allow any subset of fields
  const validated = proposalSchema.partial().parse(dto);

  // Build update object - only include defined fields
  const updateData: Record<string, any> = {};
  
  if (validated.title !== undefined) updateData.title = validated.title;
  if (validated.client_name !== undefined) updateData.client_name = validated.client_name;
  if (validated.client_email !== undefined) updateData.client_email = validated.client_email === '' ? null : validated.client_email;
  if (validated.value !== undefined) updateData.value = validated.value;
  if (validated.expires_at !== undefined) updateData.expires_at = validated.expires_at;
  if (validated.introduction !== undefined) updateData.introduction = validated.introduction;
  if (validated.terms !== undefined) updateData.terms = validated.terms;
  if (validated.notes !== undefined) updateData.notes = validated.notes;
  if (validated.layout_id !== undefined) updateData.layout_id = validated.layout_id;
  if (validated.currency !== undefined) updateData.currency = validated.currency;
  if (validated.status !== undefined) updateData.status = validated.status;
  if (validated.pdf_url !== undefined) updateData.pdf_url = validated.pdf_url;

  const { data, error } = await supabase
    .from('proposals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Proposal;
}

export async function deleteProposal(id: string): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function generateProposalPDF(id: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', {
    body: { proposalId: id },
  });

  if (error) throw error;
  return data.pdfUrl;
}

export async function sendProposalEmail(id: string, recipientEmail: string, recipientName?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('send-proposal-email', {
    body: { proposalId: id, recipientEmail, recipientName },
  });

  if (error) throw error;
}

// New functions for advanced features

export async function duplicateProposal(proposalId: string): Promise<Proposal> {
  // Get original proposal
  const { data: original, error: fetchError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single();

  if (fetchError) throw fetchError;

  // Fetch organization_id explicitly (required for RLS)
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) {
    throw new Error('Usuário deve pertencer a uma organização');
  }

  // Create new proposal with explicit organization_id
  const { data: newProposal, error: createError } = await supabase
    .from('proposals')
    .insert({
      opportunity_id: original.opportunity_id,
      status: 'draft',
      title: `${original.title} (Cópia)`,
      client_name: original.client_name,
      client_email: original.client_email,
      value: original.value,
      introduction: original.introduction,
      terms: original.terms,
      notes: original.notes,
      template_name: original.template_name,
      layout_id: original.layout_id,
      currency: original.currency,
      organization_id: orgId,
    } as any)
    .select()
    .single();

  if (createError) throw createError;

  // Copy items
  const { data: items } = await supabase
    .from('proposal_items')
    .select('*')
    .eq('proposal_id', proposalId);

  if (items && items.length > 0) {
    const newItems = items.map(item => ({
      ...item,
      id: undefined,
      proposal_id: newProposal.id,
      created_at: undefined,
      updated_at: undefined,
    }));

    await supabase.from('proposal_items').insert(newItems);
  }

  // Copy payment terms
  const { data: terms } = await supabase
    .from('proposal_payment_terms')
    .select('*')
    .eq('proposal_id', proposalId);

  if (terms && terms.length > 0) {
    const newTerms = terms.map(term => ({
      ...term,
      id: undefined,
      proposal_id: newProposal.id,
      created_at: undefined,
      updated_at: undefined,
    }));

    await supabase.from('proposal_payment_terms').insert(newTerms);
  }

  return newProposal as Proposal;
}

export async function createVersion(proposalId: string): Promise<Proposal> {
  const duplicate = await duplicateProposal(proposalId);

  // Get current proposal to determine version
  const { data: current } = await supabase
    .from('proposals')
    .select('version')
    .eq('id', proposalId)
    .single();

  const newVersion = (current?.version || 1) + 1;

  // Update new proposal with version info
  const currentTitle = (duplicate as any).title || 'Proposta';
  const { data, error } = await supabase
    .from('proposals')
    .update({
      version: newVersion,
      parent_proposal_id: proposalId,
      title: currentTitle.replace(' (Cópia)', ` v${newVersion}`),
    })
    .eq('id', duplicate.id)
    .select()
    .single();

  if (error) throw error;
  return data as Proposal;
}

export async function getProposalVersions(parentId: string): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .or(`id.eq.${parentId},parent_proposal_id.eq.${parentId}`)
    .order('version', { ascending: true });

  if (error) throw error;
  return data as Proposal[];
}

export async function generatePublicToken(proposalId: string): Promise<string> {
  // Generate secure random token client-side using Web Crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

  // Update proposal with token AND change status to 'sent' to allow public access
  const { error: updateError } = await supabase
    .from('proposals')
    .update({ 
      public_token: token,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  if (updateError) throw updateError;

  return token;
}

export async function getProposalByToken(token: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      opportunity:opportunities(
        id,
        title,
        account:accounts(id, razao_social, nome_fantasia)
      )
    `)
    .eq('public_token', token)
    .maybeSingle();

  if (error) throw error;
  return data as Proposal | null;
}

export async function acceptProposal(token: string): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      signature_status: 'accepted',
    })
    .eq('public_token', token);

  if (error) throw error;
}

export async function declineProposal(token: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .update({
      status: 'rejected',
      declined_at: new Date().toISOString(),
      declined_reason: reason,
      signature_status: 'declined',
    })
    .eq('public_token', token);

  if (error) throw error;
}

export async function trackView(proposalId: string, metadata?: { ip?: string; userAgent?: string }): Promise<void> {
  // Insert view record
  await supabase
    .from('proposal_views')
    .insert({
      proposal_id: proposalId,
      viewer_ip: metadata?.ip,
      viewer_user_agent: metadata?.userAgent,
    });

  // Update proposal views count and last viewed timestamp
  const { data: current } = await supabase
    .from('proposals')
    .select('views_count')
    .eq('id', proposalId)
    .single();

  await supabase
    .from('proposals')
    .update({
      views_count: (current?.views_count || 0) + 1,
      last_viewed_at: new Date().toISOString(),
      status: 'viewed',
    })
    .eq('id', proposalId);
}

export interface ProposalStats {
  views_count: number;
  last_viewed_at: string | null;
  first_viewed_at: string | null;
  unique_viewers: number;
  avg_view_duration: number | null;
}

export async function getProposalStats(proposalId: string): Promise<ProposalStats> {
  // Get views
  const { data: views } = await supabase
    .from('proposal_views')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('viewed_at', { ascending: true });

  // Get proposal data
  const { data: proposal } = await supabase
    .from('proposals')
    .select('views_count, last_viewed_at')
    .eq('id', proposalId)
    .single();

  const uniqueIps = new Set(views?.map(v => v.viewer_ip).filter(Boolean));
  const durations = views?.map(v => v.duration_seconds).filter(Boolean) || [];
  const avgDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : null;

  return {
    views_count: proposal?.views_count || 0,
    last_viewed_at: proposal?.last_viewed_at || null,
    first_viewed_at: views && views.length > 0 ? views[0].viewed_at : null,
    unique_viewers: uniqueIps.size,
    avg_view_duration: avgDuration,
  };
}

export async function updateProposalTotals(proposalId: string): Promise<void> {
  const totals = await calculateProposalTotal(proposalId);
  
  await supabase
    .from('proposals')
    .update({
      subtotal: totals.subtotal,
      total_amount: totals.total,
      value: totals.total, // Keep value in sync for backwards compatibility
    })
    .eq('id', proposalId);
}
