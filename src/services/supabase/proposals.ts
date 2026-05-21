import { supabase } from '@/integrations/supabase/client';
import { Proposal } from '../crm/types';
import { z } from 'zod';
import { calculateProposalTotal } from './proposal-items';

// Helper: generate SHA-256 hex of a string (browser crypto API)
async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Build candidate tokens: raw + SHA-256 hash (if not already a hash)
async function buildPublicTokenCandidates(token: string): Promise<string[]> {
  const t = token.trim();
  const isSha256 = /^[a-f0-9]{64}$/i.test(t);
  if (isSha256) return [t];
  const hashed = await sha256Hex(t);
  return [t, hashed];
}

// Build PostgREST OR filter for token candidates
async function buildTokenFilter(token: string): Promise<string> {
  const candidates = await buildPublicTokenCandidates(token);
  return candidates.map(t => `public_token.eq.${t}`).join(',');
}

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
  layout_id: z.string().uuid().or(z.literal('')).optional().nullable().transform(val => val === '' ? null : val),
  currency: z.enum(['BRL', 'USD', 'EUR']).optional().nullable(),
  event_start_date: z.string().optional().nullable(),
  event_end_date: z.string().optional().nullable(),
  event_location: z.string().optional().nullable(),
}).passthrough();

function normalizeEventDate(value?: string | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  const dateOnly = String(value).split('T')[0];
  return dateOnly || null;
}

const TERMINAL_PROPOSAL_STATUSES = new Set(['accepted', 'rejected']);

function isProposalTerminal(proposal?: {
  status?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
} | null) {
  if (!proposal) return false;

  return (
    TERMINAL_PROPOSAL_STATUSES.has(proposal.status ?? '') ||
    Boolean(proposal.accepted_at) ||
    Boolean(proposal.declined_at)
  );
}

export async function sendProposal(id: string): Promise<Proposal> {
  const { data: currentProposal, error: currentProposalError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single();

  if (currentProposalError) throw currentProposalError;

  if (isProposalTerminal(currentProposal)) {
    return currentProposal as Proposal;
  }

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
    .is('deleted_at', null) // Soft delete filter
    .maybeSingle();

  if (error) throw error;
  return data as Proposal | null;
}

// Get proposal with all related data for PDF generation
export async function getProposalWithDetails(id: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      organization:organizations(
        id,
        name,
        legal_name,
        cnpj,
        logo_url,
        email,
        phone,
        primary_color,
        address_street,
        address_number,
        address_complement,
        address_city,
        address_state,
        address_zip
      ),
      layout:proposal_layouts(
        id,
        name,
        terms_pdf_url
      ),
      opportunity:opportunities!proposals_opportunity_id_fkey(
        id,
        title,
        owner_user_id,
        account:accounts(
          id,
          razao_social,
          nome_fantasia,
          cnpj,
          telefones,
          emails,
          cidade,
          uf,
          logradouro,
          numero,
          bairro,
          cep
        ),
        contact:contacts(
          id,
          nome,
          cargo,
          emails,
          telefones
        )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  
  // Fetch seller profile if opportunity has owner
  if (data?.opportunity?.owner_user_id) {
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, phone, email')
      .eq('user_id', data.opportunity.owner_user_id)
      .maybeSingle();
    
    if (sellerProfile) {
      (data as any).seller_profile = sellerProfile;
    }
  }
  
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

  // CRITICAL: Validate that opportunity_id is provided
  if (!validated.opportunity_id) {
    console.error('[createProposal] BLOCKED: No opportunity_id provided');
    throw new Error('opportunity_id é obrigatório para criar proposta');
  }

  // Validate that the opportunity exists and belongs to the user's organization
  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('id, title, organization_id, pipeline:pipelines(pipeline_type)')
    .eq('id', validated.opportunity_id)
    .single();

  if (oppError || !opportunity) {
    console.error('[createProposal] Opportunity not found:', validated.opportunity_id);
    throw new Error('Oportunidade não encontrada');
  }

  // Verify opportunity belongs to same organization
  if (opportunity.organization_id !== orgId) {
    console.error('[createProposal] Organization mismatch:', { oppOrg: opportunity.organization_id, userOrg: orgId });
    throw new Error('Oportunidade não pertence à sua organização');
  }

  const pipelineType = (opportunity?.pipeline as any)?.pipeline_type;
  if (pipelineType && pipelineType !== 'sales') {
    throw new Error('Propostas só podem ser criadas para oportunidades em funis de vendas');
  }

  // Note: proposal_number is now generated by database trigger (set_proposal_number_on_insert)
  // This ensures number is only generated AFTER successful insert, preventing "lost" numbers

  console.log('[createProposal] Creating proposal:', {
    opportunity_id: validated.opportunity_id,
    opportunity_title: opportunity.title,
  });

  // Build insert object with ALL fields
  // proposal_number will be set by trigger
  const insertData: Record<string, any> = {
    opportunity_id: validated.opportunity_id,
    organization_id: orgId,
    status: validated.status || 'draft',
    proposal_version: 1,
    // ALWAYS provide a title to prevent NULL in database trigger notification
    title: validated.title || `Proposta - ${opportunity.title || 'Nova Proposta'}`,
  };
  if (validated.client_name) insertData.client_name = validated.client_name;
  if (validated.client_email && validated.client_email !== '') insertData.client_email = validated.client_email;
  if (validated.value !== undefined && validated.value !== null) insertData.value = validated.value;
  if (validated.expires_at) {
    // Store date at noon UTC to avoid timezone shifting
    const dateOnly = validated.expires_at.split('T')[0];
    insertData.expires_at = `${dateOnly}T12:00:00Z`;
  }
  if (validated.introduction) insertData.introduction = validated.introduction;
  if (validated.terms) insertData.terms = validated.terms;
  if (validated.notes) insertData.notes = validated.notes;
  if (validated.layout_id) insertData.layout_id = validated.layout_id;
  if (validated.currency) insertData.currency = validated.currency;
  if (validated.pdf_url) insertData.pdf_url = validated.pdf_url;
  if (validated.event_start_date !== undefined) insertData.event_start_date = normalizeEventDate(validated.event_start_date);
  if (validated.event_end_date !== undefined) insertData.event_end_date = normalizeEventDate(validated.event_end_date);
  if (validated.event_location !== undefined) {
    insertData.event_location = validated.event_location === '' ? null : validated.event_location;
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert(insertData as any)
    .select()
    .single();

  if (error) throw error;

  // Log proposal creation for audit trail
  console.log('[createProposal] SUCCESS - Created proposal:', {
    proposal_id: data.id,
    proposal_number: data.proposal_number,
    opportunity_id: data.opportunity_id,
  });

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
      opportunity:opportunities!proposals_opportunity_id_fkey(
        id,
        title,
        account:accounts(id, razao_social, nome_fantasia)
      )
    `, { count: 'exact' })
    .is('deleted_at', null) // Soft delete filter
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

  // Fetch current proposal to get version for increment
  const { data: currentProposal, error: fetchError } = await supabase
    .from('proposals')
    .select('proposal_version, status, accepted_at, declined_at')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Build update object - only include defined fields
  const updateData: Record<string, any> = {
    // Always increment version on save
    proposal_version: (currentProposal?.proposal_version || 1) + 1,
  };
  
  if (validated.title !== undefined) updateData.title = validated.title;
  if (validated.client_name !== undefined) updateData.client_name = validated.client_name;
  if (validated.client_email !== undefined) updateData.client_email = validated.client_email === '' ? null : validated.client_email;
  if (validated.value !== undefined) updateData.value = validated.value;
  if (validated.expires_at !== undefined) {
    // Store date at noon UTC to avoid timezone shifting (YYYY-MM-DDT12:00:00Z)
    if (validated.expires_at && validated.expires_at !== '') {
      const dateOnly = validated.expires_at.split('T')[0]; // Handle if timestamp provided
      updateData.expires_at = `${dateOnly}T12:00:00Z`;
    } else {
      updateData.expires_at = null;
    }
  }
  if (validated.introduction !== undefined) updateData.introduction = validated.introduction;
  if (validated.terms !== undefined) updateData.terms = validated.terms;
  if (validated.notes !== undefined) updateData.notes = validated.notes;
  if (validated.layout_id !== undefined) updateData.layout_id = validated.layout_id === '' ? null : validated.layout_id;
  if (validated.currency !== undefined) updateData.currency = validated.currency;
  if (validated.status !== undefined) {
    if (validated.status === 'accepted') {
      // PRICE CORE 2.0C — block & freeze via central RPC; never write
      // status=accepted manually anymore.
      const { data: freezeRes, error: freezeErr } = await (supabase as any).rpc(
        'freeze_proposal_approval',
        { p_proposal_id: id },
      );
      if (freezeErr) throw freezeErr;
      if (!freezeRes?.ok) {
        throw new Error(
          freezeRes?.message ||
            'Não foi possível aprovar a proposta. Existem valores divergentes. Recalcule antes de tentar novamente.',
        );
      }
      // The RPC already set status/accepted_at/approved_* — do not overwrite below.
    } else if (validated.status === 'rejected') {
      updateData.status = 'rejected';
      updateData.declined_at = currentProposal?.declined_at ?? new Date().toISOString();
    } else if (!isProposalTerminal(currentProposal)) {
      updateData.status = validated.status;
      if (validated.status === 'sent') {
        updateData.sent_at = new Date().toISOString();
      }
    } else {
      console.warn('[updateProposal] ignoring terminal status downgrade attempt', {
        proposalId: id,
        currentStatus: currentProposal?.status,
        requestedStatus: validated.status,
      });
    }
  }
  if (validated.pdf_url !== undefined) updateData.pdf_url = validated.pdf_url;
  if (validated.event_start_date !== undefined) updateData.event_start_date = normalizeEventDate(validated.event_start_date);
  if (validated.event_end_date !== undefined) updateData.event_end_date = normalizeEventDate(validated.event_end_date);
  if (validated.event_location !== undefined) {
    updateData.event_location = validated.event_location === '' ? null : validated.event_location;
  }

  const { data, error } = await supabase
    .from('proposals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // If status changed to accepted, trigger post-acceptance effects
  if (updateData.status === 'accepted') {
    console.log('[updateProposal] Status changed to accepted, triggering effects for proposal:', id);
    supabase.functions.invoke('post-acceptance-effects', {
      body: { proposalId: id }
    }).then(({ data: effectsData, error: effectsError }) => {
      if (effectsError) {
        console.error('[updateProposal] post-acceptance-effects error (non-blocking):', effectsError);
      } else {
        console.log('[updateProposal] post-acceptance-effects result:', effectsData);
      }
    });
  }

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
  // Get proposal details for email content
  const { data: proposal } = await supabase
    .from('proposals')
    .select('title, public_token, pdf_url, opportunity_id, status, accepted_at, declined_at')
    .eq('id', id)
    .single();

  if (!proposal) throw new Error('Proposta não encontrada');

  // Build proposal link (prefer public_token, fallback to pdf_url)
  const publicUrl = proposal.public_token
    ? `${window.location.origin}/proposta/${proposal.public_token}`
    : proposal.pdf_url || '';

  const htmlBody = `
    <p>Oi${recipientName ? ` ${recipientName}` : ''}, tudo bem?</p>
    <p>Segue a proposta comercial <strong>${proposal.title || ''}</strong> para sua análise.</p>
    ${publicUrl ? `<p><a href="${publicUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">📄 Visualizar Proposta</a></p>` : ''}
    <p>Qualquer dúvida, é só chamar!</p>
  `;

  const { error } = await supabase.functions.invoke('send-smtp-email', {
    body: {
      to_emails: [recipientEmail],
      subject: `Proposta Comercial: ${proposal.title || 'Nova Proposta'}`,
      html_body: htmlBody,
      opportunity_id: proposal.opportunity_id,
    },
  });

  if (error) {
    // Try to extract meaningful error message
    let errorMessage = 'Erro ao enviar email. Verifique suas configurações SMTP em Configurações > Email.';
    try {
      const ctx = (error as any)?.context;
      if (ctx?.json) {
        const body = await ctx.json();
        if (body?.error) errorMessage = body.error;
      }
    } catch {}
    throw new Error(errorMessage);
  }

  if (!isProposalTerminal(proposal)) {
    await supabase
      .from('proposals')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id);
  }
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

  const { data: currentProposal, error: proposalError } = await supabase
    .from('proposals')
    .select('status, accepted_at, declined_at')
    .eq('id', proposalId)
    .single();

  if (proposalError) throw proposalError;

  // Update proposal with token AND change status to 'sent' to allow public access
  const updateData: Record<string, any> = {
    public_token: token,
  };

  if (!isProposalTerminal(currentProposal)) {
    updateData.status = 'sent';
    updateData.sent_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('proposals')
    .update(updateData)
    .eq('id', proposalId);

  if (updateError) throw updateError;

  return token;
}

export async function getProposalByToken(token: string): Promise<(Proposal & { items?: any[]; payment_terms?: any[] }) | null> {
  // Use RPC (SECURITY DEFINER) that returns a full JSONB bundle –
  // includes proposal + organization + opportunity + account + contact +
  // items + payment_terms + layout + seller_profile.
  const candidates = await buildPublicTokenCandidates(token);

  let bundle: any = null;
  let lastError: any = null;
  for (const candidate of candidates) {
    const { data, error } = await supabase.rpc('get_proposal_by_public_token', { p_token: candidate });
    if (error) {
      console.warn('[getProposalByToken] RPC error for candidate:', error.message);
      lastError = error;
      continue;
    }
    if (data && typeof data === 'object' && (data as any).proposal?.id) {
      bundle = data;
      break;
    }
    // RPC returned null — token not found (no error)
    lastError = null;
  }

  // If all candidates failed with actual RPC errors, throw so UI shows a technical error
  if (!bundle?.proposal?.id && lastError) {
    throw new Error(`Erro ao carregar proposta: ${lastError.message}`);
  }

  if (!bundle?.proposal?.id) return null;

  // PRICE CORE 2.0 — make sure the public link reads a fresh pricing
  // ledger (header, "Condições de Pagamento" e "Forma e prazo do pagamento").
  // ensure_proposal_pricing_ready is SECURITY DEFINER and no-op on frozen
  // accepted proposals. We only trigger it for editable statuses to avoid
  // unnecessary writes; if the snapshot is stale we re-fetch the bundle.
  try {
    const proposalSnapshot = bundle.proposal;
    const status = proposalSnapshot?.status;
    const editable = !status || ['draft', 'open', 'sent', 'viewed', 'pending_approval'].includes(status);
    const snap = proposalSnapshot?.pricing_breakdown_snapshot;
    const snapCalculatedAt = snap?.calculated_at ? new Date(snap.calculated_at).getTime() : 0;
    const proposalUpdatedAt = proposalSnapshot?.updated_at ? new Date(proposalSnapshot.updated_at).getTime() : 0;
    const stale = !snap || !snap.version || snapCalculatedAt < proposalUpdatedAt;
    if (editable && stale) {
      await (supabase as any).rpc('ensure_proposal_pricing_ready', { p_proposal_id: proposalSnapshot.id });
      // Re-fetch the bundle so flattened result carries the fresh snapshot
      for (const candidate of candidates) {
        const { data, error } = await supabase.rpc('get_proposal_by_public_token', { p_token: candidate });
        if (error) continue;
        if (data && typeof data === 'object' && (data as any).proposal?.id) {
          bundle = data;
          break;
        }
      }
    }
  } catch (e) {
    console.warn('[getProposalByToken] ledger refresh skipped:', (e as any)?.message ?? e);
  }

  // Flatten the bundle into the shape the UI expects
  const result: any = {
    ...bundle.proposal,
    organization: bundle.organization || null,
    opportunity: bundle.opportunity
      ? {
          ...bundle.opportunity,
          account: bundle.account || null,
          contact: bundle.contact || null,
        }
      : null,
    layout: bundle.layout || null,
    seller_profile: bundle.seller_profile || null,
    // Attach items and payment_terms so the caller can use them directly
    items: bundle.items || [],
    payment_terms: bundle.payment_terms || [],
  };

  return result;
}

export async function acceptProposal(token: string): Promise<void> {
  // Use RPC to resolve proposal ID (bypasses RLS for anon)
  const candidates = await buildPublicTokenCandidates(token);
  let proposalId: string | null = null;

  for (const candidate of candidates) {
    const { data, error } = await supabase.rpc('get_proposal_by_public_token', { p_token: candidate });
    if (error) continue;
    const d = data as any;
    if (d?.proposal?.id) { proposalId = d.proposal.id; break; }
  }

  if (!proposalId) {
    throw new Error('Proposal not found');
  }

  // PRICE CORE 2.0C — central guard + freeze in a single RPC.
  // Blocks acceptance when the proposal has divergent pricing values.
  const { data: freezeRes, error: freezeErr } = await (supabase as any).rpc(
    'freeze_proposal_approval',
    { p_proposal_id: proposalId },
  );
  if (freezeErr) throw freezeErr;
  if (!freezeRes?.ok) {
    throw new Error(
      freezeRes?.message ||
        'Não foi possível aprovar a proposta. Existem valores divergentes. Recalcule antes de tentar novamente.',
    );
  }

  // Fire-and-forget: notify ERP about the accepted deal
  try {
    supabase.functions.invoke('notify-deal-won', {
      body: { proposal_id: proposalId },
    }).then(({ error: webhookError }) => {
      if (webhookError) {
        console.error('Failed to notify ERP about deal won:', webhookError);
      }
    });
  } catch (webhookErr) {
    console.error('Error invoking notify-deal-won:', webhookErr);
  }

  // Fire-and-forget: trigger post-acceptance effects (Slack + notifications + modal)
  console.log('[acceptProposal] Triggering post-acceptance effects for proposal:', proposalId);
  supabase.functions.invoke('post-acceptance-effects', {
    body: { proposalId }
  }).then(({ data: effectsData, error: effectsError }) => {
    if (effectsError) {
      console.error('[acceptProposal] post-acceptance-effects error (non-blocking):', effectsError);
    } else {
      console.log('[acceptProposal] post-acceptance-effects result:', effectsData);
    }
  });
}

export async function declineProposal(token: string, reason: string): Promise<void> {
  // Use RPC to resolve proposal ID (bypasses RLS for anon)
  const candidates = await buildPublicTokenCandidates(token);
  let proposalId: string | null = null;

  for (const candidate of candidates) {
    const { data, error: rpcErr } = await supabase.rpc('get_proposal_by_public_token', { p_token: candidate });
    if (rpcErr) continue;
    const d = data as any;
    if (d?.proposal?.id) { proposalId = d.proposal.id; break; }
  }

  if (!proposalId) {
    throw new Error('Proposal not found');
  }

  // Call edge function to handle decline with notifications and history logging
  const { error } = await supabase.functions.invoke('handle-proposal-decline', {
    body: {
      proposalId,
      reason,
      declinedByName: 'Cliente',
    },
  });

  if (error) throw error;
}

/**
 * Reopen a proposal that was previously accepted or rejected, bringing it
 * back to an open ('sent') state. Used when an opportunity is reopened or
 * when the seller needs to revise an already-closed proposal because the
 * project changed. Clears all terminal markers so the public link no longer
 * shows the "Aceita" or "Recusada" banner.
 */
export async function reopenProposal(proposalId: string): Promise<Proposal> {
  const { data, error } = await supabase
    .from('proposals')
    .update({
      status: 'sent',
      accepted_at: null,
      declined_at: null,
      declined_reason: null,
      signature_status: 'pending',
      sent_at: new Date().toISOString(),
    })
    .eq('id', proposalId)
    .select()
    .single();

  if (error) throw error;
  return data as Proposal;
}

export async function trackView(
  proposalId: string, 
  metadata?: { 
    ip?: string; 
    userAgent?: string;
    viewerType?: 'internal' | 'external';
    viewerUserId?: string | null;
    sessionId?: string;
  }
): Promise<void> {
  const viewerType = metadata?.viewerType || 'external';
  const viewerUserId = metadata?.viewerUserId || null;
  
  // Only use edge function for external views to trigger alerts/workflows
  // Internal views just record silently
  if (viewerType === 'external') {
    // Use edge function for external views (triggers alerts and workflows)
    const { error: fnError } = await supabase.functions.invoke('track-proposal-view', {
      body: { 
        proposalId, 
        metadata: {
          userAgent: metadata?.userAgent,
          viewerType,
          viewerUserId,
          sessionId: metadata?.sessionId,
        }
      },
    });
    
    if (fnError) {
      console.error('Error calling track-proposal-view:', fnError);
      // Fallback to direct insert if edge function fails
      await insertViewDirectly(proposalId, metadata);
    }
  } else {
    // Direct insert for internal views (no alerts/workflows)
    await insertViewDirectly(proposalId, metadata);
  }
}

export async function updateProposalView(
  proposalId: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await supabase.functions.invoke('track-proposal-view', {
      body: {
        proposalId,
        action: 'update_view',
        metadata,
      },
    });
  } catch (error) {
    console.error('Error updating proposal view:', error);
  }
}

async function insertViewDirectly(
  proposalId: string,
  metadata?: { 
    ip?: string; 
    userAgent?: string;
    viewerType?: 'internal' | 'external';
    viewerUserId?: string | null;
  }
): Promise<void> {
  // Insert view record
  await supabase
    .from('proposal_views')
    .insert({
      proposal_id: proposalId,
      viewer_ip: metadata?.ip,
      viewer_user_agent: metadata?.userAgent,
      viewer_type: metadata?.viewerType || 'external',
      viewer_user_id: metadata?.viewerUserId || null,
    });

  // Only update views_count for EXTERNAL views (from clients)
  // Internal views (from CRM users) should not count toward proposal analytics
  if (metadata?.viewerType === 'external') {
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
}

export interface ProposalStats {
  views_count: number;
  last_viewed_at: string | null;
  first_viewed_at: string | null;
  unique_viewers: number;
  avg_view_duration: number | null;
}

export async function getProposalStats(proposalId: string): Promise<ProposalStats> {
  // Get ONLY external views (from clients, not internal CRM users)
  const { data: views } = await supabase
    .from('proposal_views')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('viewer_type', 'external')
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
  
  const { error } = await supabase
    .from('proposals')
    .update({
      subtotal: totals.subtotal,
      total_amount: totals.total,
      value: totals.total, // Keep value in sync for backwards compatibility
      discount_amount: totals.discountAmount, // Persist payment term discount
    })
    .eq('id', proposalId);
  
  if (error) {
    console.error('[updateProposalTotals] Error:', error);
    throw new Error(`Erro ao atualizar totais da proposta: ${error.message}`);
  }
}

/**
 * Synchronize opportunity valor_previsto with proposal total_amount
 * Called after saving proposal items to keep values in sync
 */
export async function syncOpportunityValue(proposalId: string): Promise<void> {
  // Fetch the proposal with its opportunity_id and ALL fields needed to compute the
  // approved commercial value (priority: payment_expected_amount > dynamic_pricing_current_amount
  // > snapshot.current_amount > total_amount > value).
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(
      'opportunity_id, total_amount, value, payment_expected_amount, dynamic_pricing_enabled, dynamic_pricing_status, dynamic_pricing_current_amount, dynamic_pricing_snapshot',
    )
    .eq('id', proposalId)
    .single();

  if (error) {
    console.error('[syncOpportunityValue] Error fetching proposal:', error);
    throw new Error(`Erro ao buscar proposta: ${error.message}`);
  }

  if (!proposal?.opportunity_id) {
    console.log('[syncOpportunityValue] No opportunity linked, skipping sync');
    return;
  }

  // Calculate commission total from proposal items
  const totals = await calculateProposalTotal(proposalId);

  // Resolve approved value (dynamic pricing aware)
  const p: any = proposal;
  const dynActive =
    !!p.dynamic_pricing_enabled &&
    (!p.dynamic_pricing_status ||
      ['active', 'current', 'vigente', 'approved', 'aprovado'].includes(
        String(p.dynamic_pricing_status).toLowerCase(),
      ));
  const dynCurrent = Number(p.dynamic_pricing_current_amount) || 0;
  const snapshotCurrent = Number(p.dynamic_pricing_snapshot?.current_amount) || 0;
  const expected = Number(p.payment_expected_amount) || 0;
  const approvedValue =
    expected > 0
      ? expected
      : dynActive && dynCurrent > 0
        ? dynCurrent
        : dynActive && snapshotCurrent > 0
          ? snapshotCurrent
          : Number(p.total_amount) || Number(p.value) || 0;

  const { error: updateError } = await supabase
    .from('opportunities')
    .update({
      valor_previsto: approvedValue,
      commission_value: totals.commissionTotal || 0,
    })
    .eq('id', proposal.opportunity_id);

  if (updateError) {
    console.error('[syncOpportunityValue] Error updating opportunity:', updateError);
    throw new Error(`Erro ao sincronizar valor da oportunidade: ${updateError.message}`);
  }

  console.log(
    '[syncOpportunityValue] Updated opportunity - valor_previsto:',
    approvedValue,
    'commission_value:',
    totals.commissionTotal,
  );
}
