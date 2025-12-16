import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, playbook_id, opportunity_id, execution_id, user_id, organization_id, outcome, feedback, effectiveness_rating } = await req.json();

    console.log(`[execute-playbook] Action: ${action}, Playbook: ${playbook_id}, Opportunity: ${opportunity_id}`);

    if (action === 'start') {
      // Get playbook details
      const { data: playbook, error: playbookError } = await supabase
        .from('ai_playbooks')
        .select('*, playbook_versions!current_version_id(*)')
        .eq('id', playbook_id)
        .single();

      if (playbookError || !playbook) {
        console.error('[execute-playbook] Playbook not found:', playbookError);
        return new Response(JSON.stringify({ error: 'Playbook not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get opportunity snapshot
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('id, title, valor_previsto, stage_id, temperature, prob, status')
        .eq('id', opportunity_id)
        .single();

      // Create execution record
      const { data: execution, error: execError } = await supabase
        .from('playbook_executions')
        .insert({
          playbook_id,
          opportunity_id,
          organization_id,
          playbook_version_id: playbook.current_version_id,
          version_number: playbook.version || 1,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          cost_hours: playbook.estimated_hours || 2,
          deal_snapshot: opportunity || {},
          current_step: 0,
          steps_completed: [],
        })
        .select()
        .single();

      if (execError) {
        console.error('[execute-playbook] Error creating execution:', execError);
        return new Response(JSON.stringify({ error: 'Failed to create execution' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[execute-playbook] Execution started: ${execution.id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        execution_id: execution.id,
        playbook_name: playbook.name,
        steps: playbook.steps,
        version: playbook.version,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'complete_step') {
      const { step_index, step_data } = await req.json();

      const { data: execution } = await supabase
        .from('playbook_executions')
        .select('steps_completed')
        .eq('id', execution_id)
        .single();

      const stepsCompleted = execution?.steps_completed || [];
      stepsCompleted.push({ step_index, completed_at: new Date().toISOString(), ...step_data });

      await supabase
        .from('playbook_executions')
        .update({ 
          steps_completed: stepsCompleted,
          current_step: step_index + 1,
        })
        .eq('id', execution_id);

      console.log(`[execute-playbook] Step ${step_index} completed for execution ${execution_id}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'finish') {
      // Get execution with deal snapshot
      const { data: execution } = await supabase
        .from('playbook_executions')
        .select('*, ai_playbooks(*)')
        .eq('id', execution_id)
        .single();

      if (!execution) {
        return new Response(JSON.stringify({ error: 'Execution not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if opportunity was won
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('status, valor_previsto')
        .eq('id', execution.opportunity_id)
        .single();

      const converted = opportunity?.status === 'won';
      const revenueGenerated = converted ? (opportunity?.valor_previsto || 0) : 0;
      
      // Calculate cycle time
      const startedAt = new Date(execution.started_at);
      const finishedAt = new Date();
      const cycleTimeDays = (finishedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24);

      // Calculate ROI
      const costHours = execution.cost_hours || execution.ai_playbooks?.estimated_hours || 2;
      const roiValue = costHours > 0 ? revenueGenerated / costHours : 0;

      // Update execution
      await supabase
        .from('playbook_executions')
        .update({
          status: 'completed',
          outcome: outcome || (converted ? 'success' : 'neutral'),
          finished_at: finishedAt.toISOString(),
          converted,
          revenue_generated: revenueGenerated,
          roi_value: roiValue,
          cycle_time_days: cycleTimeDays,
          effectiveness_rating: effectiveness_rating || null,
          feedback: feedback || null,
        })
        .eq('id', execution_id);

      console.log(`[execute-playbook] Execution ${execution_id} finished. Converted: ${converted}, Revenue: ${revenueGenerated}, ROI: ${roiValue}`);

      // Log system event
      await supabase.from('system_events').insert({
        organization_id: execution.organization_id,
        event_type: 'playbook_execution_completed',
        event_category: 'automation',
        entity_type: 'playbook_execution',
        entity_id: execution_id,
        actor_type: 'system',
        payload: {
          playbook_id: execution.playbook_id,
          opportunity_id: execution.opportunity_id,
          converted,
          revenue_generated: revenueGenerated,
          roi_value: roiValue,
          cycle_time_days: cycleTimeDays,
        },
      });

      return new Response(JSON.stringify({ 
        success: true, 
        converted,
        revenue_generated: revenueGenerated,
        roi_value: roiValue,
        cycle_time_days: cycleTimeDays,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[execute-playbook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
