import { supabase } from '@/integrations/supabase/client';

export interface RubricDimension {
  name: string;
  weight: number;
  description: string;
}

export interface Rubric {
  id: string;
  name: string;
  passing_score: number;
  dimensions: RubricDimension[];
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export async function listRubrics(organizationId: string): Promise<Rubric[]> {
  const { data, error } = await supabase
    .from('evaluation_rubrics')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as any as Rubric[];
}

export async function getRubric(id: string): Promise<Rubric> {
  const { data, error } = await supabase
    .from('evaluation_rubrics')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as any as Rubric;
}

export async function createRubric(rubric: Omit<Rubric, 'id' | 'created_at' | 'updated_at'>): Promise<Rubric> {
  const { data, error } = await supabase
    .from('evaluation_rubrics')
    .insert(rubric as any)
    .select()
    .single();

  if (error) throw error;
  return data as any as Rubric;
}

export async function updateRubric(id: string, rubric: Partial<Rubric>): Promise<Rubric> {
  const { data, error } = await supabase
    .from('evaluation_rubrics')
    .update(rubric as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as any as Rubric;
}

export async function deleteRubric(id: string): Promise<void> {
  const { error } = await supabase
    .from('evaluation_rubrics')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
