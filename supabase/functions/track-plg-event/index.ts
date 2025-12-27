import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Event point values
const EVENT_POINTS: Record<string, Record<string, number>> = {
  activation: {
    org_created: 5,
    user_invited: 10,
    first_core_action: 10,
  },
  engagement: {
    session_start: 1,
    active_day: 2,
  },
  adoption: {
    feature_used: 5,
  },
  intent: {
    pricing_viewed: 5,
    upgrade_clicked: 8,
    contact_requested: 7,
  },
};

// Feature category mapping
const FEATURE_CATEGORIES: Record<string, string> = {
  opportunities: 'core',
  activities: 'core',
  contacts: 'core',
  proposals: 'core',
  accounts: 'core',
  automation: 'advanced',
  scoring: 'advanced',
  reports: 'advanced',
  territories: 'advanced',
  workflows: 'advanced',
  ai_coach: 'premium',
  roleplay: 'premium',
  forecast: 'premium',
  integrations: 'premium',
  playbooks: 'premium',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      organization_id, 
      user_id, 
      opportunity_id,
      event_type, 
      event_name, 
      feature_name,
      metadata = {},
      recalculate = true,
    } = await req.json();

    if (!organization_id || !event_type || !event_name) {
      throw new Error('organization_id, event_type, and event_name are required');
    }

    console.log(`[TRACK-PLG] Tracking event: ${event_type}/${event_name} for org: ${organization_id}`);

    // Determine event category and points
    let eventCategory: string | null = null;
    let points = 0;

    // If it's a feature usage event, determine category from feature name
    if (event_type === 'adoption' && feature_name) {
      eventCategory = FEATURE_CATEGORIES[feature_name] || 'core';
      points = EVENT_POINTS.adoption?.feature_used || 5;
    } else {
      // Get points from event points mapping
      points = EVENT_POINTS[event_type]?.[event_name] || 0;
    }

    // Check for duplicate event (prevent double tracking)
    const { data: existingEvent } = await supabase
      .from('plg_events')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('event_type', event_type)
      .eq('event_name', event_name)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Within last minute
      .limit(1)
      .single();

    if (existingEvent && ['org_created', 'first_core_action', 'pricing_viewed', 'upgrade_clicked', 'contact_requested'].includes(event_name)) {
      console.log(`[TRACK-PLG] Duplicate one-time event detected, skipping: ${event_name}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Event already tracked', duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert PLG event
    const { data: insertedEvent, error: insertError } = await supabase
      .from('plg_events')
      .insert({
        organization_id,
        user_id: user_id || null,
        opportunity_id: opportunity_id || null,
        event_type,
        event_name: feature_name || event_name,
        event_category: eventCategory,
        points,
        metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[TRACK-PLG] Error inserting event:', insertError);
      throw insertError;
    }

    console.log(`[TRACK-PLG] Event tracked successfully: ${insertedEvent.id}`);

    // Trigger PLG score recalculation if requested
    if (recalculate) {
      console.log(`[TRACK-PLG] Triggering PLG score recalculation...`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/calculate-plg-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ organization_id, opportunity_id }),
        });

        const result = await response.json();
        console.log(`[TRACK-PLG] PLG score recalculation result:`, result);
      } catch (calcError) {
        console.error('[TRACK-PLG] Error triggering recalculation:', calcError);
        // Don't fail the event tracking if recalculation fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          event_id: insertedEvent.id,
          organization_id,
          event_type,
          event_name: feature_name || event_name,
          event_category: eventCategory,
          points,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[TRACK-PLG] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
