import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export interface OpportunityNote {
  id: string;
  opportunity_id: string;
  organization_id: string;
  created_by: string;
  content: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
    avatar_url?: string;
  };
}

const noteSchema = z.object({
  opportunity_id: z.string().uuid(),
  content: z.string().min(1, 'Conteúdo da nota é obrigatório'),
});

export async function listOpportunityNotes(opportunityId: string): Promise<OpportunityNote[]> {
  const { data, error } = await supabase
    .from('opportunity_notes')
    .select(`
      *,
      creator:profiles!opportunity_notes_created_by_fkey(full_name, avatar_url)
    `)
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as OpportunityNote[];
}

export async function createOpportunityNote(dto: unknown): Promise<OpportunityNote> {
  const validated = noteSchema.parse(dto);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization to create notes');
  }

  const { data, error } = await supabase
    .from('opportunity_notes')
    .insert([{
      opportunity_id: validated.opportunity_id,
      content: validated.content,
      created_by: user.id,
      organization_id: memberData.organization_id,
    }])
    .select(`
      *,
      creator:profiles!opportunity_notes_created_by_fkey(full_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data as OpportunityNote;
}

export async function updateOpportunityNote(id: string, content: string): Promise<OpportunityNote> {
  const { data, error } = await supabase
    .from('opportunity_notes')
    .update({ content })
    .eq('id', id)
    .select(`
      *,
      creator:profiles!opportunity_notes_created_by_fkey(full_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data as OpportunityNote;
}

export async function deleteOpportunityNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('opportunity_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
