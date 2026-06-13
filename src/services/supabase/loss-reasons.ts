import { supabase } from '@/integrations/supabase/client';

export type LossReasonType = 'lost' | 'disqualification';

export interface LossReason {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  pipeline_ids: string[] | null;
  audience: string;
  category: string | null;
  loss_accountability?: string;
  reason_type?: LossReasonType;
  send_to_remarketing_default?: boolean;
  order_index?: number;
  created_at: string;
  updated_at: string;
}

export interface LossReasonInput {
  name: string;
  is_active: boolean;
  pipeline_ids: string[] | null;
  audience?: string;
  category?: string | null;
  loss_accountability?: string;
  reason_type?: LossReasonType;
  send_to_remarketing_default?: boolean;
  order_index?: number;
}

export async function listLossReasons(): Promise<LossReason[]> {
  const { data, error } = await supabase
    .from('loss_reasons')
    .select('*')
    .order('order_index', { ascending: true })
    .order('name');

  if (error) {
    console.error('Error fetching loss reasons:', error);
    throw error;
  }
  return (data as any) || [];
}

export async function getLossReasonsByPipeline(pipelineId: string | null): Promise<LossReason[]> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidUuid = pipelineId && uuidRegex.test(pipelineId);

  let query = supabase
    .from('loss_reasons')
    .select('*')
    .eq('is_active', true)
    .order('order_index', { ascending: true })
    .order('name');

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
  return (data as any) || [];
}

/**
 * Disqualify modal source-of-truth:
 * loss_reasons filtered by pipeline + active + audience seller/both +
 * reason_type lost OR disqualification. Ordered by order_index, name.
 */
export async function getDisqualifyReasonsForPipeline(
  pipelineId: string
): Promise<LossReason[]> {
  const { data, error } = await supabase
    .from('loss_reasons')
    .select('*')
    .eq('is_active', true)
    .in('audience', ['seller', 'both'])
    .or(`pipeline_ids.is.null,pipeline_ids.cs.{${pipelineId}}`)
    .order('order_index', { ascending: true })
    .order('name');

  if (error) {
    console.error('Error fetching disqualify reasons:', error);
    throw error;
  }
  return ((data as any) || []).filter(
    (r: LossReason) => r.reason_type === 'disqualification' || r.reason_type === 'lost' || !r.reason_type
  );
}

export async function createLossReason(dto: LossReasonInput): Promise<LossReason> {
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
      category: dto.category || null,
      loss_accountability: dto.loss_accountability || 'unknown',
      reason_type: dto.reason_type || 'lost',
      send_to_remarketing_default: dto.send_to_remarketing_default ?? false,
      order_index: dto.order_index ?? 0,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating loss reason:', error);
    throw error;
  }
  return data as any;
}

export async function updateLossReason(
  id: string,
  updates: Partial<LossReasonInput>
): Promise<LossReason> {
  const { data, error } = await supabase
    .from('loss_reasons')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating loss reason:', error);
    throw error;
  }
  return data as any;
}

export async function deleteLossReason(id: string): Promise<void> {
  const { error } = await supabase.from('loss_reasons').delete().eq('id', id);
  if (error) {
    console.error('Error deleting loss reason:', error);
    throw error;
  }
}

export async function toggleLossReasonStatus(id: string, is_active: boolean): Promise<LossReason> {
  return updateLossReason(id, { is_active });
}

/**
 * Idempotent seed for PRÉ VENDAS disqualification reasons.
 * Returns the count of newly inserted reasons.
 */
export async function seedPreSalesDisqualificationReasons(
  organizationId: string,
  pipelineId: string
): Promise<number> {
  const { data, error } = await supabase.rpc(
    'seed_pre_sales_disqualification_reasons' as any,
    { p_org_id: organizationId, p_pipeline_id: pipelineId }
  );
  if (error) {
    console.error('Error seeding pre-sales disqualification reasons:', error);
    throw error;
  }
  return (data as number) ?? 0;
}
