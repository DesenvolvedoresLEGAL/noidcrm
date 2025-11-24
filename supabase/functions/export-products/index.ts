import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { format = 'csv', filters = {} } = await req.json();

    // Buscar organização
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('User organization not found');
    }

    // Buscar produtos com categorias
    let query = supabaseClient
      .from('products')
      .select(`
        *,
        product_categories (
          name,
          color
        )
      `)
      .eq('organization_id', profile.organization_id)
      .order('name');

    // Aplicar filtros
    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }
    if (filters.category_id && filters.category_id !== 'all') {
      query = query.eq('category_id', filters.category_id);
    }
    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }

    const { data: products, error } = await query;

    if (error) {
      throw error;
    }

    if (format === 'csv') {
      // Gerar CSV
      const headers = [
        'Nome',
        'Tipo',
        'Código',
        'Referência',
        'Categoria',
        'Descrição',
        'Unidade',
        'Custo',
        'Preço',
        'IPI %',
        'Status',
      ];

      const rows = products.map(p => [
        p.name,
        p.type === 'produto' ? 'Produto' : 'Serviço',
        p.code || '',
        p.reference || '',
        p.product_categories?.name || '',
        p.description || '',
        p.unit,
        p.cost || '',
        p.price || '',
        p.ipi_percent || 0,
        p.active ? 'Ativo' : 'Inativo',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="produtos_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (format === 'json') {
      return new Response(JSON.stringify(products, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="produtos_${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    } else {
      throw new Error('Invalid format. Supported: csv, json');
    }
  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
