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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all active proposals with layouts
    const { data: proposals, error: fetchError } = await supabaseClient
      .from('proposals')
      .select('id, title, layout_id, status')
      .not('layout_id', 'is', null)
      .in('status', ['draft', 'sent', 'viewed'])
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    console.log(`Found ${proposals?.length || 0} proposals to regenerate`);

    const results: { id: string; title: string; success: boolean; error?: string }[] = [];

    // Process each proposal
    for (const proposal of proposals || []) {
      try {
        console.log(`Regenerating PDF for: ${proposal.title}`);
        
        // Call the generate-proposal-pdf function
        const { data, error } = await supabaseClient.functions.invoke('generate-proposal-pdf', {
          body: { proposalId: proposal.id }
        });

        if (error) {
          results.push({ id: proposal.id, title: proposal.title, success: false, error: error.message });
        } else {
          results.push({ id: proposal.id, title: proposal.title, success: true });
        }
      } catch (err) {
        results.push({ 
          id: proposal.id, 
          title: proposal.title, 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Regeneration complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: proposals?.length || 0,
        successCount,
        failCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error regenerating PDFs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
