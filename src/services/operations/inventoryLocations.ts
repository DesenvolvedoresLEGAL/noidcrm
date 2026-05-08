import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type InventoryLocation = Database['public']['Tables']['inventory_locations']['Row'];
export type InventoryLocationType = Database['public']['Enums']['inventory_location_type'];

export interface InventoryLocationInput {
  name: string;
  description?: string | null;
  location_type: InventoryLocationType;
  sort_order?: number;
  is_active?: boolean;
}

export async function listInventoryLocations(organizationId: string) {
  const { data, error } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as InventoryLocation[];
}

export async function createInventoryLocation(
  organizationId: string,
  userId: string | undefined,
  input: InventoryLocationInput,
) {
  const { data, error } = await supabase
    .from('inventory_locations')
    .insert({
      organization_id: organizationId,
      name: input.name,
      description: input.description ?? null,
      location_type: input.location_type,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryLocation;
}

export async function updateInventoryLocation(
  id: string,
  userId: string | undefined,
  input: Partial<InventoryLocationInput>,
) {
  const { data, error } = await supabase
    .from('inventory_locations')
    .update({
      ...input,
      updated_by: userId ?? null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryLocation;
}

export async function toggleInventoryLocationStatus(
  id: string,
  isActive: boolean,
  userId: string | undefined,
) {
  return updateInventoryLocation(id, userId, { is_active: isActive });
}
