import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, emails, organizationId } = await req.json();
    const results: any[] = [];

    if (action === 'delete_users') {
      // Delete users by email
      for (const email of emails) {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (user) {
          // Delete related data first
          await supabaseAdmin.from('onboarding_status').delete().eq('user_id', user.id);
          await supabaseAdmin.from('organization_members').delete().eq('user_id', user.id);
          await supabaseAdmin.from('profiles').delete().eq('user_id', user.id);
          
          // Delete auth user
          const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
          results.push({ email, deleted: !error, error: error?.message });
        } else {
          results.push({ email, deleted: false, error: 'User not found' });
        }
      }
    }

    if (action === 'delete_organization' && organizationId) {
      // Delete all organization data in correct order
      const orgId = organizationId;
      
      try {
        // Get all stages for this org first
        const { data: stages } = await supabaseAdmin
          .from('stages')
          .select('id')
          .eq('organization_id', orgId);
        
        const stageIds = stages?.map(s => s.id) || [];
        
        // Get all pipelines
        const { data: pipelines } = await supabaseAdmin
          .from('pipelines')
          .select('id')
          .eq('organization_id', orgId);
        
        const pipelineIds = pipelines?.map(p => p.id) || [];
        
        // Delete all opportunities (directly and via stage)
        await supabaseAdmin.from('opportunities').delete().eq('organization_id', orgId);
        if (stageIds.length > 0) {
          await supabaseAdmin.from('opportunities').delete().in('stage_id', stageIds);
        }
        if (pipelineIds.length > 0) {
          await supabaseAdmin.from('opportunities').delete().in('pipeline_id', pipelineIds);
        }
        
        // Delete activities
        await supabaseAdmin.from('activities').delete().eq('organization_id', orgId);
        
        // Delete contacts
        await supabaseAdmin.from('contacts').delete().eq('organization_id', orgId);
        
        // Delete account_partners (before accounts)
        await supabaseAdmin.from('account_partners').delete().eq('organization_id', orgId);
        
        // Delete accounts
        await supabaseAdmin.from('accounts').delete().eq('organization_id', orgId);
        
        // Delete stages
        await supabaseAdmin.from('stages').delete().eq('organization_id', orgId);
        
        // Delete pipelines
        await supabaseAdmin.from('pipelines').delete().eq('organization_id', orgId);
        
        // Delete organization_members
        await supabaseAdmin.from('organization_members').delete().eq('organization_id', orgId);
        
        // Delete onboarding_status
        await supabaseAdmin.from('onboarding_status').delete().eq('organization_id', orgId);
        
        // Delete profiles with this org
        await supabaseAdmin.from('profiles').update({ organization_id: null }).eq('organization_id', orgId);
        
        // Delete other related tables
        await supabaseAdmin.from('sellers').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('goals').delete().eq('organization_id', orgId);
        await supabaseAdmin.from('activation_checklist').delete().eq('organization_id', orgId);
        
        // Finally delete organization
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
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
