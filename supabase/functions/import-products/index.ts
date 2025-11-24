import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductImportRow {
  name: string;
  type: 'produto' | 'servico';
  code?: string;
  reference?: string;
  category?: string;
  description?: string;
  unit: string;
  cost?: number;
  price?: number;
  ipi_percent?: number;
  active: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { products } = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Invalid products data');
    }

    // Validar limite
    if (products.length > 1000) {
      throw new Error('Maximum 1000 products per import');
    }

    // Buscar organização do usuário
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('User organization not found');
    }

    const organizationId = profile.organization_id;

    // Buscar categorias existentes
    const { data: categories } = await supabaseClient
      .from('product_categories')
      .select('id, name')
      .eq('organization_id', organizationId);

    const categoryMap = new Map(
      categories?.map(c => [c.name.toLowerCase(), c.id]) || []
    );

    const results = {
      success: 0,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Processar produtos em lotes de 50
    const batchSize = 50;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const productsToInsert = batch.map((row: ProductImportRow, index: number) => {
        try {
          // Validações
          if (!row.name || row.name.trim().length === 0) {
            throw new Error(`Row ${i + index + 1}: Name is required`);
          }

          if (row.name.length > 200) {
            throw new Error(`Row ${i + index + 1}: Name too long (max 200 chars)`);
          }

          if (!['produto', 'servico'].includes(row.type)) {
            throw new Error(`Row ${i + index + 1}: Invalid type (must be 'produto' or 'servico')`);
          }

          // Buscar categoria se fornecida
          let categoryId = null;
          if (row.category) {
            categoryId = categoryMap.get(row.category.toLowerCase());
            if (!categoryId) {
              results.warnings.push(`Row ${i + index + 1}: Category '${row.category}' not found, skipping`);
            }
          }

          return {
            organization_id: organizationId,
            name: row.name.trim(),
            type: row.type,
            code: row.code?.trim() || null,
            reference: row.reference?.trim() || null,
            category_id: categoryId,
            description: row.description?.trim() || null,
            unit: row.unit || 'un',
            cost: row.cost || null,
            price: row.price || null,
            ipi_percent: row.ipi_percent || 0,
            active: row.active !== false,
          };
        } catch (error) {
          results.errors.push((error as Error).message);
          return null;
        }
      }).filter(p => p !== null);

      if (productsToInsert.length > 0) {
        const { error } = await supabaseClient
          .from('products')
          .insert(productsToInsert);

        if (error) {
          console.error('Batch insert error:', error);
          results.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          results.success += productsToInsert.length;
        }
      }
    }

    console.log('Import completed:', results);

    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
