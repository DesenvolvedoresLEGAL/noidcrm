import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function validateAdminAccess(req: Request) {
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

  // Verify admin/owner role via organization_members
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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
    const { userId, supabaseAdmin, organizationId: callerOrgId } = await validateAdminAccess(req);

    const { action, emails, organizationId } = await req.json();
    const results: any[] = [];

    if (action === 'delete_users') {
      for (const email of emails) {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (user) {
          // Verify user belongs to caller's org
          const { data: targetMember } = await supabaseAdmin
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('organization_id', callerOrgId)
            .single();

          if (!targetMember) {
            results.push({ email, deleted: false, error: 'User not in your organization' });
            continue;
          }

          await supabaseAdmin.from('onboarding_status').delete().eq('user_id', user.id);
          await supabaseAdmin.from('organization_members').delete().eq('user_id', user.id);
          await supabaseAdmin.from('profiles').delete().eq('user_id', user.id);
          
          const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);

          // Audit log
          await supabaseAdmin.from('audit_log').insert({
            action: 'admin_delete_user',
            actor_user_id: userId,
            entity_type: 'user',
            entity_id: user.id,
            organization_id: callerOrgId,
            metadata: { target_email_hash: email.substring(0, 3) + '***' },
          });

          results.push({ email, deleted: !error, error: error?.message });
        } else {
          results.push({ email, deleted: false, error: 'User not found' });
        }
      }
    }

    if (action === 'delete_organization' && organizationId) {
      // Only allow deleting caller's own org
      if (organizationId !== callerOrgId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot delete another organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const orgId = organizationId;
      
      try {
        const { data: stages } = await supabaseAdmin
          .from('stages')
          .select('id')
          .eq('organization_id', orgId);
        
        const stageIds = stages?.map(s => s.id) || [];
        
        const { data: pipelines } = await supabaseAdmin
          .from('pipelines')
          .select('id')
          .eq('organization_id', orgId);
        
        const pipelineIds = pipelines?.map(p => p.id) || [];
        
        await supabaseAdmin.from('opportunities').delete().eq('organization_id', orgId);
        if (stageIds.length > 0) {
          await supabaseAdmin.from('opportunities').delete().in('stage_id', stageIds);
        }
        if (pipelineIds.length > 0) {
          await supabaseAdmin.from('opportunities').delete().in('pipeline_id', pipelineIds);
        }
        
        await supabaseAdmin.from('activities').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('contacts').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('account_partners').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('accounts').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('stages').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('pipelines').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('organization_members').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('onboarding_status').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('profiles').update({ organization_id: null }).eq('organization_id', orgId);
        await supabaseAdmin.from('sellers').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('goals').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('activation_checklist').delete().eq('organization_id', orgId);
        
        // Audit log before deleting org
        await supabaseAdmin.from('audit_log').insert({
          action: 'admin_delete_organization',
          actor_user_id: userId,
          entity_type: 'organization',
          entity_id: orgId,
          organization_id: orgId,
        });

        const { error } = await supabaseAdmin.from('organizations').delete().eq('id', orgId);
        
        results.push({ 
          organizationId: orgId, 
          deleted: !error, 
          error: error?.message 
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during org deletion';
        results.push({ 
          organizationId: orgId, 
          deleted: false, 
          error: errorMessage 
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
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
    console.error('Error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
