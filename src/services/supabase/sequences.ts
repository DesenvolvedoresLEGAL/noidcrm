import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const sequenceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  trigger_type: z.string().min(1, 'Trigger type is required'),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  steps: z.array(z.unknown()).optional(), // Array of step objects
}).passthrough();

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

export async function createSequence(dto: unknown): Promise<Sequence> {
  // Validate input
  const validated = sequenceSchema.parse(dto);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization to create sequences');
  }

  const { data, error } = await supabase
    .from('sequences')
    .insert({
      name: validated.name,
      description: validated.description,
      trigger_type: validated.trigger_type,
      status: validated.status || 'active',
      steps: (validated.steps || []) as any,
      organization_id: orgId,
    } as any)
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
