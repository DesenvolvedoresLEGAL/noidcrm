import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require internal secret for cron-only function
  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const nowISO = now.toISOString();
    
    // Grace period: 7 days after trial expiration
    const gracePeriodDays = 7;
    // Data deletion: 30 days after trial expiration
    const dataDeletionDays = 30;

    console.log('========================================');
    console.log('🔄 EXPIRE-TRIALS: Starting check at', nowISO);
    console.log('========================================');

    // Buscar orgs com trial expirado (status ainda é 'trial' mas trial_ends_at já passou)
    const { data: expiredOrgs, error: selectError } = await supabase
      .from('organizations')
      .select('id, name, current_plan_id, slug, trial_ends_at')
      .eq('status', 'trial')
      .lt('trial_ends_at', nowISO);

    if (selectError) {
      console.error('❌ Error fetching expired orgs:', selectError);
      throw selectError;
    }

    console.log(`📊 Found ${expiredOrgs?.length || 0} organizations with expired trials`);

    if (!expiredOrgs || expiredOrgs.length === 0) {
      console.log('✅ No expired trials to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          expired: 0,
          processed: 0,
          timestamp: nowISO,
          message: 'No expired trials found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    const processedOrgs: string[] = [];

    for (const org of expiredOrgs) {
      try {
        console.log(`\n🏢 Processing org: ${org.name} (${org.slug})`);
        console.log(`   Trial ended at: ${org.trial_ends_at}`);

        // Calculate grace period and data deletion dates based on trial_ends_at
        const trialEndDate = new Date(org.trial_ends_at);
        const gracePeriodEndsAt = new Date(trialEndDate);
        gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + gracePeriodDays);
        
        const dataDeletionAt = new Date(trialEndDate);
        dataDeletionAt.setDate(dataDeletionAt.getDate() + dataDeletionDays);

        console.log(`   Grace period ends: ${gracePeriodEndsAt.toISOString()}`);
        console.log(`   Data deletion at: ${dataDeletionAt.toISOString()}`);

        // 1. Update organization status to 'suspended'
        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            status: 'suspended',
            // Keep trial_ends_at for historical reference
          })
          .eq('id', org.id);

        if (updateError) {
          console.error(`   ❌ Error updating org ${org.slug}:`, updateError);
          continue;
        }

        console.log(`   ✅ Organization status updated to 'suspended'`);

        // 2. Create trial_block record
        const { error: blockError } = await supabase
          .from('trial_blocks')
          .insert({
            organization_id: org.id,
            blocked_at: nowISO,
            reason: 'trial_expired',
            grace_period_ends_at: gracePeriodEndsAt.toISOString(),
            data_deletion_scheduled_at: dataDeletionAt.toISOString(),
          });

        if (blockError) {
          console.error(`   ⚠️ Error creating trial_block for ${org.slug}:`, blockError);
          // Don't fail the whole process, the org is already suspended
        } else {
          console.log(`   ✅ Trial block record created`);
        }

        // 3. Log in audit_log
        const { error: auditError } = await supabase
          .from('audit_log')
          .insert({
            organization_id: org.id,
            action: 'trial.expired',
            entity_type: 'organization',
            entity_id: org.id,
            metadata: { 
              previous_plan: org.current_plan_id, 
              previous_status: 'trial',
              new_status: 'suspended',
              org_name: org.name,
              org_slug: org.slug,
              trial_ended_at: org.trial_ends_at,
              grace_period_ends_at: gracePeriodEndsAt.toISOString(),
              data_deletion_scheduled_at: dataDeletionAt.toISOString(),
              processed_at: nowISO,
            },
          });

        if (auditError) {
          console.error(`   ⚠️ Error logging audit for org ${org.slug}:`, auditError);
        } else {
          console.log(`   ✅ Audit log created`);
        }

        console.log(`   ✅ Trial expired: ${org.name} (${org.slug}) → SUSPENDED`);
        processedCount++;
        processedOrgs.push(org.slug);

      } catch (error) {
        console.error(`   ❌ Failed to process org ${org.slug}:`, error);
      }
    }

    console.log('\n========================================');
    console.log(`✅ EXPIRE-TRIALS: Completed`);
    console.log(`   Total expired: ${expiredOrgs.length}`);
    console.log(`   Processed: ${processedCount}`);
    console.log(`   Organizations: ${processedOrgs.join(', ')}`);
    console.log('========================================');

    return new Response(
      JSON.stringify({ 
        success: true, 
        expired: expiredOrgs.length,
        processed: processedCount,
        timestamp: nowISO,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});