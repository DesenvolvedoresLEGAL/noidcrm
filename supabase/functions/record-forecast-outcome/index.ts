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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Recording forecast outcomes for closed deals...');

    // Find opportunities closed in the last 24 hours without recorded outcomes
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: closedOpportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('id, organization_id, status, valor_previsto, pipeline_id, stage_id, updated_at')
      .in('status', ['won', 'lost'])
      .gte('updated_at', yesterday.toISOString());

    if (oppError) {
      console.error('Error fetching closed opportunities:', oppError);
      return new Response(JSON.stringify({ error: 'Failed to fetch opportunities' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${closedOpportunities?.length || 0} recently closed opportunities`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const opp of closedOpportunities || []) {
      // Find predictions for this opportunity that don't have outcomes yet
      const { data: predictions, error: predError } = await supabase
        .from('forecast_predictions')
        .select('*')
        .eq('opportunity_id', opp.id)
        .is('actual_value', null);

      if (predError) {
        console.error(`Error fetching predictions for ${opp.id}:`, predError);
        errorCount++;
        continue;
      }

      for (const prediction of predictions || []) {
        let actualValue: number;
        let errorValue: number;
        let errorPercentage: number;
        let wasAccurate: boolean;

        if (prediction.prediction_type === 'win_probability') {
          actualValue = opp.status === 'won' ? 100 : 0;
          errorValue = prediction.predicted_value - actualValue;
          errorPercentage = Math.abs(errorValue);
          wasAccurate = (prediction.predicted_value >= 50 && opp.status === 'won') ||
                       (prediction.predicted_value < 50 && opp.status === 'lost');
        } else if (prediction.prediction_type === 'value') {
          actualValue = opp.valor_previsto || 0;
          errorValue = prediction.predicted_value - actualValue;
          errorPercentage = actualValue > 0 
            ? Math.abs(errorValue / actualValue * 100) 
            : 0;
          wasAccurate = errorPercentage <= 10;
        } else if (prediction.prediction_type === 'health') {
          // Health predictions are valid if deal was won with health > 50 or lost with health < 50
          actualValue = opp.status === 'won' ? 100 : 0;
          errorValue = prediction.predicted_value - actualValue;
          errorPercentage = Math.abs(errorValue);
          wasAccurate = (prediction.predicted_value > 50 && opp.status === 'won') ||
                       (prediction.predicted_value <= 50 && opp.status === 'lost');
        } else {
          continue;
        }

        const { error: updateError } = await supabase
          .from('forecast_predictions')
          .update({
            actual_value: actualValue,
            error_value: errorValue,
            error_percentage: errorPercentage,
            was_accurate: wasAccurate,
            outcome_recorded_at: new Date().toISOString()
          })
          .eq('id', prediction.id);

        if (updateError) {
          console.error(`Error updating prediction ${prediction.id}:`, updateError);
          errorCount++;
        } else {
          updatedCount++;
        }
      }

      // Also update any auto-remediation executions
      await supabase
        .from('auto_remediation_executions')
        .update({
          outcome_status: opp.status === 'won' ? 'deal_won' : 'deal_lost',
          outcome_recorded_at: new Date().toISOString()
        })
        .eq('opportunity_id', opp.id)
        .is('outcome_status', null);
    }

    // Calculate and log accuracy metrics
    const { data: accuracyMetrics } = await supabase
      .from('forecast_accuracy_metrics')
      .select('*');

    console.log('Current accuracy metrics:', accuracyMetrics);

    return new Response(JSON.stringify({
      success: true,
      opportunitiesProcessed: closedOpportunities?.length || 0,
      predictionsUpdated: updatedCount,
      errors: errorCount,
      accuracyMetrics
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in record-forecast-outcome:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
