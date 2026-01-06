import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { suggestionId } = await req.json();
    if (!suggestionId) {
      throw new Error('Missing suggestionId');
    }

    console.log(`[accept-ai-suggestion] Processing suggestion ${suggestionId} for user ${user.id}`);

    // Fetch the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('ai_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .single();

    if (fetchError || !suggestion) {
      console.error('Failed to fetch suggestion:', fetchError);
      throw new Error('Suggestion not found');
    }

    console.log(`[accept-ai-suggestion] Suggestion details:`, {
      field_name: suggestion.field_name,
      current_value: suggestion.current_value,
      suggested_value: suggestion.suggested_value,
      opportunity_id: suggestion.opportunity_id,
      entity_type: suggestion.entity_type,
      entity_id: suggestion.entity_id
    });

    // Determine which entity to update
    const targetOpportunityId = suggestion.opportunity_id || suggestion.entity_id;
    
    if (!targetOpportunityId) {
      throw new Error('No opportunity ID found in suggestion');
    }

    // Build the update object based on field_name
    const fieldName = suggestion.field_name;
    const suggestedValue = suggestion.suggested_value;

    if (!fieldName) {
      throw new Error('No field name in suggestion');
    }

    // Map of supported fields
    const supportedFields = [
      'temperature',
      'stage_id', 
      'valor_previsto',
      'prob',
      'close_date_prevista',
      'energy_score',
      'timing_score',
      'response_velocity',
      'commitment_level',
      'trust_level'
    ];

    if (!supportedFields.includes(fieldName)) {
      console.warn(`[accept-ai-suggestion] Field ${fieldName} not in supported list, will attempt update anyway`);
    }

    // Update the opportunity
    const updateData: Record<string, any> = {
      [fieldName]: suggestedValue,
      updated_at: new Date().toISOString()
    };

    console.log(`[accept-ai-suggestion] Updating opportunity ${targetOpportunityId} with:`, updateData);

    const { error: updateError } = await supabase
      .from('opportunities')
      .update(updateData)
      .eq('id', targetOpportunityId);

    if (updateError) {
      console.error('Failed to update opportunity:', updateError);
      throw new Error(`Failed to update opportunity: ${updateError.message}`);
    }

    console.log(`[accept-ai-suggestion] Opportunity updated successfully`);

    // Mark suggestion as accepted
    const { error: acceptError } = await supabase
      .from('ai_suggestions')
      .update({
        status: 'accepted',
        action_taken_at: new Date().toISOString()
      })
      .eq('id', suggestionId);

    if (acceptError) {
      console.error('Failed to mark suggestion as accepted:', acceptError);
      // Don't throw - the field was already updated
    }

    // Trigger score recalculations based on field type
    const recalculationResults: Record<string, any> = {};

    // Fields that affect opportunity score / win probability
    const opportunityScoreFields = ['stage_id', 'valor_previsto', 'prob', 'commitment_level', 'trust_level'];
    
    // Fields that affect NRHS score
    const nhrsScoreFields = ['temperature', 'close_date_prevista', 'energy_score', 'timing_score', 'response_velocity'];

    try {
      if (opportunityScoreFields.includes(fieldName)) {
        console.log(`[accept-ai-suggestion] Triggering opportunity score recalculation`);
        const { data: scoreData, error: scoreError } = await supabase.functions.invoke('calculate-opportunity-scores', {
          body: { opportunityId: targetOpportunityId }
        });
        if (scoreError) {
          console.warn('Failed to recalculate opportunity score:', scoreError);
        } else {
          recalculationResults.opportunityScore = scoreData;
        }
      }

      if (nhrsScoreFields.includes(fieldName)) {
        console.log(`[accept-ai-suggestion] Triggering NRHS score recalculation`);
        const { data: nhrsData, error: nhrsError } = await supabase.functions.invoke('calculate-nrhs', {
          body: { opportunityId: targetOpportunityId }
        });
        if (nhrsError) {
          console.warn('Failed to recalculate NRHS score:', nhrsError);
        } else {
          recalculationResults.nhrsScore = nhrsData;
        }
      }

      // Always recalculate health drivers for any field change
      console.log(`[accept-ai-suggestion] Triggering health drivers recalculation`);
      const { data: healthData, error: healthError } = await supabase.functions.invoke('calculate-health-drivers', {
        body: { opportunityId: targetOpportunityId }
      });
      if (healthError) {
        console.warn('Failed to recalculate health drivers:', healthError);
      } else {
        recalculationResults.healthDrivers = healthData;
      }
    } catch (recalcError) {
      console.warn('Error during score recalculations:', recalcError);
      // Don't throw - the main update was successful
    }

    // Log the action
    try {
      await supabase.from('audit_log').insert({
        action: 'ai_suggestion_accepted',
        entity_type: 'opportunity',
        entity_id: targetOpportunityId,
        actor_user_id: user.id,
        organization_id: suggestion.organization_id,
        metadata: {
          suggestion_id: suggestionId,
          field_name: fieldName,
          old_value: suggestion.current_value,
          new_value: suggestedValue,
          recalculations: Object.keys(recalculationResults)
        }
      });
    } catch (logError) {
      console.warn('Failed to log audit entry:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      field_updated: fieldName,
      new_value: suggestedValue,
      opportunity_id: targetOpportunityId,
      recalculations: recalculationResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[accept-ai-suggestion] Error:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
