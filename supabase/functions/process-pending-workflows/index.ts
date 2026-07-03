import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Process pending workflow executions automatically
 * This function is called by a CRON job to execute workflows that were queued by database triggers
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  const authHeader = req.headers.get('authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const hasValidInternalSecret = Boolean(expectedSecret && internalSecret && internalSecret === expectedSecret);
  const hasServiceRoleAuth = authHeader === `Bearer ${serviceRoleKey}`;

  if (!hasValidInternalSecret && !hasServiceRoleAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  const startTime = Date.now();
  console.log('[process-pending-workflows] Starting batch processing...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch pending workflow executions (limit to 50 per run)
    // ANTI-DUPLICATION: Only fetch executions with process_count < 3
    const { data: pendingExecutions, error: fetchError } = await supabase
      .from('workflow_executions')
      .select('id, workflow_rule_id, trigger_type, created_at, process_count')
      .eq('status', 'pending')
      .lt('process_count', 3) // Max 3 attempts to prevent infinite reprocessing
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[process-pending-workflows] Error fetching pending:', fetchError);
      throw fetchError;
    }

    // ANTI-DUPLICATION: Mark executions that have exceeded max retries as failed
    const { data: stuckExecutions } = await supabase
      .from('workflow_executions')
      .select('id')
      .eq('status', 'pending')
      .gte('process_count', 3);
    
    if (stuckExecutions && stuckExecutions.length > 0) {
      console.log(`[process-pending-workflows] Marking ${stuckExecutions.length} stuck executions as failed (exceeded max retries)`);
      await supabase
        .from('workflow_executions')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          actions_executed: [{ error: 'Exceeded maximum retry attempts (3)' }]
        })
        .in('id', stuckExecutions.map(e => e.id));
    }

    const totalPending = pendingExecutions?.length || 0;
    console.log(`[process-pending-workflows] Found ${totalPending} pending executions (with process_count < 3)`);

    if (totalPending === 0) {
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let succeeded = 0;
    let failed = 0;
    const results: any[] = [];

    // Process each execution by calling execute-workflow
    for (const execution of pendingExecutions) {
      try {
        // ANTI-DUPLICATION: Increment process_count and mark as running
        const currentProcessCount = (execution.process_count || 0) + 1;
        await supabase
          .from('workflow_executions')
          .update({ 
            status: 'running', 
            started_at: new Date().toISOString(),
            process_count: currentProcessCount
          })
          .eq('id', execution.id)
          .eq('status', 'pending'); // Optimistic lock

        // Call the execute-workflow function
        const internalSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
        
        const execResponse = await fetch(`${supabaseUrl}/functions/v1/execute-workflow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'x-internal-secret': internalSecret || '',
          },
          body: JSON.stringify({ execution_id: execution.id }),
        });

        if (execResponse.ok) {
          succeeded++;
          const result = await execResponse.json();
          results.push({
            execution_id: execution.id,
            trigger_type: execution.trigger_type,
            success: true,
            actions: result.actions_executed?.length || 0,
          });
          console.log(`[process-pending-workflows] Executed ${execution.id}: ${execution.trigger_type}`);
        } else {
          failed++;
          const errorText = await execResponse.text();
          console.error(`[process-pending-workflows] Failed ${execution.id}:`, errorText);
          
          // Mark as failed
          await supabase
            .from('workflow_executions')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString(),
              actions_executed: [{ error: errorText }],
            })
            .eq('id', execution.id);
            
          results.push({
            execution_id: execution.id,
            trigger_type: execution.trigger_type,
            success: false,
            error: errorText.substring(0, 200),
          });
        }
      } catch (error) {
        failed++;
        console.error(`[process-pending-workflows] Error processing ${execution.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('workflow_executions')
          .update({ 
            status: 'failed',
            completed_at: new Date().toISOString(),
            actions_executed: [{ error: String(error) }],
          })
          .eq('id', execution.id);
          
        results.push({
          execution_id: execution.id,
          trigger_type: execution.trigger_type,
          success: false,
          error: String(error).substring(0, 200),
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[process-pending-workflows] Completed: ${succeeded} succeeded, ${failed} failed in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed: totalPending,
      succeeded,
      failed,
      duration_ms: duration,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[process-pending-workflows] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process workflows',
      details: String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
