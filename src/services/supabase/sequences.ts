import { supabase } from '@/integrations/supabase/client';
import { Sequence } from '../crm/types';

export async function listSequences(): Promise<Sequence[]> {
  const { data, error } = await supabase
    .from('sequences')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(s => ({
    ...s,
    steps: s.steps || [],
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
    steps: data.steps || [],
  } as Sequence;
}

export async function createSequence(dto: Partial<Sequence>): Promise<Sequence> {
  const { data, error } = await supabase
    .from('sequences')
    .insert({
      name: dto.name,
      description: dto.description,
      trigger_type: dto.trigger_type,
      status: dto.status || 'active',
      steps: dto.steps || [],
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    steps: data.steps || [],
  } as Sequence;
}

export async function updateSequence(id: string, dto: Partial<Sequence>): Promise<Sequence> {
  const { data, error } = await supabase
    .from('sequences')
    .update({
      name: dto.name,
      description: dto.description,
      trigger_type: dto.trigger_type,
      status: dto.status,
      steps: dto.steps,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    steps: data.steps || [],
  } as Sequence;
}

export async function deleteSequence(id: string): Promise<void> {
  const { error } = await supabase
    .from('sequences')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
