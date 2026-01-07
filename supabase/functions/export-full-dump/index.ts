import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// All tables to export (ordered by dependencies)
const TABLES_TO_EXPORT = [
  // Core/Auth related
  'profiles',
  'organizations',
  'organization_members',
  'plans',
  'plan_entitlements',
  
  // Configuration
  'business_units',
  'teams',
  'team_members',
  'ote_levels',
  'ote_rules',
  'settings',
  'custom_fields',
  'tags',
  'origins',
  'origin_groups',
  'product_categories',
  'measurement_units',
  'products',
  'win_reasons',
  'loss_reasons',
  
  // Gamification
  'badges',
  'achievements',
  'missions',
  'sellers',
  'seller_badges',
  'seller_achievements',
  'seller_missions',
  
  // CRM
  'accounts',
  'account_partners',
  'contacts',
  'pipelines',
  'pipeline_stages',
  'opportunities',
  'opportunity_contacts',
  'opportunity_products',
  'opportunity_history',
  'activities',
  'activity_participants',
  
  // Proposals
  'proposal_templates',
  'proposal_layouts',
  'proposals',
  'proposal_items',
  'proposal_versions',
  'contracts',
  
  // Automation & AI
  'ai_playbooks',
  'playbook_versions',
  'playbook_executions',
  'auto_tasks_rules',
  'automation_config',
  'workflow_rules',
  'sequences',
  'sequence_steps',
  'sequence_enrollments',
  
  // Email
  'email_templates',
  'email_accounts',
  
  // Performance
  'performance_activities',
  'activity_targets',
  'activity_logs',
  'attendance',
  
  // Analytics & Logs
  'algorithm_versions',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[export-full-dump] Starting full database export...');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for options
    let options = { include_deleted: false, tables: [] as string[] };
    try {
      const body = await req.json();
      options = { ...options, ...body };
    } catch {
      // No body or invalid JSON, use defaults
    }

    const tablesToExport = options.tables?.length > 0 
      ? options.tables 
      : TABLES_TO_EXPORT;

    console.log(`[export-full-dump] Exporting ${tablesToExport.length} tables...`);

    const exportData: Record<string, unknown[]> = {};
    const errors: Record<string, string> = {};
    const counts: Record<string, number> = {};

    // Export each table
    for (const tableName of tablesToExport) {
      try {
        console.log(`[export-full-dump] Fetching table: ${tableName}`);
        
        let query = supabase.from(tableName).select('*');
        
        // Handle soft-deleted records
        if (!options.include_deleted) {
          // Try to exclude deleted records if the table has deleted_at column
          query = query.is('deleted_at', null);
        }
        
        const { data, error } = await query;
        
        if (error) {
          // If error is about deleted_at column not existing, retry without filter
          if (error.message?.includes('deleted_at')) {
            const { data: retryData, error: retryError } = await supabase
              .from(tableName)
              .select('*');
            
            if (retryError) {
              console.error(`[export-full-dump] Error fetching ${tableName}:`, retryError);
              errors[tableName] = retryError.message;
            } else {
              exportData[tableName] = retryData || [];
              counts[tableName] = retryData?.length || 0;
            }
          } else {
            console.error(`[export-full-dump] Error fetching ${tableName}:`, error);
            errors[tableName] = error.message;
          }
        } else {
          exportData[tableName] = data || [];
          counts[tableName] = data?.length || 0;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[export-full-dump] Exception fetching ${tableName}:`, errorMessage);
        errors[tableName] = errorMessage;
      }
    }

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`[export-full-dump] Export completed. Total records: ${totalRecords}`);

    const result = {
      exported_at: new Date().toISOString(),
      include_deleted: options.include_deleted,
      tables_requested: tablesToExport.length,
      tables_exported: Object.keys(exportData).length,
      total_records: totalRecords,
      counts,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      data: exportData,
    };

    return new Response(
      JSON.stringify(result, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="full-dump-${new Date().toISOString().split('T')[0]}.json"`,
        } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[export-full-dump] Error:', error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
