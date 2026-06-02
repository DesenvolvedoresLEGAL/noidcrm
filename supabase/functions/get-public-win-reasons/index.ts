import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, pipelineId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active win reasons for the organization (only client-facing)
    let query = supabase
      .from('win_reasons')
      .select('id, name, category, pipeline_ids')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .in('audience', ['client', 'both'])
      .order('name', { ascending: true });

    const { data: reasons, error } = await query;

    if (error) {
      console.error('Error fetching win reasons:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch win reasons' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter by pipeline if provided
    let filteredReasons = reasons || [];
    if (pipelineId) {
      filteredReasons = filteredReasons.filter(reason => 
        reason.pipeline_ids === null || 
        reason.pipeline_ids.length === 0 || 
        reason.pipeline_ids.includes(pipelineId)
      );
    }

    // Map to simple format for the client
    const formattedReasons = filteredReasons.map(r => ({
      id: r.id,
      label: r.name,
      category: r.category,
    }));

    console.log(`[get-public-win-reasons] Returning ${formattedReasons.length} reasons for org ${organizationId}`);

    return new Response(
      JSON.stringify({ reasons: formattedReasons }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-public-win-reasons:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
