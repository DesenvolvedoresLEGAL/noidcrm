import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { user_id } = JSON.parse(atob(state));

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-oauth-callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Get primary calendar info
    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const calendar = await calendarResponse.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user_id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('User organization not found');
    }

    // Store config
    const { error } = await supabase
      .from('calendar_sync_config')
      .upsert({
        user_id,
        organization_id: profile.organization_id,
        provider: 'google',
        calendar_id: calendar.id,
        calendar_name: calendar.summary,
        access_token_encrypted: tokens.access_token,
        refresh_token_encrypted: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        sync_enabled: true,
      });

    if (error) throw error;

    console.log('[google-calendar-oauth-callback] Successfully stored Calendar sync config for user:', user_id);

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('APP_URL')}/app/settings/integrations?sync=calendar&status=success`,
      },
    });
  } catch (error) {
    console.error('[google-calendar-oauth-callback] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to complete Calendar authorization' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});