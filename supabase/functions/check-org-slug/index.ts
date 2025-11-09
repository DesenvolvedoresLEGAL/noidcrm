import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting store (in-memory for simple implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // Max 10 requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute in milliseconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const now = Date.now();
    const rateLimitData = rateLimitStore.get(clientIP);

    if (rateLimitData) {
      if (now < rateLimitData.resetTime) {
        if (rateLimitData.count >= RATE_LIMIT) {
          console.warn(`[check-org-slug] Rate limit exceeded for IP: ${clientIP}`);
          return new Response(
            JSON.stringify({ error: 'Muitas requisições. Tente novamente em instantes.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        rateLimitData.count++;
      } else {
        rateLimitData.count = 1;
        rateLimitData.resetTime = now + RATE_WINDOW;
      }
    } else {
      rateLimitStore.set(clientIP, { count: 1, resetTime: now + RATE_WINDOW });
    }

    const { slug } = await req.json();

    // Enhanced validation
    if (!slug || typeof slug !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Slug é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanSlug = slug.toLowerCase().trim();
    
    // Strict length validation
    if (cleanSlug.length < 3 || cleanSlug.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Slug deve ter entre 3 e 50 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strict character validation - only alphanumeric and hyphens
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      return new Response(
        JSON.stringify({ error: 'Slug deve conter apenas letras minúsculas, números e hífens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent SQL injection patterns
    const dangerousPatterns = ['--', ';', '/*', '*/', 'union', 'select', 'drop', 'delete', 'insert'];
    if (dangerousPatterns.some(pattern => cleanSlug.includes(pattern))) {
      console.warn(`[check-org-slug] Dangerous pattern detected in slug: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Slug inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-org-slug] Checking slug: ${cleanSlug} from IP: ${clientIP}`);

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
  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao verificar slug' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
