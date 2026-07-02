import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Auto-apply high-confidence AI suggestions
 * Runs via CRON to automatically apply suggestions with confidence > 0.8 after 24h
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[auto-apply-ai-suggestions] Starting auto-apply process...');

  try {
    // Validate internal secret for CRON calls
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!expectedSecret || internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Configurable thresholds
    const CONFIDENCE_THRESHOLD = 0.8;
    const MIN_AGE_HOURS = 24;
    const MAX_SUGGESTIONS_PER_RUN = 20;

    // Fields that must NEVER be auto-applied — user-owned, manual-only.
    // Keeps the suggestion visible in the UI but blocks the CRON from
    // overwriting the value (e.g. proposal saves regenerating suggestions
    // that would otherwise drift the user's expected close date).
    const MANUAL_ONLY_FIELDS = new Set<string>(['close_date_prevista']);

    // Fetch high-confidence suggestions pending for more than 24 hours
    const cutoffTime = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000).toISOString();
    
    const { data: suggestions, error: fetchError } = await supabase
      .from('ai_suggestions')
      .select(`
        *,
        opportunity:opportunities(id, title, organization_id, owner_user_id)
      `)
      .eq('status', 'pending')
      .eq('suggestion_type', 'field_update')
      .gte('confidence_score', CONFIDENCE_THRESHOLD)
      .lt('created_at', cutoffTime)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('confidence_score', { ascending: false })
      .limit(MAX_SUGGESTIONS_PER_RUN);

    if (fetchError) {
      console.error('[auto-apply-ai-suggestions] Error fetching suggestions:', fetchError);
      throw fetchError;
    }

    const totalFound = suggestions?.length || 0;
    console.log(`[auto-apply-ai-suggestions] Found ${totalFound} suggestions to auto-apply`);

    if (totalFound === 0) {
      return new Response(JSON.stringify({
        success: true,
        applied: 0,
        skipped: 0,
        errors: 0,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let applied = 0;
    let skipped = 0;
    let errors = 0;
    const results: any[] = [];

    for (const suggestion of suggestions) {
      try {
        // Only process field updates for opportunities
        if (suggestion.entity_type !== 'opportunity' || !suggestion.field_name) {
          skipped++;
          console.log(`[auto-apply-ai-suggestions] Skipping ${suggestion.id}: not opportunity field update`);
          continue;
        }

        // Validate that we have an entity_id
        if (!suggestion.entity_id) {
          skipped++;
          console.log(`[auto-apply-ai-suggestions] Skipping ${suggestion.id}: no entity_id`);
          continue;
        }

        // Manual-only fields: never auto-apply, leave pending for user decision.
        if (MANUAL_ONLY_FIELDS.has(suggestion.field_name)) {
          skipped++;
          console.log(`[auto-apply-ai-suggestions] Skipping ${suggestion.id}: field "${suggestion.field_name}" is manual-only`);
          continue;
        }

        // Get current value to ensure we're not overwriting user changes
        const { data: currentOpp, error: getError } = await supabase
          .from('opportunities')
          .select(suggestion.field_name)
          .eq('id', suggestion.entity_id)
          .single();

        if (getError) {
          console.error(`[auto-apply-ai-suggestions] Error getting current value:`, getError);
          errors++;
          continue;
        }

        // Check if value has changed since suggestion was made
        const currentValue = currentOpp[suggestion.field_name];
        if (JSON.stringify(currentValue) !== JSON.stringify(suggestion.current_value)) {
          // User has already changed this field, don't override
          await supabase
            .from('ai_suggestions')
            .update({ 
              status: 'dismissed',
              action_taken_at: new Date().toISOString(),
            })
            .eq('id', suggestion.id);
            
          skipped++;
          console.log(`[auto-apply-ai-suggestions] Skipping ${suggestion.id}: field was modified by user`);
          continue;
        }

        // Apply the suggestion
        const updateData: Record<string, any> = {};
        updateData[suggestion.field_name] = suggestion.suggested_value;

        const { error: updateError } = await supabase
          .from('opportunities')
          .update(updateData)
          .eq('id', suggestion.entity_id);

        if (updateError) {
          console.error(`[auto-apply-ai-suggestions] Error applying suggestion:`, updateError);
          errors++;
          continue;
        }

        // Mark suggestion as accepted
        await supabase
          .from('ai_suggestions')
          .update({ 
            status: 'accepted',
            action_taken_at: new Date().toISOString(),
          })
          .eq('id', suggestion.id);

        // Create notification for the user
        const opportunity = suggestion.opportunity;
        if (opportunity) {
          await supabase
            .from('notifications')
            .insert({
              user_id: suggestion.user_id,
              organization_id: suggestion.organization_id,
              type: 'ai_auto_applied',
              title: '🤖 IA aplicou sugestão automaticamente',
              message: `O campo "${suggestion.field_name}" da oportunidade "${opportunity.title}" foi atualizado automaticamente pela IA com ${Math.round((suggestion.confidence_score || 0) * 100)}% de confiança.`,
              metadata: {
                suggestion_id: suggestion.id,
                opportunity_id: suggestion.entity_id,
                field_name: suggestion.field_name,
                old_value: suggestion.current_value,
                new_value: suggestion.suggested_value,
                confidence: suggestion.confidence_score,
                reasoning: suggestion.reasoning,
              },
            });
        }

        applied++;
        results.push({
          suggestion_id: suggestion.id,
          field_name: suggestion.field_name,
          confidence: suggestion.confidence_score,
          entity_id: suggestion.entity_id,
        });

        console.log(`[auto-apply-ai-suggestions] Applied ${suggestion.id}: ${suggestion.field_name} with ${suggestion.confidence_score} confidence`);

      } catch (error) {
        console.error(`[auto-apply-ai-suggestions] Error processing ${suggestion.id}:`, error);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[auto-apply-ai-suggestions] Completed: ${applied} applied, ${skipped} skipped, ${errors} errors in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      applied,
      skipped,
      errors,
      duration_ms: duration,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[auto-apply-ai-suggestions] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to auto-apply suggestions',
      details: String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
