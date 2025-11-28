import { supabase } from '@/integrations/supabase/client';

export interface ProposalTemplate {
  id?: string;
  organization_id?: string;
  name: string;
  description?: string;
  introduction?: string;
  terms?: string;
  notes?: string;
  default_items?: any[];
  is_default?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export async function listTemplates(): Promise<ProposalTemplate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('proposal_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return data as ProposalTemplate[];
}

export async function createTemplate(template: Omit<ProposalTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<ProposalTemplate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  // If setting as default, unset other defaults first
  if (template.is_default) {
    await supabase
      .from('proposal_templates')
      .update({ is_default: false })
      .eq('organization_id', orgId)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('proposal_templates')
    .insert({
      ...template,
      organization_id: orgId,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProposalTemplate;
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<ProposalTemplate, 'id' | 'organization_id' | 'created_by'>>
): Promise<ProposalTemplate> {
  // If setting as default, unset other defaults first
  if (updates.is_default) {
    const { data: template } = await supabase
      .from('proposal_templates')
      .select('organization_id')
      .eq('id', templateId)
      .single();

    if (template) {
      await supabase
        .from('proposal_templates')
        .update({ is_default: false })
        .eq('organization_id', template.organization_id)
        .eq('is_default', true)
        .neq('id', templateId);
    }
  }

  const { data, error } = await supabase
    .from('proposal_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return data as ProposalTemplate;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_templates')
    .delete()
    .eq('id', templateId);

  if (error) throw error;
}

export async function applyTemplate(proposalId: string, templateId: string): Promise<void> {
  // Get template
  const { data: template, error: templateError } = await supabase
    .from('proposal_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError) throw templateError;

  // Update proposal with template data
  const { error: updateError } = await supabase
    .from('proposals')
    .update({
      introduction: template.introduction,
      terms: template.terms,
      notes: template.notes,
      template_name: template.name,
    })
    .eq('id', proposalId);

  if (updateError) throw updateError;

  // If template has default items, create them
  if (template.default_items && Array.isArray(template.default_items) && template.default_items.length > 0) {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('organization_id')
      .eq('id', proposalId)
      .single();

    if (proposal) {
      const itemsToInsert = template.default_items.map((item: any, index: number) => ({
        ...item,
        proposal_id: proposalId,
        organization_id: proposal.organization_id,
        order_index: index,
      }));

      await supabase
        .from('proposal_items')
        .insert(itemsToInsert);
    }
  }
}

export async function getDefaultTemplate(): Promise<ProposalTemplate | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: orgId } = await supabase.rpc('get_user_organization_id');

  if (!orgId) return null;

  const { data, error } = await supabase
    .from('proposal_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) return null;
  return data as ProposalTemplate | null;
}
