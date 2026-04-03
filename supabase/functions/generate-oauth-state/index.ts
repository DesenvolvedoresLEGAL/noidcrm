import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate HMAC-SHA256 signature
async function generateHMAC(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { provider, origin, return_path } = await req.json();
    
    if (!provider || !['gmail', 'google-calendar'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Provedor inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate cryptographically secure nonce
    const nonce = crypto.randomUUID();
    
    // Store nonce in database with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    const { error: insertError } = await supabase
      .from('oauth_nonces')
      .insert({
        user_id: user.id,
        nonce,
        provider,
        expires_at: expiresAt
      });

    if (insertError) {
      console.error('[generate-oauth-state] Failed to store nonce:', insertError);
      return new Response(
        JSON.stringify({ error: 'Falha ao gerar estado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate HMAC signature
    const hmacSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const message = `${user.id}:${nonce}:${provider}`;
    const signature = await generateHMAC(message, hmacSecret);

    // Create signed state parameter
    const stateData = {
      user_id: user.id,
      nonce,
      provider,
      signature
    };
    
    const state = btoa(JSON.stringify(stateData));

    console.log('[generate-oauth-state] Generated secure state for user:', user.id, 'provider:', provider);

    return new Response(
      JSON.stringify({ state }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('[generate-oauth-state] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao gerar estado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
