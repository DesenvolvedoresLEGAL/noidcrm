import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { title, date, time, duration } = await req.json();

    // Validação de entrada
    if (!title || !date || !time || !duration) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar link do Google Meet (UUID único)
    // Em produção real, isso integraria com a API do Google Calendar
    // Por ora, geramos um link simulado baseado em UUID
    const meetId = crypto.randomUUID().split('-')[0];
    const meetLink = `https://meet.google.com/${meetId}`;

    console.log('Generated Google Meet link:', {
      user_id: user.id,
      title,
      date,
      time,
      duration,
      meetLink
    });

    return new Response(
      JSON.stringify({
        success: true,
        meetLink,
        message: 'Google Meet link generated successfully'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error generating Google Meet link:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate Google Meet link',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
