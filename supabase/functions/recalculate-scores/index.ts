import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Opportunity {
  id: string;
  close_date_prevista?: string;
  prob?: number;
  valor_previsto?: number;
  days_since_contact?: number;
  stage_id?: string;
  temperature?: string;
}

function calculateUrgencyScore(opportunity: Opportunity): number {
  let score = 0;

  // Dias até fechamento
  if (opportunity.close_date_prevista) {
    const daysUntilClose = Math.ceil(
      (new Date(opportunity.close_date_prevista).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilClose < 0) score += 30;
    else if (daysUntilClose <= 7) score += 30;
    else if (daysUntilClose <= 15) score += 20;
    else if (daysUntilClose <= 30) score += 10;
  }

  // Probabilidade
  const prob = opportunity.prob || 50;
  if (prob >= 75) score += 25;
  else if (prob >= 60) score += 20;
  else if (prob >= 40) score += 15;
  else score += 5;

  // Dias sem contato
  const daysSinceContact = opportunity.days_since_contact || 0;
  if (daysSinceContact >= 7) score += 20;
  else if (daysSinceContact >= 5) score += 15;
  else if (daysSinceContact >= 3) score += 10;
  else if (daysSinceContact >= 1) score += 5;

  // Valor
  const value = Number(opportunity.valor_previsto) || 0;
  if (value >= 50000) score += 15;
  else if (value >= 20000) score += 10;
  else if (value >= 5000) score += 5;

  // Stage
  const stageId = opportunity.stage_id || '';
  if (stageId.includes('negociacao')) score += 10;
  else if (stageId.includes('proposta')) score += 7;
  else if (stageId.includes('qualificacao')) score += 4;

  return Math.min(100, Math.max(0, score));
}

function calculateTemperature(urgencyScore: number, prob: number): string {
  if (urgencyScore >= 80 || (prob >= 75 && urgencyScore >= 60)) return 'burning';
  if (urgencyScore >= 60 || prob >= 60) return 'hot';
  if (urgencyScore >= 40) return 'warm';
  return 'cold';
}

function calculateNextFollowUpDate(temperature: string, stage: string): string {
  const frequencyMap: Record<string, number> = {
    burning: 1,
    hot: 2,
    warm: 3,
    cold: 5,
  };

  const stageMultiplier = stage.includes('negociacao') ? 0.5 : 
                         stage.includes('proposta') ? 0.75 : 1;

  const frequency = Math.ceil((frequencyMap[temperature] || 3) * stageMultiplier);
  
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + frequency);
  nextDate.setHours(10, 0, 0, 0);
  
  // Ajustar fim de semana
  const dayOfWeek = nextDate.getDay();
  if (dayOfWeek === 0) nextDate.setDate(nextDate.getDate() + 1);
  else if (dayOfWeek === 6) nextDate.setDate(nextDate.getDate() + 2);
  
  return nextDate.toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting score recalculation...');

    // Buscar todas as oportunidades ativas
    const { data: opportunities, error: fetchError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('automation_enabled', true)
      .not('status', 'in', '("won","lost")');

    if (fetchError) throw fetchError;

    console.log(`Found ${opportunities?.length || 0} opportunities to process`);

    let updated = 0;
    let failed = 0;

    // Processar cada oportunidade
    for (const opp of opportunities || []) {
      try {
        const urgencyScore = calculateUrgencyScore(opp);
        const temperature = calculateTemperature(urgencyScore, opp.prob || 50);
        const nextFollowUpDate = calculateNextFollowUpDate(temperature, opp.stage_id || '');

        // Atualizar oportunidade
        const { error: updateError } = await supabase
          .from('opportunities')
          .update({
            urgency_score: urgencyScore,
            temperature: temperature,
            next_followup_date: nextFollowUpDate,
          })
          .eq('id', opp.id);

        if (updateError) {
          console.error(`Error updating opportunity ${opp.id}:`, updateError);
          failed++;
        } else {
          updated++;
          
          // Registrar log
          await supabase.from('automation_logs').insert({
            opportunity_id: opp.id,
            action_type: 'score_updated',
            channel: 'system',
            status: 'completed',
            metadata: {
              urgency_score: urgencyScore,
              temperature: temperature,
              next_followup_date: nextFollowUpDate,
            },
            completed_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`Error processing opportunity ${opp.id}:`, error);
        failed++;
      }
    }

    console.log(`Score recalculation completed. Updated: ${updated}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        failed,
        total: opportunities?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in recalculate-scores:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
