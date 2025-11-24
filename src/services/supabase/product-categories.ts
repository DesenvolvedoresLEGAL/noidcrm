import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export interface ProductCategory {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
  is_active: z.boolean().optional(),
});

export async function listProductCategories(params?: { active?: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization');
  }

  let query = supabase
    .from('product_categories')
    .select('*')
    .eq('organization_id', memberData.organization_id)
    .order('name');

  if (params?.active !== undefined) {
    query = query.eq('is_active', params.active);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as ProductCategory[];
}

export async function createProductCategory(dto: unknown): Promise<ProductCategory> {
  const validated = categorySchema.parse(dto);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('product_categories')
    .insert([{
      name: validated.name,
      color: validated.color,
      is_active: validated.is_active ?? true,
      organization_id: memberData.organization_id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as ProductCategory;
}

export async function updateProductCategory(id: string, dto: unknown): Promise<ProductCategory> {
  const validated = categorySchema.partial().parse(dto);

  const { data, error } = await supabase
    .from('product_categories')
    .update(validated)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProductCategory;
}

export async function deleteProductCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleCategoryStatus(id: string): Promise<ProductCategory> {
  const { data: category, error: fetchError } = await supabase
    .from('product_categories')
    .select('is_active')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  return updateProductCategory(id, { is_active: !category.is_active });
}
