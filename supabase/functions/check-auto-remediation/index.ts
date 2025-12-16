import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    console.log('Starting auto-remediation check...');

    // Get all active triggers
    const { data: triggers, error: triggersError } = await supabase
      .from('auto_remediation_triggers')
      .select('*')
      .eq('is_active', true);

    if (triggersError) {
      console.error('Error fetching triggers:', triggersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch triggers' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${triggers?.length || 0} active triggers`);

    let executedCount = 0;
    let skippedCount = 0;

    for (const trigger of triggers || []) {
      const conditions = trigger.trigger_conditions || {};
      
      // Build query for opportunities matching conditions
      let query = supabase
        .from('opportunities')
        .select(`
          id, 
          title, 
          opportunity_score, 
          days_in_stage, 
          organization_id,
          owner_user_id,
          health_score_drivers!inner(driver_name, remediation_priority)
        `)
        .eq('organization_id', trigger.organization_id)
        .eq('status', 'open');

      // Apply conditions
      if (conditions.health_score_below) {
        query = query.lt('opportunity_score', conditions.health_score_below);
      }
      if (conditions.days_in_stage_above) {
        query = query.gt('days_in_stage', conditions.days_in_stage_above);
      }

      const { data: matchingOpportunities, error: oppError } = await query;

      if (oppError) {
        console.error(`Error querying opportunities for trigger ${trigger.id}:`, oppError);
        continue;
      }

      console.log(`Trigger "${trigger.name}": ${matchingOpportunities?.length || 0} matching opportunities`);

      for (const opp of matchingOpportunities || []) {
        // Check if specific driver is required
        if (conditions.driver_present) {
          const hasDriver = opp.health_score_drivers?.some(
            (d: any) => d.driver_name === conditions.driver_present
          );
          if (!hasDriver) continue;
        }

        // Check cooldown
        const { data: recentExecutions } = await supabase
          .from('auto_remediation_executions')
          .select('id, created_at')
          .eq('trigger_id', trigger.id)
          .eq('opportunity_id', opp.id)
          .gte('created_at', new Date(Date.now() - trigger.cooldown_hours * 60 * 60 * 1000).toISOString());

        if (recentExecutions && recentExecutions.length > 0) {
          console.log(`Skipping ${opp.id} - cooldown active`);
          skippedCount++;
          continue;
        }

        // Check max triggers per deal
        const { count: totalTriggers } = await supabase
          .from('auto_remediation_executions')
          .select('*', { count: 'exact', head: true })
          .eq('trigger_id', trigger.id)
          .eq('opportunity_id', opp.id);

        if (totalTriggers && totalTriggers >= trigger.max_triggers_per_deal) {
          console.log(`Skipping ${opp.id} - max triggers reached`);
          skippedCount++;
          continue;
        }

        // Get current drivers for context
        const { data: currentDrivers } = await supabase
          .from('health_score_drivers')
          .select('*')
          .eq('opportunity_id', opp.id);

        // Execute remediation based on action type
        let playbookExecutionId = null;

        if (trigger.action_type === 'execute_playbook' && trigger.playbook_id) {
          // Create playbook execution
          const { data: execution, error: execError } = await supabase
            .from('playbook_executions')
            .insert({
              organization_id: opp.organization_id,
              playbook_id: trigger.playbook_id,
              opportunity_id: opp.id,
              assigned_to: opp.owner_user_id,
              status: 'active',
              trigger_source: 'auto_remediation',
              context_data: {
                trigger_id: trigger.id,
                health_score: opp.opportunity_score,
                drivers: currentDrivers
              }
            })
            .select()
            .single();

          if (!execError && execution) {
            playbookExecutionId = execution.id;
            console.log(`Created playbook execution ${execution.id} for opportunity ${opp.id}`);
          }
        } else if (trigger.action_type === 'create_activity') {
          const activityConfig = trigger.action_config || {};
          await supabase
            .from('activities')
            .insert({
              organization_id: opp.organization_id,
              opportunity_id: opp.id,
              owner_user_id: opp.owner_user_id,
              title: activityConfig.title || `Auto: ${trigger.name}`,
              type: activityConfig.type || 'task',
              status: 'pending',
              scheduled_date: new Date(Date.now() + (activityConfig.days_offset || 1) * 24 * 60 * 60 * 1000).toISOString(),
              is_automated: true,
              ai_generated: true,
              description: `Atividade criada automaticamente pela regra "${trigger.name}" devido a health score de ${opp.opportunity_score}`
            });
        } else if (trigger.action_type === 'notify') {
          await supabase
            .from('notifications')
            .insert({
              organization_id: opp.organization_id,
              user_id: opp.owner_user_id,
              type: 'auto_remediation',
              title: `Alerta: ${opp.title}`,
              message: `Health score crítico (${opp.opportunity_score}). ${trigger.description || 'Ação necessária.'}`,
              metadata: {
                opportunity_id: opp.id,
                trigger_id: trigger.id,
                health_score: opp.opportunity_score
              }
            });
        } else if (trigger.action_type === 'escalate') {
          // Find manager to escalate to
          const { data: member } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', opp.organization_id)
            .in('org_role', ['owner', 'admin', 'manager'])
            .neq('user_id', opp.owner_user_id)
            .limit(1)
            .maybeSingle();

          if (member) {
            await supabase
              .from('notifications')
              .insert({
                organization_id: opp.organization_id,
                user_id: member.user_id,
                type: 'escalation',
                title: `Escalação: ${opp.title}`,
                message: `Deal com health score crítico (${opp.opportunity_score}) requer atenção.`,
                metadata: {
                  opportunity_id: opp.id,
                  original_owner: opp.owner_user_id,
                  health_score: opp.opportunity_score
                }
              });
          }
        }

        // Log the execution
        await supabase
          .from('auto_remediation_executions')
          .insert({
            organization_id: opp.organization_id,
            trigger_id: trigger.id,
            opportunity_id: opp.id,
            health_score_at_trigger: opp.opportunity_score,
            drivers_at_trigger: currentDrivers,
            playbook_id: trigger.playbook_id,
            playbook_execution_id: playbookExecutionId,
            status: 'triggered'
          });

        // Update trigger stats
        await supabase
          .from('auto_remediation_triggers')
          .update({
            trigger_count: (trigger.trigger_count || 0) + 1,
            last_triggered_at: new Date().toISOString()
          })
          .eq('id', trigger.id);

        executedCount++;
      }
    }

    console.log(`Auto-remediation complete. Executed: ${executedCount}, Skipped: ${skippedCount}`);

    return new Response(JSON.stringify({
      success: true,
      executed: executedCount,
      skipped: skippedCount,
      triggersChecked: triggers?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-auto-remediation:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
