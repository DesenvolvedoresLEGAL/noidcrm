import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = claims.claims.sub as string;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { organization_id, include_deleted = false } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller belongs to this organization with admin/owner role
    const { data: membership } = await supabase
      .from('organization_members')
      .select('org_role')
      .eq('user_id', callerUserId)
      .eq('organization_id', organization_id)
      .eq('status', 'active')
      .in('org_role', ['owner', 'admin'])
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: you must be admin/owner of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[export-backup] User ${callerUserId} exporting org ${organization_id}`);

    const { data: backupRecord, error: backupError } = await supabase
      .from('backup_history')
      .insert({
        organization_id,
        backup_type: 'export',
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (backupError) {
      console.error('[export-backup] Error creating backup record:', backupError);
      throw backupError;
    }

    const [
      opportunitiesResult,
      proposalsResult,
      accountsResult,
      contactsResult,
      activitiesResult,
      pipelinesResult,
      stagesResult,
    ] = await Promise.all([
      include_deleted 
        ? supabase.from('opportunities').select('*').eq('organization_id', organization_id)
        : supabase.from('opportunities').select('*').eq('organization_id', organization_id).is('deleted_at', null),
      supabase.from('proposals').select('*').eq('organization_id', organization_id),
      include_deleted
        ? supabase.from('accounts').select('*').eq('organization_id', organization_id)
        : supabase.from('accounts').select('*').eq('organization_id', organization_id).is('deleted_at', null),
      include_deleted
        ? supabase.from('contacts').select('*').eq('organization_id', organization_id)
        : supabase.from('contacts').select('*').eq('organization_id', organization_id).is('deleted_at', null),
      include_deleted
        ? supabase.from('activities').select('*').eq('organization_id', organization_id)
        : supabase.from('activities').select('*').eq('organization_id', organization_id).is('deleted_at', null),
      supabase.from('pipelines').select('*').eq('organization_id', organization_id),
      supabase.from('pipeline_stages').select('*').eq('organization_id', organization_id),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      organization_id,
      include_deleted,
      data: {
        opportunities: opportunitiesResult.data || [],
        proposals: proposalsResult.data || [],
        accounts: accountsResult.data || [],
        contacts: contactsResult.data || [],
        activities: activitiesResult.data || [],
        pipelines: pipelinesResult.data || [],
        pipeline_stages: stagesResult.data || [],
      },
      counts: {
        opportunities: opportunitiesResult.data?.length || 0,
        proposals: proposalsResult.data?.length || 0,
        accounts: accountsResult.data?.length || 0,
        contacts: contactsResult.data?.length || 0,
        activities: activitiesResult.data?.length || 0,
        pipelines: pipelinesResult.data?.length || 0,
        pipeline_stages: stagesResult.data?.length || 0,
      },
    };

    await supabase
      .from('backup_history')
      .update({
        status: 'completed',
        entities_count: exportData.counts,
        completed_at: new Date().toISOString(),
      })
      .eq('id', backupRecord.id);

    return new Response(
      JSON.stringify(exportData),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="backup-${organization_id}-${new Date().toISOString().split('T')[0]}.json"`,
        } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[export-backup] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
