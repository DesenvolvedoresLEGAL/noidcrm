import { supabase } from '@/integrations/supabase/client';

export interface ICP {
  id: string;
  name: string;
  segment: string;
  company_size?: string;
  revenue_band?: string;
  tech_maturity?: number;
  pain_points: string[];
  buying_triggers?: string[];
  success_criteria?: string[];
  competing_alternatives?: string[];
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export async function listICPs(organizationId: string): Promise<ICP[]> {
  const { data, error } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ICP[];
}

export async function getICP(id: string): Promise<ICP> {
  const { data, error } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as ICP;
}

export async function createICP(icp: Omit<ICP, 'id' | 'created_at' | 'updated_at'>): Promise<ICP> {
  const { data, error } = await supabase
    .from('icp_profiles')
    .insert(icp as any)
    .select()
    .single();

  if (error) throw error;
  return data as ICP;
}

export async function updateICP(id: string, icp: Partial<ICP>): Promise<ICP> {
  const { data, error } = await supabase
    .from('icp_profiles')
    .update(icp as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ICP;
}

export async function deleteICP(id: string): Promise<void> {
  const { error } = await supabase
    .from('icp_profiles')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
