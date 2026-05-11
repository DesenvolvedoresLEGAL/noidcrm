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
  type: 'produto' | 'servico';
  category_id?: string;
  reference?: string;
  cost?: number;
  unit: string;
  ipi_percent: number;
  image_url?: string;
  // Billing type fields
  billing_type: 'one_time' | 'recurring' | 'point_day';
  billing_cycle?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  monthly_price?: number;
  minimum_contract_months?: number;
  // Point-day billing fields
  default_unit_price_point_day?: number;
  default_billing_days?: number;
  default_quantity_points?: number;
  // Commission tracking
  counts_for_commission: boolean;
  // Sync fields
  external_id?: string;
  external_source?: string;
  last_synced_at?: string;
}

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  code: z.string().max(50).optional(),
  description: z.string().max(10000).optional(),
  price: z.number().min(0).optional(),
  active: z.boolean().optional(),
  type: z.enum(['produto', 'servico']).optional(),
  category_id: z.string().uuid().optional().nullable(),
  reference: z.string().max(100).optional(),
  cost: z.number().min(0).optional(),
  unit: z.string().max(20).optional(),
  ipi_percent: z.number().min(0).max(100).optional(),
  image_url: z.string().url().optional().nullable(),
  // Billing type fields
  billing_type: z.enum(['one_time', 'recurring', 'point_day']).optional(),
  billing_cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).optional(),
  monthly_price: z.number().min(0).optional(),
  minimum_contract_months: z.number().int().min(1).optional(),
  default_unit_price_point_day: z.number().min(0).optional(),
  default_billing_days: z.number().int().min(1).optional(),
  default_quantity_points: z.number().int().min(1).optional(),
  // Commission tracking
  counts_for_commission: z.boolean().optional(),
});

export async function listProducts(params?: { active?: boolean; q?: string }) {
  let query = supabase
    .from('products')
    .select(`
      *,
      category:product_categories(id, name, color)
    `, { count: 'exact' })
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

  // Get organization_id from database function - RLS will handle authorization
  const { data: orgData, error: orgError } = await supabase
    .rpc('get_user_organization_id');

  if (orgError || !orgData) {
    throw new Error('Usuário não pertence a uma organização');
  }

  const { data, error } = await supabase
    .from('products')
    .insert([{
      name: validated.name,
      code: validated.code,
      description: validated.description,
      price: validated.price,
      active: validated.active ?? true,
      type: validated.type ?? 'produto',
      category_id: validated.category_id,
      reference: validated.reference,
      cost: validated.cost,
      unit: validated.unit ?? 'un',
      ipi_percent: validated.ipi_percent ?? 0,
      image_url: validated.image_url,
      organization_id: orgData,
      // Billing type fields
      billing_type: validated.billing_type ?? 'one_time',
      billing_cycle: validated.billing_cycle ?? 'monthly',
      monthly_price: validated.monthly_price,
      minimum_contract_months: validated.minimum_contract_months ?? 12,
      default_unit_price_point_day: validated.default_unit_price_point_day,
      default_billing_days: validated.default_billing_days,
      default_quantity_points: validated.default_quantity_points ?? 1,
      // Commission tracking - defaults to true
      counts_for_commission: validated.counts_for_commission ?? true,
    }])
    .select(`
      *,
      category:product_categories(id, name, color)
    `)
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
