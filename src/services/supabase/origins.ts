import { supabase } from '@/integrations/supabase/client';

export interface Origin {
  id: string;
  organization_id: string;
  group_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OriginGroup {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OriginWithGroup extends Origin {
  origin_groups?: {
    name: string;
  } | null;
}

// Origins
export async function listOrigins() {
  const { data, error } = await supabase
    .from('origins')
    .select(`
      *,
      origin_groups (
        name
      )
    `)
    .order('name');

  if (error) throw error;
  return data as OriginWithGroup[];
}

export async function createOrigin(origin: Omit<Origin, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) {
  const orgId = await supabase.rpc('get_user_organization_id');
  if (!orgId.data) throw new Error('User must belong to an organization');

  const { data, error } = await supabase
    .from('origins')
    .insert([{
      ...origin,
      organization_id: orgId.data
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrigin(id: string, updates: Partial<Omit<Origin, 'id' | 'created_at' | 'updated_at' | 'organization_id'>>) {
  const { data, error } = await supabase
    .from('origins')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrigin(id: string) {
  const { error } = await supabase
    .from('origins')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleOriginStatus(id: string, is_active: boolean) {
  return updateOrigin(id, { is_active });
}

// Origin Groups
export async function listOriginGroups() {
  const { data, error } = await supabase
    .from('origin_groups')
    .select('*')
    .order('name');

  if (error) throw error;
  return data as OriginGroup[];
}

export async function createOriginGroup(group: Omit<OriginGroup, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) {
  const orgId = await supabase.rpc('get_user_organization_id');
  if (!orgId.data) throw new Error('User must belong to an organization');

  const { data, error } = await supabase
    .from('origin_groups')
    .insert([{
      ...group,
      organization_id: orgId.data
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOriginGroup(id: string, updates: Partial<Omit<OriginGroup, 'id' | 'created_at' | 'updated_at' | 'organization_id'>>) {
  const { data, error } = await supabase
    .from('origin_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOriginGroup(id: string) {
  const { error } = await supabase
    .from('origin_groups')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleGroupStatus(id: string, is_active: boolean) {
  return updateOriginGroup(id, { is_active });
}
