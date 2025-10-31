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

export async function listBusinessUnits(): Promise<BusinessUnit[]> {
  const { data, error } = await supabase
    .from('business_units')
    .select('*')
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
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[createBusinessUnit] User check:', { user: user?.id, error: userError });
  
  if (!user) throw new Error('User not authenticated');

  const { data: memberData, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .maybeSingle();

  console.log('[createBusinessUnit] Organization check:', { 
    memberData, 
    memberError,
    userId: user.id 
  });

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('business_units')
    .insert({
      organization_id: memberData.organization_id,
      code: validated.code,
      name: validated.name,
      color: validated.color,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBusinessUnit(id: string, dto: Partial<BusinessUnit>): Promise<BusinessUnit> {
  const updates: any = {};
  
  if (dto.name !== undefined) updates.name = dto.name;
  if (dto.color !== undefined) updates.color = dto.color;
  if (dto.is_active !== undefined) updates.is_active = dto.is_active;

  const { data, error } = await supabase
    .from('business_units')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBusinessUnit(id: string): Promise<boolean> {
  // Soft delete - just deactivate
  const { error } = await supabase
    .from('business_units')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
  return true;
}
