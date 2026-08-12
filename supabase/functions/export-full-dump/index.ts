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
] as const;

const TABLE_ALLOWLIST = new Set<string>(TABLES_TO_EXPORT);
const GLOBAL_REFERENCE_TABLES = new Set(['plans', 'plan_entitlements']);

type ExportOptions = {
  include_deleted: boolean;
  tables: string[];
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function validateAdminAndGetOrg(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Unauthorized');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseAuth.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new HttpError(401, 'Unauthorized');
  }

  const userId = data.claims.sub as string;
  const supabaseAdmin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: member, error: memberError } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, org_role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('org_role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle();

  if (memberError) {
    console.error('[export-full-dump] Membership lookup failed:', memberError);
    throw new HttpError(500, 'Unable to validate organization membership');
  }

  if (!member) {
    throw new HttpError(403, 'Forbidden: admin/owner role required');
  }

  return { userId, supabaseAdmin, organizationId: member.organization_id };
}

function parseOptions(body: unknown): ExportOptions {
  const raw = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const includeDeleted = raw.include_deleted === true;
  const requestedTables = Array.isArray(raw.tables)
    ? raw.tables.filter((value): value is string => typeof value === 'string')
    : [];

  const invalidTables = requestedTables.filter((table) => !TABLE_ALLOWLIST.has(table));
  if (invalidTables.length > 0) {
    throw new HttpError(400, `Unsupported export table(s): ${invalidTables.join(', ')}`);
  }

  return {
    include_deleted: includeDeleted,
    tables: requestedTables,
  };
}

async function getOrganizationUserIds(supabaseAdmin: ReturnType<typeof createClient>, organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Unable to resolve tenant members: ${error.message}`);
  }

  return (data || [])
    .map((row: { user_id?: string | null }) => row.user_id)
    .filter((userId: string | null | undefined): userId is string => Boolean(userId));
}

function buildScopedQuery(
  supabaseAdmin: ReturnType<typeof createClient>,
  tableName: string,
  organizationId: string,
  organizationUserIds: string[],
  includeDeleted: boolean,
) {
  let query = supabaseAdmin.from(tableName).select('*');

  if (tableName === 'organizations') {
    query = query.eq('id', organizationId);
  } else if (tableName === 'profiles') {
    if (organizationUserIds.length === 0) {
      return query.in('user_id', ['00000000-0000-0000-0000-000000000000']);
    }
    query = query.in('user_id', organizationUserIds);
  } else if (!GLOBAL_REFERENCE_TABLES.has(tableName)) {
    query = query.eq('organization_id', organizationId);
  }

  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

  return query;
}

function buildScopedRetryQuery(
  supabaseAdmin: ReturnType<typeof createClient>,
  tableName: string,
  organizationId: string,
  organizationUserIds: string[],
) {
  let query = supabaseAdmin.from(tableName).select('*');

  if (tableName === 'organizations') {
    return query.eq('id', organizationId);
  }

  if (tableName === 'profiles') {
    if (organizationUserIds.length === 0) {
      return query.in('user_id', ['00000000-0000-0000-0000-000000000000']);
    }
    return query.in('user_id', organizationUserIds);
  }

  if (!GLOBAL_REFERENCE_TABLES.has(tableName)) {
    return query.eq('organization_id', organizationId);
  }

  return query;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId, supabaseAdmin, organizationId } = await validateAdminAndGetOrg(req);

    console.log(`[export-full-dump] Export by user ${userId} for org ${organizationId}`);

    let rawBody: unknown = {};
    try {
      rawBody = await req.json();
    } catch {
      // Empty body means default export options.
    }

    const options = parseOptions(rawBody);
    const tablesToExport = options.tables.length > 0
      ? options.tables
      : [...TABLES_TO_EXPORT];

    const organizationUserIds = await getOrganizationUserIds(supabaseAdmin, organizationId);

    const exportData: Record<string, unknown[]> = {};
    const errors: Record<string, string> = {};
    const counts: Record<string, number> = {};

    for (const tableName of tablesToExport) {
      try {
        const query = buildScopedQuery(
          supabaseAdmin,
          tableName,
          organizationId,
          organizationUserIds,
          options.include_deleted,
        );
        const { data, error } = await query;

        if (error) {
          if (!options.include_deleted && error.message?.includes('deleted_at')) {
            const retryQuery = buildScopedRetryQuery(
              supabaseAdmin,
              tableName,
              organizationId,
              organizationUserIds,
            );
            const { data: retryData, error: retryError } = await retryQuery;

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
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (status >= 500) {
      console.error('[export-full-dump] Error:', message);
    }

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
