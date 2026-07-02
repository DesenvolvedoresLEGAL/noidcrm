import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal secret for CRON calls
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!authHeaderCheck && (!internalSecret || !expectedSecret || internalSecret !== expectedSecret)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const startWindow = new Date(now.getTime() + 10 * 60 * 1000);
    const endWindow = new Date(now.getTime() + 20 * 60 * 1000);

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
        email_subject,
        email_body,
        email_to,
        email_cc,
        email_sent,
        opportunity_id,
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

    // Pre-fetch parent opportunities to skip closed (won/lost) or deleted ones
    const oppIds = Array.from(new Set((activities || [])
      .map((a: any) => a.opportunity_id)
      .filter(Boolean))) as string[];
    const closedOppIds = new Set<string>();
    if (oppIds.length > 0) {
      const { data: oppsRows } = await supabase
        .from('opportunities')
        .select('id, status, deleted_at')
        .in('id', oppIds);
      for (const o of oppsRows || []) {
        if (o.status !== 'open' || o.deleted_at) closedOppIds.add(o.id);
      }
    }

    let remindersSent = 0;
    let emailsSent = 0;
    let errors = 0;

    for (const activity of activities || []) {
      try {
        // Skip activities tied to closed/deleted opportunities
        if (activity.opportunity_id && closedOppIds.has(activity.opportunity_id)) {
          // Auto-cancel pending activity to stop future reminders & free the queue
          await supabase
            .from('activities')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancellation_reason: 'Oportunidade encerrada (won/lost) — atividade cancelada automaticamente',
            })
            .eq('id', activity.id);
          console.log(`[activity-reminders] Skipped+cancelled activity ${activity.id} (opp closed)`);
          continue;
        }

        const profile = Array.isArray(activity.profiles) 
          ? activity.profiles[0] 
          : activity.profiles;

        // AUTO-SEND: If it's an email activity with content, send it
        if (activity.type === 'email' && !activity.email_sent && activity.email_to?.length > 0 && activity.email_subject && activity.email_body) {
          try {
            // Get user's SMTP config
            const { data: smtpConfig } = await supabase
              .from('user_smtp_configs')
              .select('*')
              .eq('user_id', activity.owner_user_id)
              .eq('is_active', true)
              .single();

            if (smtpConfig) {
              const client = new SmtpClient();
              const connectConfig: any = {
                hostname: smtpConfig.smtp_host,
                port: smtpConfig.smtp_port,
                username: smtpConfig.smtp_user,
                password: smtpConfig.smtp_password_encrypted,
              };

              if (smtpConfig.smtp_port === 465) {
                await client.connectTLS(connectConfig);
              } else {
                await client.connect(connectConfig);
              }

              let finalBody = activity.email_body;
              if (smtpConfig.signature_html) {
                finalBody += `<br/><br/>--<br/>${smtpConfig.signature_html}`;
              }

              const fromAddress = smtpConfig.from_name
                ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
                : smtpConfig.from_email;

              await client.send({
                from: fromAddress,
                to: activity.email_to.join(','),
                ...(activity.email_cc?.length ? { cc: activity.email_cc.join(',') } : {}),
                subject: activity.email_subject,
                content: "text/html",
                html: finalBody,
              } as any);

              await client.close();

              // Mark email as sent
              await supabase
                .from('activities')
                .update({ email_sent: true, completed_at: new Date().toISOString(), status: 'completed' })
                .eq('id', activity.id);

              // Log to opportunity_emails if linked
              if (activity.opportunity_id) {
                await supabase.from('opportunity_emails').insert({
                  opportunity_id: activity.opportunity_id,
                  organization_id: activity.organization_id,
                  subject: activity.email_subject,
                  body: finalBody,
                  from_email: smtpConfig.from_email,
                  to_emails: activity.email_to,
                  cc_emails: activity.email_cc || [],
                  sent_by: activity.owner_user_id,
                  sent_at: new Date().toISOString(),
                });
              }

              emailsSent++;
              console.log(`[activity-reminders] Auto-sent email for activity ${activity.id}`);
              continue; // Skip notification for auto-sent emails
            }
          } catch (emailError) {
            console.error(`[activity-reminders] Failed to auto-send email for activity ${activity.id}:`, emailError);
          }
        }

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
        emailsSent,
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
