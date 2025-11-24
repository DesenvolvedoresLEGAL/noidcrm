import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    // Get email sync config
    const { data: emailConfig } = await supabase
      .from('email_sync_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('sync_enabled', true)
      .maybeSingle();

    if (!emailConfig) {
      return new Response(
        JSON.stringify({ message: 'No active email sync configuration' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = new Date();
    let itemsProcessed = 0;
    let itemsCreated = 0;

    try {
      // Fetch recent emails from Gmail API
      const gmailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${Math.floor(new Date(emailConfig.last_sync_at || emailConfig.sync_from_date).getTime() / 1000)}`,
        { headers: { Authorization: `Bearer ${emailConfig.access_token_encrypted}` } }
      );

      const gmailData = await gmailResponse.json();

      if (gmailData.messages) {
        for (const message of gmailData.messages.slice(0, 50)) { // Limit to 50 per sync
          itemsProcessed++;

          // Get message details
          const messageResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            { headers: { Authorization: `Bearer ${emailConfig.access_token_encrypted}` } }
          );
          const messageData = await messageResponse.json();

          // Extract headers
          const headers = messageData.payload.headers;
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(no subject)';
          const from = headers.find((h: any) => h.name === 'From')?.value || '';
          const to = headers.find((h: any) => h.name === 'To')?.value || '';
          const date = headers.find((h: any) => h.name === 'Date')?.value || '';

          // Try to match email to contacts/opportunities
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, account_id, emails')
            .eq('organization_id', emailConfig.organization_id)
            .contains('emails', [from.match(/<(.+)>/)?.[1] || from]);

          if (contacts && contacts.length > 0) {
            const contact = contacts[0];

            // Find related opportunities
            const { data: opportunities } = await supabase
              .from('opportunities')
              .select('id')
              .eq('contact_id', contact.id)
              .eq('organization_id', emailConfig.organization_id)
              .limit(1);

            // Create activity for this email
            const { error: activityError } = await supabase
              .from('activities')
              .insert({
                organization_id: emailConfig.organization_id,
                owner_user_id: user.id,
                contact_id: contact.id,
                account_id: contact.account_id,
                opportunity_id: opportunities?.[0]?.id,
                type: 'email',
                title: `Email: ${subject}`,
                description: `From: ${from}\nTo: ${to}`,
                sync_source: 'email',
                sync_provider: 'gmail',
                external_id: message.id,
                external_link: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
                sync_metadata: { subject, from, to, date },
                scheduled_date: new Date(date).toISOString(),
                status: 'completed',
                completed_at: new Date(date).toISOString(),
              })
              .select();

            if (!activityError) itemsCreated++;
          }
        }
      }

      // Update last sync time
      await supabase
        .from('email_sync_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', emailConfig.id);

      // Log sync
      await supabase
        .from('sync_logs')
        .insert({
          organization_id: emailConfig.organization_id,
          user_id: user.id,
          sync_type: 'email',
          provider: emailConfig.provider,
          status: 'success',
          items_processed: itemsProcessed,
          items_created: itemsCreated,
          completed_at: new Date().toISOString(),
        });

      console.log('[sync-emails] Sync completed:', { itemsProcessed, itemsCreated });

      return new Response(
        JSON.stringify({ 
          success: true, 
          itemsProcessed, 
          itemsCreated,
          message: `Synced ${itemsCreated} new email activities from ${itemsProcessed} emails`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (syncError) {
      console.error('[sync-emails] Sync error:', syncError);

      // Log failed sync
      await supabase
        .from('sync_logs')
        .insert({
          organization_id: emailConfig.organization_id,
          user_id: user.id,
          sync_type: 'email',
          provider: emailConfig.provider,
          status: 'failed',
          items_processed: itemsProcessed,
          items_created: itemsCreated,
          error_message: syncError instanceof Error ? syncError.message : String(syncError),
          completed_at: new Date().toISOString(),
        });

      throw syncError;
    }
  } catch (error) {
    console.error('[sync-emails] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to sync emails' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});