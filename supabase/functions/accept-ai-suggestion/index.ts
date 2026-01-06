import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize temperature values to standardized format
function normalizeTemperature(value: any): string {
  if (!value) return 'warm';
  
  const normalized = String(value).toLowerCase().trim();
  
  // Map Portuguese and English variations
  const tempMap: Record<string, string> = {
    'cold': 'cold',
    'frio': 'cold',
    'warm': 'warm',
    'morno': 'warm',
    'hot': 'hot',
    'quente': 'hot',
    'burning': 'burning',
    'fervendo': 'burning',
    'ardente': 'burning'
  };
  
  return tempMap[normalized] || 'warm';
}

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

    const fieldName = suggestion.field_name;
    let suggestedValue = suggestion.suggested_value;

    if (!fieldName) {
      throw new Error('No field name in suggestion');
    }

    // Fetch current opportunity to compare values
    const { data: currentOpp, error: oppError } = await supabase
      .from('opportunities')
      .select('*, stage:stages(id, name)')
      .eq('id', targetOpportunityId)
      .single();

    if (oppError || !currentOpp) {
      console.error('Failed to fetch opportunity:', oppError);
      throw new Error('Opportunity not found');
    }

    // Build the update object based on field_name
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    let normalizedSuggestedValue = suggestedValue;
    let currentValue: any;
    let isNoOp = false;

    // Handle temperature field - update BOTH temperature and temperatura
    if (fieldName === 'temperature') {
      normalizedSuggestedValue = normalizeTemperature(suggestedValue);
      currentValue = normalizeTemperature(currentOpp.temperatura || currentOpp.temperature);
      
      // Check if it's a no-op (same value)
      if (normalizedSuggestedValue === currentValue) {
        isNoOp = true;
        console.log(`[accept-ai-suggestion] No-op detected: temperature already ${currentValue}`);
      } else {
        // Update BOTH fields to ensure consistency
        updateData.temperature = normalizedSuggestedValue;
        updateData.temperatura = normalizedSuggestedValue;
        console.log(`[accept-ai-suggestion] Temperature: ${currentValue} -> ${normalizedSuggestedValue}`);
      }
    }
    // Handle stage_id - resolve name to ID if needed
    else if (fieldName === 'stage_id') {
      currentValue = currentOpp.stage_id;
      
      // Check if suggested value is a name rather than UUID
      if (typeof suggestedValue === 'string' && !suggestedValue.match(/^[0-9a-f-]{36}$/i)) {
        console.log(`[accept-ai-suggestion] Resolving stage name to ID: ${suggestedValue}`);
        
        // Try to find stage by name in the same pipeline
        const { data: stages } = await supabase
          .from('stages')
          .select('id, name')
          .eq('pipeline_id', currentOpp.pipeline_id)
          .ilike('name', `%${suggestedValue}%`);
        
        if (stages && stages.length > 0) {
          normalizedSuggestedValue = stages[0].id;
          console.log(`[accept-ai-suggestion] Resolved stage: ${suggestedValue} -> ${normalizedSuggestedValue}`);
        } else {
          console.warn(`[accept-ai-suggestion] Could not resolve stage name: ${suggestedValue}`);
          throw new Error(`Estágio não encontrado: ${suggestedValue}`);
        }
      }
      
      if (normalizedSuggestedValue === currentValue) {
        isNoOp = true;
        console.log(`[accept-ai-suggestion] No-op detected: stage_id already ${currentValue}`);
      } else {
        updateData.stage_id = normalizedSuggestedValue;
      }
    }
    // Handle prob (probability)
    else if (fieldName === 'prob') {
      currentValue = currentOpp.prob;
      normalizedSuggestedValue = typeof suggestedValue === 'number' 
        ? Math.min(100, Math.max(0, suggestedValue)) 
        : parseInt(String(suggestedValue), 10) || currentValue;
      
      if (normalizedSuggestedValue === currentValue) {
        isNoOp = true;
        console.log(`[accept-ai-suggestion] No-op detected: prob already ${currentValue}`);
      } else {
        updateData.prob = normalizedSuggestedValue;
      }
    }
    // Handle valor_previsto
    else if (fieldName === 'valor_previsto') {
      currentValue = currentOpp.valor_previsto;
      normalizedSuggestedValue = typeof suggestedValue === 'number' 
        ? suggestedValue 
        : parseFloat(String(suggestedValue).replace(/[^\d.,]/g, '').replace(',', '.')) || currentValue;
      
      if (normalizedSuggestedValue === currentValue) {
        isNoOp = true;
        console.log(`[accept-ai-suggestion] No-op detected: valor_previsto already ${currentValue}`);
      } else {
        updateData.valor_previsto = normalizedSuggestedValue;
      }
    }
    // Handle close_date_prevista
    else if (fieldName === 'close_date_prevista') {
      currentValue = currentOpp.close_date_prevista;
      
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}/;
      if (typeof suggestedValue === 'string' && dateRegex.test(suggestedValue)) {
        normalizedSuggestedValue = suggestedValue.split('T')[0]; // Normalize to date only
        
        if (normalizedSuggestedValue === currentValue) {
          isNoOp = true;
          console.log(`[accept-ai-suggestion] No-op detected: close_date_prevista already ${currentValue}`);
        } else {
          updateData.close_date_prevista = normalizedSuggestedValue;
        }
      } else {
        console.warn(`[accept-ai-suggestion] Invalid date format: ${suggestedValue}`);
        throw new Error(`Data inválida: ${suggestedValue}`);
      }
    }
    // Handle other fields generically
    else {
      currentValue = currentOpp[fieldName];
      if (normalizedSuggestedValue === currentValue) {
        isNoOp = true;
        console.log(`[accept-ai-suggestion] No-op detected: ${fieldName} already ${currentValue}`);
      } else {
        updateData[fieldName] = normalizedSuggestedValue;
      }
    }

    // If not a no-op, perform the update
    if (!isNoOp) {
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
    }

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
    }

    // Expire all other pending suggestions for the same field+opportunity
    const { data: expiredSuggestions, error: expireError } = await supabase
      .from('ai_suggestions')
      .update({
        status: 'expired',
        action_taken_at: new Date().toISOString()
      })
      .eq('opportunity_id', targetOpportunityId)
      .eq('field_name', fieldName)
      .eq('status', 'pending')
      .neq('id', suggestionId)
      .select('id');

    if (expireError) {
      console.warn('Failed to expire other suggestions:', expireError);
    } else if (expiredSuggestions && expiredSuggestions.length > 0) {
      console.log(`[accept-ai-suggestion] Expired ${expiredSuggestions.length} other pending suggestions for ${fieldName}`);
    }

    // Trigger score recalculations based on field type (only if not a no-op)
    const recalculationResults: Record<string, any> = {};

    if (!isNoOp) {
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
      }
    }

    // Log the action
    try {
      await supabase.from('audit_log').insert({
        action: isNoOp ? 'ai_suggestion_no_op' : 'ai_suggestion_accepted',
        entity_type: 'opportunity',
        entity_id: targetOpportunityId,
        actor_user_id: user.id,
        organization_id: suggestion.organization_id,
        metadata: {
          suggestion_id: suggestionId,
          field_name: fieldName,
          old_value: currentValue,
          new_value: normalizedSuggestedValue,
          is_no_op: isNoOp,
          recalculations: Object.keys(recalculationResults)
        }
      });
    } catch (logError) {
      console.warn('Failed to log audit entry:', logError);
    }

    const tempLabels: Record<string, string> = {
      cold: 'Frio',
      warm: 'Morno',
      hot: 'Quente',
      burning: 'Fervendo'
    };

    return new Response(JSON.stringify({
      success: true,
      field_updated: fieldName,
      old_value: currentValue,
      new_value: normalizedSuggestedValue,
      new_value_label: fieldName === 'temperature' ? tempLabels[normalizedSuggestedValue] : undefined,
      opportunity_id: targetOpportunityId,
      is_no_op: isNoOp,
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
