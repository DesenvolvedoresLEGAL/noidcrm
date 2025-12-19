import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccountData {
  id: string;
  organization_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  segmento: string | null;
  tamanho: string | null;
  capital_social: number | null;
  cnpj: string | null;
  telefones: any;
  emails: string[] | null;
  cidade: string | null;
  uf: string | null;
  fit_score: number;
  intent_score: number;
}

interface ActivityData {
  type: string;
  status: string;
  completed_at: string | null;
}

interface ProposalData {
  status: string;
  view_count: number;
  last_viewed_at: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId, recalculateAll } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let accounts: AccountData[] = [];
    
    if (accountId) {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();
      if (error) throw error;
      accounts = [data];
    } else if (recalculateAll) {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .limit(500);
      if (error) throw error;
      accounts = data || [];
    } else {
      throw new Error('accountId or recalculateAll is required');
    }

    const results = [];

    for (const account of accounts) {
      // Calculate FIT Score
      const fitScore = await calculateFitScore(supabase, account);
      
      // Calculate INTENT Score (now includes won deals boost)
      const intentScore = await calculateIntentScore(supabase, account);
      
      // Update account with new scores
      const { error: updateError } = await supabase
        .from('accounts')
        .update({
          fit_score: fitScore.score,
          intent_score: intentScore.score,
          scoring_factors: {
            fit: fitScore.factors,
            intent: intentScore.factors,
            calculated_at: new Date().toISOString()
          }
        })
        .eq('id', account.id);

      if (updateError) {
        console.error('Error updating account scores:', updateError);
        continue;
      }

      // Log score history if scores changed significantly
      if (Math.abs(fitScore.score - account.fit_score) >= 5 || 
          Math.abs(intentScore.score - account.intent_score) >= 5) {
        await logScoreHistory(supabase, account.organization_id, 'account', account.id, 
          'fit', account.fit_score, fitScore.score, 'recalculation', fitScore.factors);
        await logScoreHistory(supabase, account.organization_id, 'account', account.id,
          'intent', account.intent_score, intentScore.score, 'recalculation', intentScore.factors);
      }

      results.push({
        accountId: account.id,
        fitScore: fitScore.score,
        intentScore: intentScore.score,
        leadScore: Math.round((fitScore.score * 0.4) + (intentScore.score * 0.6)),
        hasWonDeals: intentScore.factors.cliente_ativo > 0
      });
    }

    console.log(`Calculated scores for ${results.length} accounts`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-account-scores:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to calculate scores' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateFitScore(supabase: any, account: AccountData) {
  let score = 0;
  const factors: Record<string, number> = {};

  // Segmento match (0-25 points)
  if (account.segmento) {
    const premiumSegments = ['Eventos', 'Corporativo', 'Marketing', 'Tecnologia', 'Financeiro'];
    if (premiumSegments.some(s => account.segmento?.toLowerCase().includes(s.toLowerCase()))) {
      factors.segmento_premium = 25;
      score += 25;
    } else {
      factors.segmento_standard = 10;
      score += 10;
    }
  }

  // Tamanho match (0-20 points)
  if (account.tamanho) {
    const sizePoints: Record<string, number> = {
      'Grande': 20,
      'Média': 15,
      'Pequena': 10,
      'Micro': 5
    };
    const points = sizePoints[account.tamanho] || 5;
    factors.tamanho = points;
    score += points;
  }

  // Capital Social (0-15 points)
  if (account.capital_social) {
    if (account.capital_social >= 1000000) {
      factors.capital_social_alto = 15;
      score += 15;
    } else if (account.capital_social >= 100000) {
      factors.capital_social_medio = 10;
      score += 10;
    } else {
      factors.capital_social_baixo = 5;
      score += 5;
    }
  }

  // Data completeness (0-25 points)
  let completeness = 0;
  if (account.cnpj) completeness += 5;
  if (account.telefones && (Array.isArray(account.telefones) ? account.telefones.length > 0 : Object.keys(account.telefones).length > 0)) completeness += 5;
  if (account.emails && account.emails.length > 0) completeness += 5;
  if (account.cidade && account.uf) completeness += 5;
  if (account.segmento) completeness += 5;
  factors.dados_completos = completeness;
  score += completeness;

  // Location relevance (0-15 points) - São Paulo/RJ premium
  if (account.uf) {
    if (['SP', 'RJ'].includes(account.uf)) {
      factors.localizacao_premium = 15;
      score += 15;
    } else if (['MG', 'RS', 'PR', 'SC'].includes(account.uf)) {
      factors.localizacao_boa = 10;
      score += 10;
    } else {
      factors.localizacao_outras = 5;
      score += 5;
    }
  }

  return { score: Math.min(100, score), factors };
}

async function calculateIntentScore(supabase: any, account: AccountData) {
  let score = 0;
  const factors: Record<string, number> = {};
  const now = new Date();

  // =====================================================
  // NEW: Check for won opportunities (active customer boost)
  // =====================================================
  const { data: wonOpportunities } = await supabase
    .from('opportunities')
    .select('id, valor_previsto, updated_at')
    .eq('account_id', account.id)
    .eq('status', 'won');

  if (wonOpportunities && wonOpportunities.length > 0) {
    // Significant boost for being an active customer
    factors.cliente_ativo = 40;
    score += 40;

    // Additional boost per won deal (max 20 extra points)
    const dealBonus = Math.min(20, wonOpportunities.length * 10);
    factors.deals_ganhos = dealBonus;
    score += dealBonus;

    // Recency bonus - if won deal in last 6 months
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const recentWins = wonOpportunities.filter((o: any) => new Date(o.updated_at) > sixMonthsAgo);
    if (recentWins.length > 0) {
      factors.ganho_recente = 10;
      score += 10;
    }

    // Value-based bonus
    const totalWonValue = wonOpportunities.reduce((sum: number, o: any) => sum + (o.valor_previsto || 0), 0);
    if (totalWonValue >= 100000) {
      factors.alto_valor_ganho = 15;
      score += 15;
    } else if (totalWonValue >= 50000) {
      factors.medio_valor_ganho = 10;
      score += 10;
    }

    console.log(`Account ${account.id} has ${wonOpportunities.length} won deals - applied customer boost`);
  } else {
    factors.cliente_ativo = 0;
  }

  // =====================================================
  // Existing activity-based scoring (reduced weight for clients)
  // =====================================================
  const activityMaxPoints = factors.cliente_ativo > 0 ? 20 : 40; // Less weight if already a client

  // Get account activities
  const { data: activities } = await supabase
    .from('activities')
    .select('type, status, completed_at, scheduled_date')
    .eq('account_id', account.id)
    .order('completed_at', { ascending: false })
    .limit(50);

  // Get proposals related to account's opportunities
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('id')
    .eq('account_id', account.id);

  const oppIds = opportunities?.map((o: any) => o.id) || [];
  
  let proposals: any[] = [];
  if (oppIds.length > 0) {
    const { data: proposalData } = await supabase
      .from('proposals')
      .select('status, view_count, last_viewed_at')
      .in('opportunity_id', oppIds);
    proposals = proposalData || [];
  }

  // Calculate based on activities (with decay)
  if (activities && activities.length > 0) {
    let activityPoints = 0;
    
    for (const activity of activities) {
      const activityDate = new Date(activity.completed_at || activity.scheduled_date);
      const daysSince = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Base points by activity type
      let basePoints = 0;
      switch (activity.type) {
        case 'meeting':
          basePoints = activity.status === 'completed' ? 25 : 15;
          break;
        case 'call':
          basePoints = activity.status === 'completed' ? 15 : 5;
          break;
        case 'email':
          basePoints = activity.status === 'completed' ? 10 : 3;
          break;
        case 'task':
          basePoints = activity.status === 'completed' ? 5 : 2;
          break;
        default:
          basePoints = 5;
      }

      // Apply decay (lose 2 points per week of inactivity)
      const decay = Math.floor(daysSince / 7) * 2;
      const pointsWithDecay = Math.max(0, basePoints - decay);
      activityPoints += pointsWithDecay;
    }

    factors.atividades = Math.min(activityMaxPoints, activityPoints);
    score += factors.atividades;
  }

  // Calculate based on proposals (reduced weight for clients)
  const proposalMaxPoints = factors.cliente_ativo > 0 ? 15 : 40;
  
  if (proposals.length > 0) {
    let proposalPoints = 0;
    
    for (const proposal of proposals) {
      // Points for proposal status
      switch (proposal.status) {
        case 'accepted':
          proposalPoints += 40;
          break;
        case 'sent':
          proposalPoints += 15;
          break;
        case 'draft':
          proposalPoints += 5;
          break;
      }

      // Points for views (max 30)
      if (proposal.view_count > 0) {
        proposalPoints += Math.min(30, proposal.view_count * 10);
      }

      // Recent view bonus
      if (proposal.last_viewed_at) {
        const viewedDate = new Date(proposal.last_viewed_at);
        const daysSince = Math.floor((now.getTime() - viewedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= 3) {
          proposalPoints += 15; // Very recent view
        } else if (daysSince <= 7) {
          proposalPoints += 10; // Recent view
        }
      }
    }

    factors.propostas = Math.min(proposalMaxPoints, proposalPoints);
    score += factors.propostas;
  }

  // Recency penalty (no activity in last 14 days) - less severe for active clients
  const { data: recentActivity } = await supabase
    .from('activities')
    .select('id')
    .eq('account_id', account.id)
    .gte('completed_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (!recentActivity || recentActivity.length === 0) {
    const penalty = factors.cliente_ativo > 0 ? -5 : -15; // Smaller penalty for clients
    factors.inatividade_penalidade = penalty;
    score += penalty;
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

async function logScoreHistory(
  supabase: any,
  organizationId: string,
  entityType: string,
  entityId: string,
  scoreType: string,
  oldValue: number,
  newValue: number,
  reason: string,
  factors: Record<string, number>
) {
  await supabase
    .from('score_history')
    .insert({
      organization_id: organizationId,
      entity_type: entityType,
      entity_id: entityId,
      score_type: scoreType,
      old_value: oldValue,
      new_value: newValue,
      change_reason: reason,
      factors
    });
}
