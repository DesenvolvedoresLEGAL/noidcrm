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

  // Auth guard: require internal cron secret OR an authenticated user JWT
  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  const authHeader = req.headers.get('authorization');
  const hasInternal = expectedSecret && internalSecret === expectedSecret;
  const hasAuth = !!authHeader && authHeader.toLowerCase().startsWith('bearer ');
  if (!hasInternal && !hasAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let organizationId: string | null = null;
    let buildType = 'full';

    // Check if called with specific organization or as CRON for all
    const body = await req.json().catch(() => ({}));
    organizationId = body.organization_id || null;
    buildType = body.build_type || 'full';

    console.log(`[Knowledge Graph] Starting build - org: ${organizationId || 'ALL'}, type: ${buildType}`);

    // Get organizations to process
    let organizations: { id: string; name: string }[] = [];
    
    if (organizationId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', organizationId)
        .single();
      if (org) organizations = [org];
    } else {
      // CRON: process all active organizations
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('status', 'active');
      organizations = orgs || [];
    }

    console.log(`[Knowledge Graph] Processing ${organizations.length} organizations`);

    const results: Array<{
      organization_id: string;
      organization_name: string;
      build_id: string | null;
      nodes_created: number;
      edges_created: number;
      insights_generated: number;
      duration_ms: number;
      status: string;
      error?: string;
    }> = [];

    for (const org of organizations) {
      const startTime = Date.now();
      
      try {
        // Execute graph build function
        const { data: buildId, error: buildError } = await supabase.rpc(
          'build_knowledge_graph',
          { p_organization_id: org.id, p_build_type: buildType }
        );

        if (buildError) {
          console.error(`[Knowledge Graph] Build failed for ${org.name}:`, buildError);
          results.push({
            organization_id: org.id,
            organization_name: org.name,
            build_id: null,
            nodes_created: 0,
            edges_created: 0,
            insights_generated: 0,
            duration_ms: Date.now() - startTime,
            status: 'failed',
            error: buildError.message
          });
          continue;
        }

        // Generate insights after build
        const { data: insightsCount, error: insightsError } = await supabase.rpc(
          'generate_graph_insights',
          { p_organization_id: org.id, p_build_id: buildId }
        );

        if (insightsError) {
          console.warn(`[Knowledge Graph] Insights generation warning for ${org.name}:`, insightsError);
        }

        // Get build stats
        const { data: buildStats } = await supabase
          .from('graph_builds')
          .select('nodes_created, nodes_updated, edges_created, edges_updated, insights_generated, duration_ms')
          .eq('id', buildId)
          .single();

        console.log(`[Knowledge Graph] Completed for ${org.name}: ${buildStats?.nodes_created || 0} nodes, ${buildStats?.edges_created || 0} edges, ${insightsCount || 0} insights`);

        results.push({
          organization_id: org.id,
          organization_name: org.name,
          build_id: buildId,
          nodes_created: buildStats?.nodes_created || 0,
          edges_created: buildStats?.edges_created || 0,
          insights_generated: insightsCount || 0,
          duration_ms: buildStats?.duration_ms || (Date.now() - startTime),
          status: 'completed'
        });

      } catch (orgError) {
        console.error(`[Knowledge Graph] Error processing ${org.name}:`, orgError);
        results.push({
          organization_id: org.id,
          organization_name: org.name,
          build_id: null,
          nodes_created: 0,
          edges_created: 0,
          insights_generated: 0,
          duration_ms: Date.now() - startTime,
          status: 'error',
          error: orgError instanceof Error ? orgError.message : 'Unknown error'
        });
      }
    }

    const summary = {
      total_organizations: organizations.length,
      successful: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status !== 'completed').length,
      total_nodes: results.reduce((sum, r) => sum + r.nodes_created, 0),
      total_edges: results.reduce((sum, r) => sum + r.edges_created, 0),
      total_insights: results.reduce((sum, r) => sum + r.insights_generated, 0),
      results
    };

    console.log(`[Knowledge Graph] Build complete - ${summary.successful}/${summary.total_organizations} successful`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Knowledge Graph] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
