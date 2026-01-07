import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Calculate time window for reminders (activities happening in next 10-20 minutes)
    const now = new Date();
    const startWindow = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
    const endWindow = new Date(now.getTime() + 20 * 60 * 1000); // 20 minutes from now

    // Find activities that need reminders
    const { data: activities, error: fetchError } = await supabase
      .from('activities')
      .select(`
        id,
        title,
        type,
        scheduled_date,
        owner_user_id,
        organization_id,
        profiles:owner_user_id (
          full_name,
          email
        )
      `)
      .eq('status', 'pending')
      .gte('scheduled_date', startWindow.toISOString())
      .lte('scheduled_date', endWindow.toISOString());

    if (fetchError) throw fetchError;

    console.log(`[activity-reminders] Found ${activities?.length || 0} activities needing reminders`);

    let remindersSent = 0;
    let errors = 0;

    // Send reminders for each activity
    for (const activity of activities || []) {
      try {
        const profile = Array.isArray(activity.profiles) 
          ? activity.profiles[0] 
          : activity.profiles;

        if (!profile?.email) {
          console.warn(`[activity-reminders] No email for activity ${activity.id}`);
          continue;
        }

        // Insert notification record
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: activity.owner_user_id,
            organization_id: activity.organization_id,
            type: 'activity_reminder',
            title: 'Lembrete de Atividade',
            message: `Sua atividade "${activity.title}" começa em 15 minutos`,
            metadata: {
              activity_id: activity.id,
              activity_type: activity.type,
              scheduled_date: activity.scheduled_date,
            },
            read: false,
          });

        if (notifError) {
          console.error(`[activity-reminders] Failed to create notification:`, notifError);
          errors++;
          continue;
        }

        remindersSent++;
        console.log(`[activity-reminders] Sent reminder for activity ${activity.id} to ${profile.email}`);
      } catch (error) {
        console.error(`[activity-reminders] Error processing activity ${activity.id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent,
        errors,
        timestamp: now.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[activity-reminders] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process reminders' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
