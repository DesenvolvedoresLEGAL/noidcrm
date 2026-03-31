import { supabase } from '@/integrations/supabase/client';

export type WinReasonCategory = 'price' | 'product' | 'service' | 'brand' | 'relationship' | 'timing' | 'other';

export interface WinReason {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  category?: WinReasonCategory | null;
  is_active: boolean;
  pipeline_ids?: string[] | null;
  audience: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export async function listWinReasons(pipelineId?: string | null): Promise<WinReason[]> {
  let query = supabase
    .from('win_reasons')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching win reasons:', error);
    throw error;
  }

  const results = (data || []) as WinReason[];

  // Filter by pipeline if specified
  if (pipelineId) {
    return results.filter(r => 
      !r.pipeline_ids || 
      r.pipeline_ids.length === 0 || 
      r.pipeline_ids.includes(pipelineId)
    );
  }

  return results;
}

export async function getWinReasonsByPipeline(pipelineId: string | null): Promise<WinReason[]> {
  return listWinReasons(pipelineId);
}

export async function createWinReason(reason: Partial<WinReason>): Promise<WinReason> {
  const { data: membership } = await supabase.rpc('get_user_organization_id');
  
  const { data, error } = await supabase
    .from('win_reasons')
    .insert({
      name: reason.name!,
      organization_id: membership,
      description: reason.description,
      category: reason.category,
      is_active: reason.is_active ?? true,
      pipeline_ids: reason.pipeline_ids,
      audience: reason.audience || 'both',
      display_order: reason.display_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating win reason:', error);
    throw error;
  }

  return data as WinReason;
}

export async function updateWinReason(id: string, updates: Partial<WinReason>): Promise<WinReason> {
  const { data, error } = await supabase
    .from('win_reasons')
    .update({
      name: updates.name,
      description: updates.description,
      category: updates.category,
      is_active: updates.is_active,
      pipeline_ids: updates.pipeline_ids,
      audience: updates.audience,
      display_order: updates.display_order,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating win reason:', error);
    throw error;
  }

  return data as WinReason;
}

export async function deleteWinReason(id: string): Promise<void> {
  const { error } = await supabase
    .from('win_reasons')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting win reason:', error);
    throw error;
  }
}
