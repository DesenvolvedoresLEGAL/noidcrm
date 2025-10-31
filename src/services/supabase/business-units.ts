import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const businessUnitSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50, 'Code too long').regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers, or underscores'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
});

export interface BusinessUnit {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function getCurrentOrgId(): Promise<string> {
  const { data: orgId, error } = await supabase.rpc('get_user_organization_id');
  
  if (error) {
    console.error('[getCurrentOrgId] RPC error:', error);
    throw new Error('Failed to get organization ID');
  }
  
  if (!orgId) {
    throw new Error('No active organization found');
  }
  
  return orgId;
}

export async function listBusinessUnits(): Promise<BusinessUnit[]> {
  const orgId = await getCurrentOrgId();
  
  const { data, error } = await supabase
    .from('business_units')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getBusinessUnit(id: string): Promise<BusinessUnit | null> {
  const { data, error } = await supabase
    .from('business_units')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createBusinessUnit(dto: unknown): Promise<BusinessUnit> {
  const validated = businessUnitSchema.parse(dto);
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from('business_units')
    .insert({
      organization_id: orgId,
      code: validated.code,
      name: validated.name,
      color: validated.color,
    })
    .select()
    .single();

  if (error) {
    console.error('[createBusinessUnit] Insert error:', error);
    throw error;
  }
  
  return data;
}

export async function updateBusinessUnit(id: string, dto: Partial<BusinessUnit>): Promise<BusinessUnit> {
  const orgId = await getCurrentOrgId();
  const updates: any = {};
  
  if (dto.name !== undefined) updates.name = dto.name;
  if (dto.color !== undefined) updates.color = dto.color;
  if (dto.is_active !== undefined) updates.is_active = dto.is_active;

  const { data, error } = await supabase
    .from('business_units')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBusinessUnit(id: string): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  
  // Soft delete - just deactivate
  const { error } = await supabase
    .from('business_units')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) throw error;
  return true;
}
