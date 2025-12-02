import { supabase } from '@/integrations/supabase/client';

export interface MeasurementUnit {
  id: string;
  organization_id: string;
  name: string;
  abbreviation: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function listMeasurementUnits(): Promise<MeasurementUnit[]> {
  const { data, error } = await supabase
    .from('measurement_units')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createMeasurementUnit(dto: {
  name: string;
  abbreviation: string;
  is_default?: boolean;
}): Promise<MeasurementUnit> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  
  if (!orgId) {
    throw new Error('Usuário deve pertencer a uma organização');
  }

  // If setting as default, unset other defaults first
  if (dto.is_default) {
    await supabase
      .from('measurement_units')
      .update({ is_default: false })
      .eq('organization_id', orgId);
  }

  const { data, error } = await supabase
    .from('measurement_units')
    .insert({
      organization_id: orgId,
      name: dto.name,
      abbreviation: dto.abbreviation,
      is_default: dto.is_default || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMeasurementUnit(
  id: string,
  dto: Partial<{ name: string; abbreviation: string; is_default: boolean }>
): Promise<MeasurementUnit> {
  // If setting as default, unset other defaults first
  if (dto.is_default) {
    const { data: orgId } = await supabase.rpc('get_user_organization_id');
    if (orgId) {
      await supabase
        .from('measurement_units')
        .update({ is_default: false })
        .eq('organization_id', orgId);
    }
  }

  const { data, error } = await supabase
    .from('measurement_units')
    .update(dto)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMeasurementUnit(id: string): Promise<void> {
  const { error } = await supabase
    .from('measurement_units')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleMeasurementUnitStatus(id: string): Promise<MeasurementUnit> {
  // First get current status
  const { data: current, error: fetchError } = await supabase
    .from('measurement_units')
    .select('is_active')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('measurement_units')
    .update({ is_active: !current.is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
