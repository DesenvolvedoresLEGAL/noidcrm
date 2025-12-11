import { supabase } from '@/integrations/supabase/client';
import { parseDateOnly } from '@/lib/dateUtils';

export interface OpportunityForAutomation {
  id: string;
  account_name?: string;
  produto?: string;
  stage_id?: string;
  close_date_prevista?: string;
  prob?: number;
  valor_previsto?: number;
  last_contact_date?: string;
  days_since_contact?: number;
  temperature?: string;
  urgency_score?: number;
}

export interface UrgencyScoreFactors {
  daysUntilClose: number;
  probability: number;
  daysSinceContact: number;
  value: number;
  stage: string;
}

/**
 * Calcula o score de urgência de uma oportunidade (0-100)
 */
export function calculateUrgencyScore(opportunity: OpportunityForAutomation): number {
  let score = 0;

  // Fator 1: Dias até fechamento (0-30 pontos)
  if (opportunity.close_date_prevista) {
    const daysUntilClose = Math.ceil(
      (parseDateOnly(opportunity.close_date_prevista).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilClose < 0) {
      score += 30; // Já passou da data prevista
    } else if (daysUntilClose <= 7) {
      score += 30;
    } else if (daysUntilClose <= 15) {
      score += 20;
    } else if (daysUntilClose <= 30) {
      score += 10;
    }
  }

  // Fator 2: Probabilidade de fechar (0-25 pontos)
  const prob = opportunity.prob || 50;
  if (prob >= 75) {
    score += 25;
  } else if (prob >= 60) {
    score += 20;
  } else if (prob >= 40) {
    score += 15;
  } else {
    score += 5;
  }

  // Fator 3: Dias sem contato (0-20 pontos)
  const daysSinceContact = opportunity.days_since_contact || 0;
  if (daysSinceContact >= 7) {
    score += 20;
  } else if (daysSinceContact >= 5) {
    score += 15;
  } else if (daysSinceContact >= 3) {
    score += 10;
  } else if (daysSinceContact >= 1) {
    score += 5;
  }

  // Fator 4: Valor da oportunidade (0-15 pontos)
  const value = Number(opportunity.valor_previsto) || 0;
  if (value >= 50000) {
    score += 15;
  } else if (value >= 20000) {
    score += 10;
  } else if (value >= 5000) {
    score += 5;
  }

  // Fator 5: Etapa do funil (0-10 pontos)
  const stageId = opportunity.stage_id || '';
  if (stageId.includes('negociacao') || stageId.includes('fechamento')) {
    score += 10;
  } else if (stageId.includes('proposta')) {
    score += 7;
  } else if (stageId.includes('qualificacao')) {
    score += 4;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calcula a temperatura da oportunidade baseada no score
 */
export function calculateTemperature(urgencyScore: number, prob: number): string {
  // Burning: Score muito alto OU (probabilidade alta E fechamento próximo)
  if (urgencyScore >= 80 || (prob >= 75 && urgencyScore >= 60)) {
    return 'burning';
  }
  
  // Hot: Score alto OU probabilidade alta
  if (urgencyScore >= 60 || prob >= 60) {
    return 'hot';
  }
  
  // Warm: Score médio
  if (urgencyScore >= 40) {
    return 'warm';
  }
  
  // Cold: Score baixo
  return 'cold';
}

/**
 * Define a frequência de follow-up baseada na temperatura e etapa
 */
export function calculateFollowUpFrequency(temperature: string, stage: string): number {
  const stageMultiplier = stage.includes('negociacao') ? 0.5 : 
                         stage.includes('proposta') ? 0.75 : 1;

  const baseFrequency = {
    burning: 1,
    hot: 2,
    warm: 3,
    cold: 5,
  }[temperature] || 3;

  return Math.ceil(baseFrequency * stageMultiplier);
}

/**
 * Calcula a próxima data de follow-up
 */
export function calculateNextFollowUpDate(
  temperature: string,
  stage: string,
  lastContactDate?: string
): Date {
  const frequency = calculateFollowUpFrequency(temperature, stage);
  const baseDate = lastContactDate ? new Date(lastContactDate) : new Date();
  
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + frequency);
  
  // Ajustar para horário comercial (10h)
  nextDate.setHours(10, 0, 0, 0);
  
  // Se cair no fim de semana, mover para segunda-feira
  const dayOfWeek = nextDate.getDay();
  if (dayOfWeek === 0) { // Domingo
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (dayOfWeek === 6) { // Sábado
    nextDate.setDate(nextDate.getDate() + 2);
  }
  
  return nextDate;
}

/**
 * Atualiza os scores e temperatura de uma oportunidade
 */
export async function updateOpportunityAutomationData(opportunityId: string) {
  try {
    // Buscar dados da oportunidade
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (error) throw error;
    if (!opportunity) throw new Error('Opportunity not found');

    // Calcular scores
    const urgencyScore = calculateUrgencyScore(opportunity);
    const temperature = calculateTemperature(urgencyScore, opportunity.prob || 50);
    const nextFollowUpDate = calculateNextFollowUpDate(
      temperature,
      opportunity.stage_id || '',
      opportunity.last_contact_date
    );

    // Atualizar no banco
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({
        urgency_score: urgencyScore,
        temperature: temperature,
        next_followup_date: nextFollowUpDate.toISOString(),
      })
      .eq('id', opportunityId);

    if (updateError) throw updateError;

    // Registrar no log
    await supabase.from('automation_logs').insert({
      opportunity_id: opportunityId,
      action_type: 'score_updated',
      channel: 'system',
      status: 'completed',
      metadata: {
        urgency_score: urgencyScore,
        temperature: temperature,
        next_followup_date: nextFollowUpDate.toISOString(),
      },
      completed_at: new Date().toISOString(),
    });

    return {
      success: true,
      urgencyScore,
      temperature,
      nextFollowUpDate,
    };
  } catch (error) {
    console.error('Error updating automation data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Busca oportunidades que precisam de follow-up
 */
export async function getOpportunitiesNeedingFollowUp() {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(nome_fantasia, razao_social),
        contact:contacts(nome, emails)
      `)
      .eq('automation_enabled', true)
      .not('status', 'in', '("won","lost")')
      .lte('next_followup_date', new Date().toISOString())
      .order('urgency_score', { ascending: false })
      .limit(50);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching opportunities for follow-up:', error);
    return [];
  }
}

/**
 * Verifica se uma oportunidade pode receber mensagem automática
 */
export async function canSendAutomatedMessage(
  opportunityId: string,
  channel: 'email' | 'whatsapp'
): Promise<{ canSend: boolean; reason?: string }> {
  try {
    // Verificar quantas mensagens foram enviadas na última semana
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: recentLogs, error } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('channel', channel)
      .gte('created_at', oneWeekAgo.toISOString())
      .eq('status', 'completed');

    if (error) throw error;

    // Limite: 3 mensagens por semana por canal
    if (recentLogs && recentLogs.length >= 3) {
      return {
        canSend: false,
        reason: 'Limite de mensagens por semana atingido',
      };
    }

    return { canSend: true };
  } catch (error) {
    console.error('Error checking message limits:', error);
    return {
      canSend: false,
      reason: 'Erro ao verificar limites',
    };
  }
}
