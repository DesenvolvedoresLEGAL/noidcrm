import { supabase } from '@/integrations/supabase/client';

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  trigger_type: string;
  status: string;
  steps: any[];
  created_at: string;
  updated_at: string;
}

export async function listSequences(): Promise<Sequence[]> {
  const { data, error } = await supabase
    .from('sequences')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(s => ({
    ...s,
    steps: Array.isArray(s.steps) ? s.steps : [],
  })) as Sequence[];
}

export async function getSequence(id: string): Promise<Sequence | null> {
  const { data, error } = await supabase
    .from('sequences')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    steps: Array.isArray(data.steps) ? data.steps : [],
  } as Sequence;
}

export async function createSequence(dto: Partial<Sequence>): Promise<Sequence> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const { data, error } = await supabase
    .from('sequences')
    .insert({
      name: dto.name!,
      description: dto.description,
      trigger_type: dto.trigger_type!,
      status: dto.status || 'active',
      steps: dto.steps || [],
      organization_id: memberData?.organization_id,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    steps: Array.isArray(data.steps) ? data.steps : [],
  } as Sequence;
}

export async function updateSequence(id: string, dto: Partial<Sequence>): Promise<Sequence> {
  const updateData: any = {};
  
  if (dto.name !== undefined) updateData.name = dto.name;
  if (dto.description !== undefined) updateData.description = dto.description;
  if (dto.trigger_type !== undefined) updateData.trigger_type = dto.trigger_type;
  if (dto.status !== undefined) updateData.status = dto.status;
  if (dto.steps !== undefined) updateData.steps = dto.steps;

  const { data, error } = await supabase
    .from('sequences')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    steps: Array.isArray(data.steps) ? data.steps : [],
  } as Sequence;
}

export async function deleteSequence(id: string): Promise<void> {
  const { error } = await supabase
    .from('sequences')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
