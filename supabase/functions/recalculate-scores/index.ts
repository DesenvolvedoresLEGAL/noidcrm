import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Opportunity {
  id: string;
  close_date_prevista?: string;
  close_date?: string;
  prob?: number;
  valor_previsto?: number;
  value?: number;
  days_since_contact?: number;
  stage_id?: string;
  temperature?: string;
  // Campos Vibe Selling
  energy_score?: number;
  timing_score?: number;
  response_velocity?: number;
  stage?: { name: string };
}

// Fórmula LEGADA para urgency_score (mantida para compatibilidade)
function calculateUrgencyScore(opportunity: Opportunity): number {
  let score = 0;

  // Dias até fechamento
  const closeDate = opportunity.close_date_prevista || opportunity.close_date;
  if (closeDate) {
    const daysUntilClose = Math.ceil(
      (new Date(closeDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
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
  const value = Number(opportunity.valor_previsto || opportunity.value) || 0;
  if (value >= 50000) score += 15;
  else if (value >= 20000) score += 10;
  else if (value >= 5000) score += 5;

  // Stage
  const stageId = opportunity.stage_id || '';
  const stageName = opportunity.stage?.name?.toLowerCase() || '';
  if (stageId.includes('negociacao') || stageName.includes('negociação')) score += 10;
  else if (stageId.includes('proposta') || stageName.includes('proposta')) score += 7;
  else if (stageId.includes('qualificacao') || stageName.includes('qualificação')) score += 4;

  return Math.min(100, Math.max(0, score));
}

// NOVA FÓRMULA: Temperatura baseada em Energia + Timing (Vibe Selling)
function calculateVibeTemperature(
  energyScore: number, 
  timingScore: number, 
  responseVelocity: number | null
): string {
  // Combinar energia e timing para temperatura
  let vibeScore = (energyScore * 0.6) + (timingScore * 0.4);
  
  // Boost por velocidade de resposta rápida
  if (responseVelocity !== null && responseVelocity !== undefined) {
    if (responseVelocity < 4) vibeScore += 10; // < 4h = muito engajado
    else if (responseVelocity < 24) vibeScore += 5; // < 1 dia = engajado
    else if (responseVelocity > 72) vibeScore -= 10; // > 3 dias = frio
  }
  
  // Classificar temperatura
  if (vibeScore >= 80) return 'burning';
  if (vibeScore >= 60) return 'hot';
  if (vibeScore >= 40) return 'warm';
  return 'cold';
}

// Temperatura LEGADA baseada em urgency + prob (fallback)
function calculateLegacyTemperature(urgencyScore: number, prob: number): string {
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

  const stageLower = stage?.toLowerCase() || '';
  const stageMultiplier = stageLower.includes('negociacao') || stageLower.includes('negociação') ? 0.5 : 
                         stageLower.includes('proposta') ? 0.75 : 1;

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

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar organização do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Organização não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = profile.organization_id;
    console.log(`Starting score recalculation for organization: ${organizationId}`);

    // Buscar oportunidades APENAS da organização do usuário
    const { data: opportunities, error: fetchError } = await supabase
      .from('opportunities')
      .select(`
        *,
        stage:stages(name)
      `)
      .eq('organization_id', organizationId)
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
        
        // VIBE SELLING: Usar nova fórmula de temperatura se tiver energy/timing scores
        let temperature: string;
        const hasVibeScores = opp.energy_score !== null && 
                             opp.energy_score !== undefined && 
                             opp.timing_score !== null && 
                             opp.timing_score !== undefined;
        
        if (hasVibeScores) {
          temperature = calculateVibeTemperature(
            opp.energy_score!,
            opp.timing_score!,
            opp.response_velocity
          );
          console.log(`Vibe-based temp for ${opp.id}: energy=${opp.energy_score}, timing=${opp.timing_score} => ${temperature}`);
        } else {
          // Fallback para fórmula legada
          temperature = calculateLegacyTemperature(urgencyScore, opp.prob || 50);
        }
        
        const stageName = opp.stage?.name || opp.stage_id || '';
        const nextFollowUpDate = calculateNextFollowUpDate(temperature, stageName);

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
              energy_score: opp.energy_score,
              timing_score: opp.timing_score,
              vibe_based: hasVibeScores,
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
