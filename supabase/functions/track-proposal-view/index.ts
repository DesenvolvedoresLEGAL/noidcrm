import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { proposalId, metadata } = await req.json();

    if (!proposalId) {
      throw new Error('proposalId is required');
    }

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
