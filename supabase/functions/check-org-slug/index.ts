import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug } = await req.json();

    // Validação
    if (!slug || typeof slug !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Slug é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanSlug = slug.toLowerCase().trim();
    if (cleanSlug.length < 3 || cleanSlug.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Slug deve ter entre 3 e 50 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      return new Response(
        JSON.stringify({ error: 'Slug deve conter apenas letras minúsculas, números e hífens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar disponibilidade COM SERVICE ROLE (ignora RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error) {
      console.error('Error checking slug:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({ available: !data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
