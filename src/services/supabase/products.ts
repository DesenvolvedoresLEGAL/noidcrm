import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  code?: string;
  description?: string;
  price?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  code: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
  price: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

export async function listProducts(params?: { active?: boolean; q?: string }) {
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
    .from('products')
    .select('*', { count: 'exact' })
    .eq('organization_id', memberData.organization_id)
    .order('name');

  if (params?.active !== undefined) {
    query = query.eq('active', params.active);
  }

  if (params?.q) {
    query = query.or(`name.ilike.%${params.q}%,code.ilike.%${params.q}%`);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: data as Product[], total: count || 0 };
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Product | null;
}

export async function createProduct(dto: unknown): Promise<Product> {
  const validated = productSchema.parse(dto);

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
    .from('products')
    .insert([{
      name: validated.name,
      code: validated.code,
      description: validated.description,
      price: validated.price,
      active: validated.active ?? true,
      organization_id: memberData.organization_id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, dto: unknown): Promise<Product> {
  const validated = productSchema.partial().parse(dto);

  const { data, error } = await supabase
    .from('products')
    .update(validated)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleProductStatus(id: string): Promise<Product> {
  const product = await getProduct(id);
  if (!product) throw new Error('Product not found');

  return updateProduct(id, { active: !product.active });
}
