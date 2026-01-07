import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ObjectionsRequest {
  organizationId: string;
  pipelineId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, pipelineId } = await req.json() as ObjectionsRequest;

    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'organizationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[analyze-objections-heatmap] Analyzing for org: ${organizationId}`);

    // Fetch win/loss records with stages info
    let query = supabase
      .from('win_loss_records')
      .select(`
        *,
        opportunity:opportunities(
          pipeline_id,
          stage_id,
          pipeline:pipelines(name),
          stage:stages(name, order_index)
        )
      `)
      .eq('organization_id', organizationId)
      .eq('outcome', 'lost');

    const { data: records, error: recordsError } = await query;

    if (recordsError) {
      console.error('[analyze-objections-heatmap] Error fetching records:', recordsError);
      throw recordsError;
    }

    // Fetch all stages for the organization
    const { data: stages } = await supabase
      .from('stages')
      .select('id, name, order_index, pipeline_id')
      .order('order_index');

    // Build objections heatmap by stage
    const heatmapData: Record<string, {
      stageName: string;
      stageOrder: number;
      objections: Record<string, number>;
      totalLosses: number;
      factors: {
        price: number;
        timing: number;
        feature: number;
        relationship: number;
      };
    }> = {};

    // Initialize stages
    stages?.forEach(stage => {
      if (!pipelineId || stage.pipeline_id === pipelineId) {
        heatmapData[stage.id] = {
          stageName: stage.name,
          stageOrder: stage.order_index,
          objections: {},
          totalLosses: 0,
          factors: { price: 0, timing: 0, feature: 0, relationship: 0 }
        };
      }
    });

    // Process records
    records?.forEach(record => {
      const stageId = (record.opportunity as any)?.stage_id;
      if (!stageId || !heatmapData[stageId]) return;

      heatmapData[stageId].totalLosses++;

      // Count objections
      const objectionsFaced = record.objections_faced as any[] || [];
      objectionsFaced.forEach((obj: any) => {
        const objName = typeof obj === 'string' ? obj : obj.name || obj.type || 'Outros';
        heatmapData[stageId].objections[objName] = (heatmapData[stageId].objections[objName] || 0) + 1;
      });

      // Count factors
      if (record.price_factor) heatmapData[stageId].factors.price++;
      if (record.timing_factor) heatmapData[stageId].factors.timing++;
      if (record.feature_factor) heatmapData[stageId].factors.feature++;
      if (record.relationship_factor) heatmapData[stageId].factors.relationship++;
    });

    // Convert to array and sort by stage order
    const heatmap = Object.entries(heatmapData)
      .map(([stageId, data]) => ({
        stageId,
        ...data,
        topObjections: Object.entries(data.objections)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }))
      }))
      .sort((a, b) => a.stageOrder - b.stageOrder);

    // Calculate overall statistics
    const totalLosses = records?.length || 0;
    const allObjections: Record<string, number> = {};
    const allFactors = { price: 0, timing: 0, feature: 0, relationship: 0 };

    records?.forEach(record => {
      const objectionsFaced = record.objections_faced as any[] || [];
      objectionsFaced.forEach((obj: any) => {
        const objName = typeof obj === 'string' ? obj : obj.name || obj.type || 'Outros';
        allObjections[objName] = (allObjections[objName] || 0) + 1;
      });

      if (record.price_factor) allFactors.price++;
      if (record.timing_factor) allFactors.timing++;
      if (record.feature_factor) allFactors.feature++;
      if (record.relationship_factor) allFactors.relationship++;
    });

    const topGlobalObjections = Object.entries(allObjections)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ 
        name, 
        count,
        percentage: totalLosses > 0 ? Math.round((count / totalLosses) * 100) : 0
      }));

    // Identify critical stages (high loss concentration)
    const criticalStages = heatmap
      .filter(s => s.totalLosses > 0)
      .sort((a, b) => b.totalLosses - a.totalLosses)
      .slice(0, 3)
      .map(s => ({
        stageId: s.stageId,
        stageName: s.stageName,
        losses: s.totalLosses,
        percentage: totalLosses > 0 ? Math.round((s.totalLosses / totalLosses) * 100) : 0,
        mainFactor: Object.entries(s.factors).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
      }));

    console.log(`[analyze-objections-heatmap] Analysis complete. ${totalLosses} losses across ${heatmap.length} stages`);

    return new Response(JSON.stringify({
      success: true,
      heatmap,
      summary: {
        totalLosses,
        stagesAnalyzed: heatmap.length,
        topGlobalObjections,
        globalFactors: allFactors,
        criticalStages
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[analyze-objections-heatmap] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
