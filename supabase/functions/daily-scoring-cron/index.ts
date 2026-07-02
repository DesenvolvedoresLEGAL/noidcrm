import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting daily scoring CRON job...');

    // 1. Get all open opportunities that need score recalculation
    // Only fetch opportunities that are NOT won or lost (open for business)
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('id, organization_id, score_updated_at, status')
      .is('deleted_at', null)
      .or('status.is.null,status.in.(new,open)'); // Only open opportunities

    if (oppError) {
      console.error('Error fetching opportunities:', oppError);
      throw oppError;
    }

    console.log(`Found ${opportunities?.length || 0} open opportunities to process`);

    // 2. Recalculate opportunity scores for those not updated in 24h
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    let opportunitiesUpdated = 0;
    for (const opp of opportunities || []) {
      const scoreDate = opp.score_updated_at ? new Date(opp.score_updated_at) : null;
      
      if (!scoreDate || scoreDate < oneDayAgo) {
        // Calculate opportunity scores
        const { error: calcError } = await supabase.functions.invoke('calculate-opportunity-scores', {
          body: { opportunityId: opp.id }
        });
        
        if (!calcError) {
          opportunitiesUpdated++;
        } else {
          console.error(`Error calculating scores for opportunity ${opp.id}:`, calcError);
        }
      }
    }

    // 3. Apply intent score decay to accounts
    console.log('Applying intent score decay...');
    
    // Get accounts with opportunities that have been inactive
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('id, intent_score, score_updated_at')
      .gt('intent_score', 0);

    if (accError) {
      console.error('Error fetching accounts:', accError);
    }

    let accountsDecayed = 0;
    const now = new Date();

    for (const account of accounts || []) {
      const scoreDate = account.score_updated_at ? new Date(account.score_updated_at) : null;
      
      if (!scoreDate) continue;
      
      const daysSinceUpdate = Math.floor((now.getTime() - scoreDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceUpdate >= 1 && account.intent_score > 0) {
        // Apply decay based on inactivity
        let decay = 0;
        
        if (daysSinceUpdate >= 30) {
          decay = 20; // Major decay after 30 days
        } else if (daysSinceUpdate >= 7) {
          decay = 5; // Moderate decay after 7 days
        } else {
          decay = Math.min(daysSinceUpdate, 5); // 1-5 points per day
        }
        
        const newIntentScore = Math.max(0, account.intent_score - decay);
        
        // Calculate new lead score and grade
        const { data: accData } = await supabase
          .from('accounts')
          .select('fit_score')
          .eq('id', account.id)
          .single();
        
        const fitScore = accData?.fit_score || 0;
        const leadScore = Math.round(fitScore * 0.4 + newIntentScore * 0.6);
        
        // Determine grade
        let leadGrade = 'D';
        if (leadScore >= 80) leadGrade = 'A';
        else if (leadScore >= 60) leadGrade = 'B';
        else if (leadScore >= 40) leadGrade = 'C';
        else if (leadScore >= 20) leadGrade = 'D';
        else leadGrade = 'F';
        
        const { error: updateError } = await supabase
          .from('accounts')
          .update({
            intent_score: newIntentScore,
            lead_score: leadScore,
            lead_grade: leadGrade,
            score_updated_at: now.toISOString()
          })
          .eq('id', account.id);
        
        if (!updateError) {
          accountsDecayed++;
        }
      }
    }

    // 4. Recalculate account scores for accounts with null score_updated_at
    const { data: accountsToCalc, error: accCalcError } = await supabase
      .from('accounts')
      .select('id')
      .is('score_updated_at', null);

    let accountsCalculated = 0;
    for (const acc of accountsToCalc || []) {
      const { error: calcError } = await supabase.functions.invoke('calculate-account-scores', {
        body: { accountId: acc.id }
      });
      
      if (!calcError) {
        accountsCalculated++;
      }
    }

    const summary = {
      opportunitiesProcessed: opportunities?.length || 0,
      opportunitiesUpdated,
      accountsDecayed,
      accountsCalculated,
      timestamp: new Date().toISOString()
    };

    console.log('Daily scoring CRON completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in daily scoring CRON:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
