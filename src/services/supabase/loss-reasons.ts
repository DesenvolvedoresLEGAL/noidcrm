import { supabase } from '@/integrations/supabase/client';

export interface LossReason {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  pipeline_ids: string[] | null;
  audience: string;
  created_at: string;
  updated_at: string;
}

export async function listLossReasons(): Promise<LossReason[]> {
  const { data, error } = await supabase
    .from('loss_reasons')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching loss reasons:', error);
    throw error;
  }

  return data || [];
}

export async function getLossReasonsByPipeline(pipelineId: string | null): Promise<LossReason[]> {
  // Validar se pipelineId é um UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidUuid = pipelineId && uuidRegex.test(pipelineId);

  let query = supabase
    .from('loss_reasons')
    .select('*')
    .eq('is_active', true)
    .order('name');

  // Se não houver pipelineId válido, retornar motivos globais (pipeline_ids = null)
  // Se houver pipelineId válido, retornar motivos globais OU que incluam este pipeline
  if (isValidUuid) {
    query = query.or(`pipeline_ids.is.null,pipeline_ids.cs.{${pipelineId}}`);
  } else {
    query = query.is('pipeline_ids', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching loss reasons by pipeline:', error);
    throw error;
  }

  return data || [];
}

export async function createLossReason(dto: {
  name: string;
  is_active: boolean;
  pipeline_ids: string[] | null;
  audience?: string;
}): Promise<LossReason> {
  const { data: orgData, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgData) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('loss_reasons')
    .insert({
      organization_id: orgData,
      name: dto.name,
      is_active: dto.is_active,
      pipeline_ids: dto.pipeline_ids,
      audience: dto.audience || 'both',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating loss reason:', error);
    throw error;
  }

  return data;
}

export async function updateLossReason(
  id: string,
  updates: {
    name?: string;
    is_active?: boolean;
    pipeline_ids?: string[] | null;
  }
): Promise<LossReason> {
  const { data, error } = await supabase
    .from('loss_reasons')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating loss reason:', error);
    throw error;
  }

  return data;
}

export async function deleteLossReason(id: string): Promise<void> {
  const { error } = await supabase
    .from('loss_reasons')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting loss reason:', error);
    throw error;
  }
}

export async function toggleLossReasonStatus(id: string, is_active: boolean): Promise<LossReason> {
  return updateLossReason(id, { is_active });
}
