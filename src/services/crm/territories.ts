import { supabase } from '@/integrations/supabase/client';

export interface Territory {
  id: string;
  organization_id: string;
  name: string;
  type: 'geographic' | 'segment' | 'product' | 'industry' | null;
  criteria: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TerritoryAssignment {
  id: string;
  territory_id: string;
  user_id: string;
  organization_id: string;
  role: 'owner' | 'assigned' | 'collaborator';
  created_at: string;
  updated_at: string;
}

export async function listTerritories(): Promise<Territory[]> {
  const { data, error } = await supabase
    .from('territories')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data as Territory[];
}

export async function getTerritory(id: string): Promise<Territory | null> {
  const { data, error } = await supabase
    .from('territories')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Territory | null;
}

export async function createTerritory(territory: {
  name: string;
  type: string;
  criteria?: Record<string, any>;
}): Promise<Territory> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('territories')
    .insert({
      organization_id: orgId,
      name: territory.name,
      type: territory.type,
      criteria: territory.criteria || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as Territory;
}

export async function updateTerritory(
  id: string,
  updates: Partial<Territory>
): Promise<Territory> {
  const { data, error } = await supabase
    .from('territories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Territory;
}

export async function deleteTerritory(id: string): Promise<void> {
  const { error } = await supabase
    .from('territories')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function listTerritoryAssignments(territoryId: string): Promise<TerritoryAssignment[]> {
  const { data, error } = await supabase
    .from('territory_assignments')
    .select('*')
    .eq('territory_id', territoryId)
    .order('created_at');

  if (error) throw error;
  return data as TerritoryAssignment[];
}

export async function assignUserToTerritory(
  territoryId: string,
  userId: string,
  role: 'owner' | 'assigned' | 'collaborator' = 'assigned'
): Promise<TerritoryAssignment> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('territory_assignments')
    .insert({
      territory_id: territoryId,
      user_id: userId,
      organization_id: orgId,
      role,
    })
    .select()
    .single();

  if (error) throw error;
  return data as TerritoryAssignment;
}

export async function removeUserFromTerritory(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('territory_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) throw error;
}
