import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TABLES_TO_EXPORT = [
  'profiles', 'organizations', 'organization_members', 'plans', 'plan_entitlements',
  'business_units', 'teams', 'team_members', 'ote_levels', 'ote_rules', 'settings',
  'custom_fields', 'tags', 'origins', 'origin_groups', 'product_categories',
  'measurement_units', 'products', 'win_reasons', 'loss_reasons',
  'badges', 'achievements', 'missions', 'sellers', 'seller_badges',
  'seller_achievements', 'seller_missions',
  'accounts', 'account_partners', 'contacts', 'pipelines', 'pipeline_stages',
  'opportunities', 'opportunity_contacts', 'opportunity_products', 'opportunity_history',
  'activities', 'activity_participants',
  'proposal_templates', 'proposal_layouts', 'proposals', 'proposal_items',
  'proposal_versions', 'contracts',
  'ai_playbooks', 'playbook_versions', 'playbook_executions', 'auto_tasks_rules',
  'automation_config', 'workflow_rules', 'sequences', 'sequence_steps', 'sequence_enrollments',
  'email_templates', 'email_accounts',
  'performance_activities', 'activity_targets', 'activity_logs', 'attendance',
  'algorithm_versions',
];

async function validateAdminAndGetOrg(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseAuth.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error('UNAUTHORIZED');
  }

  const userId = data.claims.sub as string;

  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Verify admin/owner
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, org_role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('org_role', ['owner', 'admin'])
    .limit(1)
    .single();

  if (!member) {
    throw new Error('FORBIDDEN');
  }

  return { userId, supabaseAdmin, organizationId: member.organization_id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, supabaseAdmin, organizationId } = await validateAdminAndGetOrg(req);

    console.log(`[export-full-dump] Export by user ${userId} for org ${organizationId}`);

    let options = { include_deleted: false, tables: [] as string[] };
    try {
      const body = await req.json();
      options = { ...options, ...body };
    } catch {
      // defaults
    }

    const tablesToExport = options.tables?.length > 0 ? options.tables : TABLES_TO_EXPORT;

    const exportData: Record<string, unknown[]> = {};
    const errors: Record<string, string> = {};
    const counts: Record<string, number> = {};

    // Tables that are org-scoped
    const orgScopedFilter = (tableName: string) => {
      // These tables may not have organization_id
      const noOrgFilter = ['profiles', 'plans', 'plan_entitlements'];
      return !noOrgFilter.includes(tableName);
    };

    for (const tableName of tablesToExport) {
      try {
        let query = supabaseAdmin.from(tableName).select('*');

        // Always scope to organization
        if (orgScopedFilter(tableName)) {
          query = query.eq('organization_id', organizationId);
        }

        if (!options.include_deleted) {
          query = query.is('deleted_at', null);
        }

        const { data, error } = await query;

        if (error) {
          if (error.message?.includes('deleted_at') || error.message?.includes('organization_id')) {
            // Retry without problematic filter
            const { data: retryData, error: retryError } = orgScopedFilter(tableName)
              ? await supabaseAdmin.from(tableName).select('*').eq('organization_id', organizationId)
              : await supabaseAdmin.from(tableName).select('*');

            if (retryError) {
              errors[tableName] = retryError.message;
            } else {
              exportData[tableName] = retryData || [];
              counts[tableName] = retryData?.length || 0;
            }
          } else {
            errors[tableName] = error.message;
          }
        } else {
          exportData[tableName] = data || [];
          counts[tableName] = data?.length || 0;
        }
      } catch (err) {
        errors[tableName] = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`[export-full-dump] Completed. Total records: ${totalRecords}`);

    const result = {
      exported_at: new Date().toISOString(),
      organization_id: organizationId,
      include_deleted: options.include_deleted,
      tables_requested: tablesToExport.length,
      tables_exported: Object.keys(exportData).length,
      total_records: totalRecords,
      counts,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      data: exportData,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="full-dump-${organizationId}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (message === 'FORBIDDEN') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin/owner role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('[export-full-dump] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
