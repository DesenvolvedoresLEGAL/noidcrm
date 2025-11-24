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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find scheduled exports that need to run
    const now = new Date().toISOString();
    const { data: scheduledExports, error: fetchError } = await supabaseClient
      .from('scheduled_exports')
      .select(`
        *,
        template:template_id (
          entity_type,
          format,
          columns,
          filters
        )
      `)
      .eq('is_active', true)
      .lte('next_run_at', now);

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled exports: ${fetchError.message}`);
    }

    console.log(`Found ${scheduledExports?.length || 0} exports to run`);

    const results = [];

    for (const scheduledExport of scheduledExports || []) {
      try {
        // Create export log
        const { data: exportLog, error: logError } = await supabaseClient
          .from('export_logs')
          .insert({
            organization_id: scheduledExport.organization_id,
            scheduled_export_id: scheduledExport.id,
            template_id: scheduledExport.template_id,
            entity_type: scheduledExport.template.entity_type,
            format: scheduledExport.template.format,
            status: 'processing',
          })
          .select('id')
          .single();

        if (logError) {
          console.error('Failed to create export log:', logError);
          continue;
        }

        // Fetch data from the entity
        const columns = scheduledExport.template.columns || [];
        const filters = scheduledExport.template.filters || {};

        let query = supabaseClient
          .from(scheduledExport.template.entity_type)
          .select(columns.join(', '))
          .eq('organization_id', scheduledExport.organization_id);

        // Apply filters
        Object.entries(filters).forEach(([key, value]: [string, any]) => {
          if (value !== null && value !== undefined && value !== '') {
            query = query.eq(key, value);
          }
        });

        const { data, error: dataError } = await query;

        if (dataError) {
          throw new Error(`Failed to fetch data: ${dataError.message}`);
        }

        // Generate export file (simplified - would need actual file generation)
        const recordCount = data?.length || 0;

        // Update export log
        await supabaseClient
          .from('export_logs')
          .update({
            status: 'completed',
            record_count: recordCount,
            completed_at: new Date().toISOString(),
          })
          .eq('id', exportLog.id);

        // Calculate next run time based on cron expression
        const nextRunAt = calculateNextRun(scheduledExport.cron_expression);

        // Update scheduled export
        await supabaseClient
          .from('scheduled_exports')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRunAt,
            run_count: (scheduledExport.run_count || 0) + 1,
          })
          .eq('id', scheduledExport.id);

        // TODO: Send email with export file
        // This would call the send-export-email function

        results.push({
          id: scheduledExport.id,
          name: scheduledExport.name,
          status: 'completed',
          recordCount,
        });

      } catch (error: any) {
        console.error(`Failed to execute export ${scheduledExport.id}:`, error);
        
        // Update export log with error
        await supabaseClient
          .from('export_logs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
          })
          .eq('scheduled_export_id', scheduledExport.id)
          .eq('status', 'processing');

        results.push({
          id: scheduledExport.id,
          name: scheduledExport.name,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        executed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Scheduled export execution error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to execute scheduled exports' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Simple cron parser - calculates next run (simplified version)
function calculateNextRun(cronExpression: string): string {
  // For simplicity, add 1 day to current time
  // In production, use a proper cron parser library
  const next = new Date();
  
  if (cronExpression.includes('daily') || cronExpression.includes('0 0 * * *')) {
    next.setDate(next.getDate() + 1);
  } else if (cronExpression.includes('weekly') || cronExpression.includes('0 0 * * 0')) {
    next.setDate(next.getDate() + 7);
  } else if (cronExpression.includes('monthly') || cronExpression.includes('0 0 1 * *')) {
    next.setMonth(next.getMonth() + 1);
  } else {
    // Default: 1 hour
    next.setHours(next.getHours() + 1);
  }
  
  return next.toISOString();
}
