import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json();

    if (provider !== 'google') {
      throw new Error('Unsupported provider');
    }

    // Return only the public client ID, never the secret
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');

    if (!clientId) {
      throw new Error('OAuth configuration not found');
    }

    console.log('[get-oauth-config] Providing OAuth config for provider:', provider);

    return new Response(
      JSON.stringify({ clientId }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('[get-oauth-config] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get OAuth configuration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
