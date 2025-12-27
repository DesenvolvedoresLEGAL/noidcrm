import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();

    // 1. Find organizations with expiring trials
    const alertDays = [7, 5, 3, 1];
    let alertsSent = 0;
    let trialsBlocked = 0;

    for (const days of alertDays) {
      const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

      // Find orgs expiring on this day
      const { data: expiringOrgs, error: expiringError } = await supabaseAdmin
        .from('organizations')
        .select('id, name, trial_ends_at')
        .eq('status', 'trial')
        .gte('trial_ends_at', startOfDay)
        .lte('trial_ends_at', endOfDay);

      if (expiringError) {
        console.error(`[Trial Alerts] Error fetching orgs for day ${days}:`, expiringError);
        continue;
      }

      for (const org of expiringOrgs || []) {
        const notificationType = `day_${days}` as 'day_7' | 'day_5' | 'day_3' | 'day_1';

        // Check if notification already sent
        const { data: existingNotif } = await supabaseAdmin
          .from('trial_notifications')
          .select('id')
          .eq('organization_id', org.id)
          .eq('notification_type', notificationType)
          .maybeSingle();

        if (!existingNotif) {
          // Insert notification record
          const { error: insertError } = await supabaseAdmin
            .from('trial_notifications')
            .insert({
              organization_id: org.id,
              notification_type: notificationType,
              channel: 'in_app',
              metadata: {
                org_name: org.name,
                days_remaining: days,
                trial_ends_at: org.trial_ends_at,
              },
            });

          if (!insertError) {
            alertsSent++;
            console.log(`[Trial Alerts] Sent day_${days} alert to org ${org.id}`);
          }
        }
      }
    }

    // 2. Find and block expired trials
    const { data: expiredOrgs, error: expiredError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, trial_ends_at')
      .eq('status', 'trial')
      .lt('trial_ends_at', now.toISOString());

    if (expiredError) {
      console.error('[Trial Alerts] Error fetching expired orgs:', expiredError);
    } else {
      for (const org of expiredOrgs || []) {
        // Check if already blocked
        const { data: existingBlock } = await supabaseAdmin
          .from('trial_blocks')
          .select('id')
          .eq('organization_id', org.id)
          .is('unblocked_at', null)
          .maybeSingle();

        if (!existingBlock) {
          // Create block record
          const { error: blockError } = await supabaseAdmin
            .from('trial_blocks')
            .insert({
              organization_id: org.id,
              reason: 'trial_expired',
              grace_period_ends_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              data_deletion_scheduled_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            });

          if (!blockError) {
            // Update org status
            await supabaseAdmin
              .from('organizations')
              .update({ status: 'suspended' })
              .eq('id', org.id);

            // Insert expired notification
            await supabaseAdmin
              .from('trial_notifications')
              .insert({
                organization_id: org.id,
                notification_type: 'expired',
                channel: 'in_app',
                metadata: {
                  org_name: org.name,
                  blocked_at: now.toISOString(),
                },
              });

            // PROMPT MASTER: Trigger trial_expired lifecycle event for PLG opportunity
            try {
              await supabaseAdmin.functions.invoke('trial-lifecycle-events', {
                body: {
                  organization_id: org.id,
                  event_type: 'trial_expired'
                }
              });
              console.log(`[Trial Alerts] Triggered trial_expired event for org ${org.id}`);
            } catch (lifecycleError) {
              console.error(`[Trial Alerts] Failed to trigger lifecycle event for org ${org.id}:`, lifecycleError);
            }

            trialsBlocked++;
            console.log(`[Trial Alerts] Blocked expired trial for org ${org.id}`);
          }
        }
      }
    }

    console.log(`[Trial Alerts] Completed: ${alertsSent} alerts sent, ${trialsBlocked} trials blocked`);

    return new Response(
      JSON.stringify({
        success: true,
        alertsSent,
        trialsBlocked,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Trial Alerts] Fatal error:', error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
