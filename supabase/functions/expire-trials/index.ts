import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date().toISOString();

    console.log('Checking for expired trials...', now);

    // Buscar orgs com trial expirado
    const { data: expiredOrgs, error: selectError } = await supabase
      .from('organizations')
      .select('id, name, current_plan_id, slug')
      .eq('status', 'trial')
      .lt('trial_ends_at', now);

    if (selectError) {
      console.error('Error fetching expired orgs:', selectError);
      throw selectError;
    }

    console.log(`Found ${expiredOrgs?.length || 0} expired trials`);

    let processedCount = 0;

    for (const org of expiredOrgs || []) {
      try {
        // Downgrade para free
        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            current_plan_id: 'free',
            status: 'active',
            trial_ends_at: null,
          })
          .eq('id', org.id);

        if (updateError) {
          console.error(`Error updating org ${org.slug}:`, updateError);
          continue;
        }

        // Log em audit_log
        const { error: auditError } = await supabase
          .from('audit_log')
          .insert({
            organization_id: org.id,
            action: 'trial.expired',
            metadata: { 
              previous_plan: org.current_plan_id, 
              downgraded_to: 'free',
              org_name: org.name,
              org_slug: org.slug,
            },
          });

        if (auditError) {
          console.error(`Error logging audit for org ${org.slug}:`, auditError);
        }

        console.log(`✅ Trial expirado: ${org.name} (${org.slug}) → downgraded to free`);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process org ${org.slug}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        expired: expiredOrgs?.length || 0,
        processed: processedCount,
        timestamp: now,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
