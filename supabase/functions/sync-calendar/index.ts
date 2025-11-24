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

    // Get calendar sync config
    const { data: calendarConfig } = await supabase
      .from('calendar_sync_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('sync_enabled', true)
      .maybeSingle();

    if (!calendarConfig) {
      return new Response(
        JSON.stringify({ message: 'No active calendar sync configuration' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let itemsProcessed = 0;
    let itemsCreated = 0;

    try {
      // Fetch upcoming events from Google Calendar
      const timeMin = new Date(calendarConfig.last_sync_at || calendarConfig.sync_from_date).toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

      const calendarResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`,
        { headers: { Authorization: `Bearer ${calendarConfig.access_token_encrypted}` } }
      );

      const calendarData = await calendarResponse.json();

      if (calendarData.items) {
        for (const event of calendarData.items) {
          itemsProcessed++;

          // Skip all-day events or events without attendees
          if (!event.start?.dateTime || !event.attendees) continue;

          // Extract attendee emails
          const attendeeEmails = event.attendees.map((a: any) => a.email);

          // Try to match attendees to contacts
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, account_id, emails, nome')
            .eq('organization_id', calendarConfig.organization_id)
            .overlaps('emails', attendeeEmails);

          if (contacts && contacts.length > 0) {
            const contact = contacts[0];

            // Find related opportunities
            const { data: opportunities } = await supabase
              .from('opportunities')
              .select('id')
              .eq('contact_id', contact.id)
              .eq('organization_id', calendarConfig.organization_id)
              .limit(1);

            // Create activity for this meeting
            const { error: activityError } = await supabase
              .from('activities')
              .insert({
                organization_id: calendarConfig.organization_id,
                owner_user_id: user.id,
                contact_id: contact.id,
                account_id: contact.account_id,
                opportunity_id: opportunities?.[0]?.id,
                type: 'meeting',
                title: event.summary || '(No title)',
                description: event.description || `Meeting with ${contact.nome}`,
                sync_source: 'calendar',
                sync_provider: 'google',
                external_id: event.id,
                external_link: event.htmlLink,
                sync_metadata: {
                  location: event.location,
                  attendees: event.attendees,
                  conferenceData: event.conferenceData,
                },
                scheduled_date: event.start.dateTime,
                status: new Date(event.start.dateTime) < new Date() ? 'completed' : 'pending',
                completed_at: new Date(event.start.dateTime) < new Date() ? event.end.dateTime : null,
              })
              .select();

            if (!activityError) itemsCreated++;
          }
        }
      }

      // Update last sync time
      await supabase
        .from('calendar_sync_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', calendarConfig.id);

      // Log sync
      await supabase
        .from('sync_logs')
        .insert({
          organization_id: calendarConfig.organization_id,
          user_id: user.id,
          sync_type: 'calendar',
          provider: calendarConfig.provider,
          status: 'success',
          items_processed: itemsProcessed,
          items_created: itemsCreated,
          completed_at: new Date().toISOString(),
        });

      console.log('[sync-calendar] Sync completed:', { itemsProcessed, itemsCreated });

      return new Response(
        JSON.stringify({ 
          success: true, 
          itemsProcessed, 
          itemsCreated,
          message: `Synced ${itemsCreated} new calendar activities from ${itemsProcessed} events`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (syncError) {
      console.error('[sync-calendar] Sync error:', syncError);

      await supabase
        .from('sync_logs')
        .insert({
          organization_id: calendarConfig.organization_id,
          user_id: user.id,
          sync_type: 'calendar',
          provider: calendarConfig.provider,
          status: 'failed',
          items_processed: itemsProcessed,
          items_created: itemsCreated,
          error_message: syncError instanceof Error ? syncError.message : String(syncError),
          completed_at: new Date().toISOString(),
        });

      throw syncError;
    }
  } catch (error) {
    console.error('[sync-calendar] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to sync calendar' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});