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
  porte: string | null;
  capital_social: number | null;
  cnpj: string | null;
  telefones: any;
  emails: string[] | null;
  cidade: string | null;
  uf: string | null;
  fit_score: number;
  intent_score: number;
}

const BATCH_SIZE = 50;
const PAGE_SIZE = 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId, recalculateAll, organizationId, jobId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ----------------------------------
    // Single account path (synchronous)
    // ----------------------------------
    if (accountId) {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();
      if (error) throw error;
      const result = await processAccount(supabase, data);
      return new Response(JSON.stringify({ success: true, results: [result] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ----------------------------------
    // Bulk path: requires organizationId, runs in background
    // ----------------------------------
    if (recalculateAll) {
      if (!organizationId) {
        return new Response(
          JSON.stringify({ error: 'organizationId is required for recalculateAll' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create or reuse a job row for tracking
      let activeJobId = jobId;
      if (!activeJobId) {
        const { data: jobRow, error: jobErr } = await supabase
          .from('score_recalc_jobs')
          .insert({
            organization_id: organizationId,
            entity_type: 'account',
            status: 'queued',
          })
          .select('id')
          .single();
        if (jobErr) throw jobErr;
        activeJobId = jobRow!.id;
      }

      // Fire background work
      const work = runBulkRecalc(supabase, organizationId, activeJobId);
      // @ts-ignore — Deno EdgeRuntime is available in Supabase functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(work);
      } else {
        // Fallback: detached promise
        work.catch((e) => console.error('bulk recalc failed:', e));
      }

      return new Response(
        JSON.stringify({ success: true, jobId: activeJobId, status: 'queued' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'accountId or recalculateAll is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in calculate-account-scores:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to calculate scores', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function runBulkRecalc(supabase: any, organizationId: string, jobId: string) {
  const startedAt = new Date().toISOString();
  let processed = 0;
  let errors = 0;
  let lastError: string | null = null;

  try {
    // Count total
    const { count, error: countErr } = await supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null);
    if (countErr) throw countErr;
    const total = count || 0;

    await supabase
      .from('score_recalc_jobs')
      .update({
        status: 'running',
        started_at: startedAt,
        total_count: total,
        processed_count: 0,
        error_count: 0,
      })
      .eq('id', jobId);

    // Page through all accounts
    let from = 0;
    while (from < total + PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data: page, error: pageErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .range(from, to);

      if (pageErr) {
        lastError = pageErr.message;
        errors++;
        break;
      }
      if (!page || page.length === 0) break;

      // Process page in batches with limited concurrency
      for (let i = 0; i < page.length; i += BATCH_SIZE) {
        const batch = page.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map((acc: any) => processAccount(supabase, acc)));
        for (const r of settled) {
          if (r.status === 'fulfilled') processed++;
          else {
            errors++;
            lastError = String(r.reason).slice(0, 500);
          }
        }

        // Update progress periodically
        await supabase
          .from('score_recalc_jobs')
          .update({
            processed_count: processed,
            error_count: errors,
            last_error: lastError,
          })
          .eq('id', jobId);
      }

      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    await supabase
      .from('score_recalc_jobs')
      .update({
        status: 'completed',
        processed_count: processed,
        error_count: errors,
        last_error: lastError,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`[recalc ${jobId}] done: processed=${processed} errors=${errors}`);
  } catch (e) {
    console.error(`[recalc ${jobId}] failed:`, e);
    await supabase
      .from('score_recalc_jobs')
      .update({
        status: 'failed',
        last_error: String(e).slice(0, 500),
        completed_at: new Date().toISOString(),
        processed_count: processed,
        error_count: errors + 1,
      })
      .eq('id', jobId);
  }
}

function leadGradeFor(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

async function processAccount(supabase: any, account: AccountData) {
  const fitScore = await calculateFitScore(supabase, account);
  const intentScore = await calculateIntentScore(supabase, account);
  const leadScore = Math.round(fitScore.score * 0.4 + intentScore.score * 0.6);
  const leadGrade = leadGradeFor(leadScore);
  const previousLeadScore = Math.round(
    (account.fit_score || 0) * 0.4 + (account.intent_score || 0) * 0.6
  );

  const { error: updateError } = await supabase
    .from('accounts')
    .update({
      fit_score: fitScore.score,
      intent_score: intentScore.score,
      lead_score: leadScore,
      lead_grade: leadGrade,
      score_updated_at: new Date().toISOString(),
      scoring_factors: {
        fit: fitScore.factors,
        intent: intentScore.factors,
        calculated_at: new Date().toISOString(),
      },
    })
    .eq('id', account.id);

  if (updateError) throw updateError;

  if (
    Math.abs(fitScore.score - (account.fit_score || 0)) >= 5 ||
    Math.abs(intentScore.score - (account.intent_score || 0)) >= 5 ||
    Math.abs(leadScore - previousLeadScore) >= 5
  ) {
    await logScoreHistory(
      supabase,
      account.organization_id,
      'account',
      account.id,
      'fit',
      account.fit_score || 0,
      fitScore.score,
      'recalculation',
      fitScore.factors
    );
    await logScoreHistory(
      supabase,
      account.organization_id,
      'account',
      account.id,
      'intent',
      account.intent_score || 0,
      intentScore.score,
      'recalculation',
      intentScore.factors
    );
    await logScoreHistory(
      supabase,
      account.organization_id,
      'account',
      account.id,
      'lead',
      previousLeadScore,
      leadScore,
      'recalculation',
      { fit: fitScore.score, intent: intentScore.score, grade: leadGrade }
    );
  }

  return {
    accountId: account.id,
    fitScore: fitScore.score,
    intentScore: intentScore.score,
    leadScore,
    leadGrade,
    hasWonDeals: (intentScore.factors.cliente_ativo || 0) > 0,
  };
}

async function calculateFitScore(_supabase: any, account: AccountData) {
  let score = 0;
  const factors: Record<string, number> = {};

  if (account.segmento) {
    const premiumSegments = ['Eventos', 'Corporativo', 'Marketing', 'Tecnologia', 'Financeiro'];
    if (premiumSegments.some((s) => account.segmento?.toLowerCase().includes(s.toLowerCase()))) {
      factors.segmento_premium = 25;
      score += 25;
    } else {
      factors.segmento_standard = 10;
      score += 10;
    }
  }

  // Porte (oficial Receita Federal) — prioridade sobre `tamanho` legacy.
  const portePoints: Record<string, number> = {
    'Grande Porte': 20,
    'Médio Porte': 15,
    'EPP': 10,
    'ME': 5,
    'MEI': 3,
  };
  if (account.porte && portePoints[account.porte] !== undefined) {
    factors.porte = portePoints[account.porte];
    score += factors.porte;
  } else if (account.tamanho) {
    // Fallback legacy (campo manual)
    const sizePoints: Record<string, number> = {
      Grande: 20,
      'Média': 15,
      Pequena: 10,
      Micro: 5,
    };
    const points = sizePoints[account.tamanho] || 5;
    factors.tamanho = points;
    score += points;
  }

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

  let completeness = 0;
  if (account.cnpj) completeness += 5;
  if (
    account.telefones &&
    (Array.isArray(account.telefones)
      ? account.telefones.length > 0
      : Object.keys(account.telefones).length > 0)
  )
    completeness += 5;
  if (account.emails && account.emails.length > 0) completeness += 5;
  if (account.cidade && account.uf) completeness += 5;
  if (account.segmento) completeness += 5;
  factors.dados_completos = completeness;
  score += completeness;

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

  const { data: wonOpportunities } = await supabase
    .from('opportunities')
    .select('id, valor_previsto, updated_at')
    .eq('account_id', account.id)
    .eq('status', 'won');

  if (wonOpportunities && wonOpportunities.length > 0) {
    factors.cliente_ativo = 40;
    score += 40;

    const dealBonus = Math.min(20, wonOpportunities.length * 10);
    factors.deals_ganhos = dealBonus;
    score += dealBonus;

    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const recentWins = wonOpportunities.filter((o: any) => new Date(o.updated_at) > sixMonthsAgo);
    if (recentWins.length > 0) {
      factors.ganho_recente = 10;
      score += 10;
    }

    const totalWonValue = wonOpportunities.reduce(
      (sum: number, o: any) => sum + (o.valor_previsto || 0),
      0
    );
    if (totalWonValue >= 100000) {
      factors.alto_valor_ganho = 15;
      score += 15;
    } else if (totalWonValue >= 50000) {
      factors.medio_valor_ganho = 10;
      score += 10;
    }
  } else {
    factors.cliente_ativo = 0;
  }

  const activityMaxPoints = factors.cliente_ativo > 0 ? 20 : 40;

  const { data: activities } = await supabase
    .from('activities')
    .select('type, status, completed_at, scheduled_date')
    .eq('account_id', account.id)
    .order('completed_at', { ascending: false })
    .limit(50);

  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('id')
    .eq('account_id', account.id);

  const oppIds = opportunities?.map((o: any) => o.id) || [];

  let proposals: any[] = [];
  if (oppIds.length > 0) {
    const { data: proposalData } = await supabase
      .from('proposals')
      .select('status, views_count, last_viewed_at')
      .in('opportunity_id', oppIds);
    proposals = proposalData || [];
  }

  if (activities && activities.length > 0) {
    let activityPoints = 0;
    for (const activity of activities) {
      const activityDate = new Date(activity.completed_at || activity.scheduled_date);
      const daysSince = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
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
      const decay = Math.floor(daysSince / 7) * 2;
      activityPoints += Math.max(0, basePoints - decay);
    }
    factors.atividades = Math.min(activityMaxPoints, activityPoints);
    score += factors.atividades;
  }

  const proposalMaxPoints = factors.cliente_ativo > 0 ? 15 : 40;

  if (proposals.length > 0) {
    let proposalPoints = 0;
    for (const proposal of proposals) {
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
      if ((proposal.views_count ?? 0) > 0) {
        proposalPoints += Math.min(30, (proposal.views_count ?? 0) * 10);
      }
      if (proposal.last_viewed_at) {
        const viewedDate = new Date(proposal.last_viewed_at);
        const daysSince = Math.floor((now.getTime() - viewedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= 3) proposalPoints += 15;
        else if (daysSince <= 7) proposalPoints += 10;
      }
    }
    factors.propostas = Math.min(proposalMaxPoints, proposalPoints);
    score += factors.propostas;
  }

  const { data: recentActivity } = await supabase
    .from('activities')
    .select('id')
    .eq('account_id', account.id)
    .gte('completed_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (!recentActivity || recentActivity.length === 0) {
    const penalty = factors.cliente_ativo > 0 ? -5 : -15;
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
  await supabase.from('score_history').insert({
    organization_id: organizationId,
    entity_type: entityType,
    entity_id: entityId,
    score_type: scoreType,
    old_value: oldValue,
    new_value: newValue,
    change_reason: reason,
    factors,
  });
}
