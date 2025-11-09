import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // Max 5 views per minute per IP per proposal
const RATE_WINDOW = 60000; // 1 minute

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposalId, metadata } = await req.json();

    // Input validation
    if (!proposalId || typeof proposalId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'ID da proposta inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(proposalId)) {
      return new Response(
        JSON.stringify({ error: 'Formato de ID inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting by IP + proposalId
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const rateLimitKey = `${clientIP}:${proposalId}`;
    const now = Date.now();
    const rateLimitData = rateLimitStore.get(rateLimitKey);

    if (rateLimitData) {
      if (now < rateLimitData.resetTime) {
        if (rateLimitData.count >= RATE_LIMIT) {
          console.warn(`[track-proposal-view] Rate limit exceeded for ${rateLimitKey}`);
          return new Response(
            JSON.stringify({ error: 'Muitas visualizações. Aguarde um momento.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        rateLimitData.count++;
      } else {
        rateLimitData.count = 1;
        rateLimitData.resetTime = now + RATE_WINDOW;
      }
    } else {
      rateLimitStore.set(rateLimitKey, { count: 1, resetTime: now + RATE_WINDOW });
    }

    console.log(`[track-proposal-view] Tracking view for proposal ${proposalId} from IP ${clientIP}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Insert view record
    const { error: viewError } = await supabaseClient
      .from('proposal_views')
      .insert({
        proposal_id: proposalId,
        viewer_ip: metadata?.ip,
        viewer_user_agent: metadata?.userAgent,
      });

    if (viewError) throw viewError;

    // Update proposal views count
    const { data: current, error: fetchError } = await supabaseClient
      .from('proposals')
      .select('views_count')
      .eq('id', proposalId)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabaseClient
      .from('proposals')
      .update({
        views_count: (current?.views_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    if (updateError) throw updateError;

    console.log('View tracked successfully for proposal:', proposalId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error tracking proposal view:', error);
    // Return generic error to avoid information leakage
    return new Response(
      JSON.stringify({ error: 'Erro ao registrar visualização' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
