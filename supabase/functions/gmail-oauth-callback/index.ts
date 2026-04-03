import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify HMAC-SHA256 signature
async function verifyHMAC(message: string, signature: string, secret: string): Promise<boolean> {
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
  
  const calculatedSig = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(calculatedSig));
  const calculatedHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return calculatedHex === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Missing code or state parameters');
    }

    // Decode and validate state parameter
    let stateData: { user_id: string; nonce: string; provider: string; signature: string };
    try {
      stateData = JSON.parse(atob(state));
      
      if (!stateData.user_id || !stateData.nonce || !stateData.signature || !stateData.provider) {
        throw new Error('Invalid state format');
      }
      
      if (stateData.provider !== 'gmail') {
        throw new Error('Provider mismatch');
      }
    } catch (e) {
      console.error('[gmail-oauth-callback] Invalid state parameter:', e);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${Deno.env.get('APP_URL')}/app/settings/integrations?sync=gmail&status=error&message=invalid_state`,
        },
      });
    }

    const { user_id, nonce, signature } = stateData;

    // Verify HMAC signature
    const hmacSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const message = `${user_id}:${nonce}:gmail`;
    const isValidSignature = await verifyHMAC(message, signature, hmacSecret);

    if (!isValidSignature) {
      console.error('[gmail-oauth-callback] Invalid HMAC signature');
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${Deno.env.get('APP_URL')}/app/settings/integrations?sync=gmail&status=error&message=invalid_signature`,
        },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate nonce exists, is not used, and not expired
    const { data: nonceRecord, error: nonceError } = await supabase
      .from('oauth_nonces')
      .select('*')
      .eq('nonce', nonce)
      .eq('user_id', user_id)
      .eq('provider', 'gmail')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (nonceError || !nonceRecord) {
      console.error('[gmail-oauth-callback] Invalid or expired nonce:', nonceError);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${Deno.env.get('APP_URL')}/app/settings/integrations?sync=gmail&status=error&message=expired_or_used`,
        },
      });
    }

    // Mark nonce as used (one-time use)
    await supabase
      .from('oauth_nonces')
      .update({ used_at: new Date().toISOString() })
      .eq('id', nonceRecord.id);

    // Exchange code for tokens with Google OAuth
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-oauth-callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('[gmail-oauth-callback] Token exchange error:', tokens.error);
      throw new Error(tokens.error_description || tokens.error);
    }

    // Get user's email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user_id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('User organization not found');
    }

    // Store config (tokens should be encrypted in production)
    const { error } = await supabase
      .from('email_sync_config')
      .upsert({
        user_id,
        organization_id: profile.organization_id,
        provider: 'gmail',
        email_address: userInfo.email,
        access_token_encrypted: tokens.access_token,
        refresh_token_encrypted: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        sync_enabled: true,
      });

    if (error) {
      console.error('[gmail-oauth-callback] Database error:', error);
      throw error;
    }

    console.log('[gmail-oauth-callback] Successfully stored Gmail sync config for user:', user_id);

    // Determine redirect URL - use origin from state or fallback to APP_URL
    const appUrl = stateData.origin || Deno.env.get('APP_URL') || '';
    const redirectPath = stateData.return_path || '/app/settings/integrations';

    // Redirect back to app with success
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${appUrl}${redirectPath}?sync=gmail&status=success`,
      },
    });
  } catch (error) {
    console.error('[gmail-oauth-callback] Error:', error);
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('APP_URL')}/app/settings/integrations?sync=gmail&status=error`,
      },
    });
  }
});
