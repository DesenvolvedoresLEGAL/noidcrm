// Sprint Scoring 1.3 — Consolidated Opportunity Indicators
// Calculates: NRHS, Engagement, Velocity, Risk, Deal Health, AI Win.
// Does NOT recalculate Lead Score (Sprint 1.1) or Opportunity Score (Sprint 1.2).
// Persists results + explainable metadata to opportunities and score_history.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Input {
  opportunity_id: string;
  organization_id?: string | null;
  trigger_source?: string;
  trigger_action?: string;
}

const FORMULA_VERSION = '1.3.0';

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = (await req.json()) as Input;
    if (!body?.opportunity_id) {
      return new Response(JSON.stringify({ error: 'opportunity_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: opp, error: oppErr } = await supabase
      .from('opportunities')
      .select('id, organization_id, account_id, contact_id, owner_user_id, status, stage_id, pipeline_id, valor_previsto, prob, opportunity_score, opportunity_grade, won_at, lost_at, created_at, updated_at, deleted_at')
      .eq('id', body.opportunity_id)
      .maybeSingle();

    if (oppErr) throw oppErr;
    if (!opp) {
      return new Response(JSON.stringify({ error: 'opportunity not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (opp.deleted_at) {
      return new Response(JSON.stringify({ skipped: 'deleted' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = opp.organization_id;
    const now = new Date();

    // ---- Fetch related signals
    const [activitiesRes, accountRes, proposalsRes, emailsRes, contactsRes, oppNodeRes, dealParticipantsRes] = await Promise.all([
      supabase.from('activities')
        .select('id, status, type, completed_at, scheduled_date, created_at, deleted_at')
        .eq('opportunity_id', opp.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
      opp.account_id
        ? supabase.from('accounts')
            .select('id, lead_score, fit_score, intent_score')
            .eq('id', opp.account_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      supabase.from('proposals')
        .select('id, status, sent_at, viewed_at, accepted_at, expires_at')
        .eq('opportunity_id', opp.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('opportunity_emails')
        .select('id, opened_at, sent_at')
        .eq('opportunity_id', opp.id)
        .order('sent_at', { ascending: false })
        .limit(50),
      opp.account_id
        ? supabase.from('contacts')
            .select('id, cargo')
            .eq('account_id', opp.account_id)
            .is('deleted_at', null)
        : Promise.resolve({ data: [], error: null } as any),
      supabase.from('graph_nodes')
        .select('id')
        .eq('organization_id', orgId)
        .eq('entity_id', opp.id)
        .eq('node_type', 'opportunity')
        .maybeSingle(),
      supabase.from('deal_participants')
        .select('id')
        .eq('opportunity_id', opp.id)
        .eq('role', 'decision_maker')
        .limit(1),
    ]);

    const activities = activitiesRes.data ?? [];
    const account = accountRes.data;
    const proposals = proposalsRes.data ?? [];
    const emails = emailsRes.data ?? [];
    const contacts = contactsRes.data ?? [];

    const isWon = opp.status === 'won' || !!opp.won_at;
    const isLost = opp.status === 'lost' || !!opp.lost_at;

    const completedActivities = activities.filter((a: any) => a.completed_at);
    const futureActivities = activities.filter((a: any) =>
      a.status !== 'completed' && a.scheduled_date && new Date(a.scheduled_date) > now
    );
    const overdueActivities = activities.filter((a: any) =>
      a.status !== 'completed' && a.scheduled_date && new Date(a.scheduled_date) < now
    );

    const lastCompleted = completedActivities[0];
    const lastUpdate = new Date(opp.updated_at);
    const daysSinceUpdate = daysBetween(now, lastUpdate);
    const daysSinceLastActivity = lastCompleted
      ? daysBetween(now, new Date(lastCompleted.completed_at))
      : 999;

    const oppNodeId = (oppNodeRes.data as any)?.id;
    let hasExplicitDecisionMaker = false;
    if (oppNodeId) {
      const { data: dmEdge, error: dmEdgeErr } = await supabase.from('graph_edges')
        .select('id')
        .eq('organization_id', orgId)
        .eq('target_node_id', oppNodeId)
        .eq('edge_type', 'decision_maker')
        .limit(1)
        .maybeSingle();
      if (dmEdgeErr) console.warn('decision_maker edge query failed:', dmEdgeErr.message);
      hasExplicitDecisionMaker = !!dmEdge;
    }

    const primaryContact = contacts[0] || null;
    const hasDecisorByCargo = contacts.some((c: any) =>
      typeof c.cargo === 'string' && /diretor|ceo|gerente|head|c-?level|presidente|s[oó]cio|owner|founder/i.test(c.cargo)
    );
    const hasDecisor = hasExplicitDecisionMaker || ((dealParticipantsRes.data as any[]) ?? []).length > 0 || hasDecisorByCargo;

    const acceptedProposal = proposals.find((p: any) => p.status === 'accepted');
    const sentProposal = proposals.find((p: any) => p.sent_at);
    const expiredProposal = proposals.find((p: any) =>
      p.expires_at && new Date(p.expires_at) < now && p.status !== 'accepted'
    );

    // ============================================================
    // ENGAGEMENT SCORE (0-100)
    // ============================================================
    let engagement = 50;
    const engagementEvents: string[] = [];

    const respondedEmails = emails.filter((e: any) => e.opened_at);
    if (respondedEmails.length > 0) {
      engagement += Math.min(20, respondedEmails.length * 4);
      engagementEvents.push(`${respondedEmails.length} emails abertos (+${Math.min(20, respondedEmails.length * 4)})`);
    }

    const meetingsDone = completedActivities.filter((a: any) =>
      ['meeting','call','reuniao','reunião'].includes((a.type || '').toLowerCase())
    ).length;
    if (meetingsDone > 0) {
      engagement += Math.min(24, meetingsDone * 8);
      engagementEvents.push(`${meetingsDone} reuniões/calls (+${Math.min(24, meetingsDone * 8)})`);
    }

    if (sentProposal?.viewed_at) {
      engagement += 8;
      engagementEvents.push('Proposta visualizada (+8)');
    }

    if (daysSinceLastActivity <= 1) {
      engagement += 6;
      engagementEvents.push('Atividade nas últimas 24h (+6)');
    } else if (daysSinceLastActivity <= 3) {
      engagement += 4;
      engagementEvents.push('Atividade nos últimos 3 dias (+4)');
    } else if (daysSinceLastActivity >= 30) {
      engagement -= 20;
      engagementEvents.push('Sem atividade há 30+ dias (-20)');
    } else if (daysSinceLastActivity >= 14) {
      engagement -= 12;
      engagementEvents.push('Sem atividade há 14+ dias (-12)');
    } else if (daysSinceLastActivity >= 7) {
      engagement -= 6;
      engagementEvents.push('Sem atividade há 7+ dias (-6)');
    }

    engagement = clamp(engagement);

    // ============================================================
    // VELOCITY SCORE (0-100)
    // ============================================================
    let velocity = 50;
    const velocityEvents: string[] = [];

    if (daysSinceUpdate <= 1) {
      velocity += 25;
      velocityEvents.push('Atualizada nas últimas 24h (+25)');
    } else if (daysSinceUpdate <= 3) {
      velocity += 15;
      velocityEvents.push('Atualizada nos últimos 3 dias (+15)');
    } else if (daysSinceUpdate <= 7) {
      velocity += 8;
      velocityEvents.push('Atualizada nos últimos 7 dias (+8)');
    }

    if (futureActivities.length > 0) {
      velocity += 20;
      velocityEvents.push(`Próxima atividade agendada (+20)`);
    } else {
      velocity -= 15;
      velocityEvents.push('Sem próxima atividade (-15)');
    }

    if (daysSinceUpdate > 30) {
      velocity -= 50;
      velocityEvents.push('Parada há 30+ dias (-50)');
    } else if (daysSinceUpdate > 14) {
      velocity -= 30;
      velocityEvents.push('Parada há 14+ dias (-30)');
    } else if (daysSinceUpdate > 7) {
      velocity -= 15;
      velocityEvents.push('Parada há 7+ dias (-15)');
    }

    velocity = clamp(velocity);

    // ============================================================
    // RISK SCORE (0-100, higher = more risk)
    // ============================================================
    let risk = 0;
    const riskEvents: string[] = [];

    if (futureActivities.length === 0) { risk += 25; riskEvents.push('Sem próxima atividade (+25)'); }
    if (overdueActivities.length === 1) { risk += 15; riskEvents.push('Atividade vencida (+15)'); }
    if (overdueActivities.length >= 2) { risk += 25; riskEvents.push('Múltiplas atividades vencidas (+25)'); }
    if (!hasDecisor) { risk += 20; riskEvents.push('Sem decisor identificado (+20)'); }
    if (!primaryContact) { risk += 20; riskEvents.push('Sem contato principal (+20)'); }
    if (!opp.owner_user_id) { risk += 30; riskEvents.push('Sem responsável (+30)'); }

    if (daysSinceLastActivity >= 30) { risk += 50; riskEvents.push('Sem interação há 30+ dias (+50)'); }
    else if (daysSinceLastActivity >= 14) { risk += 30; riskEvents.push('Sem interação há 14+ dias (+30)'); }
    else if (daysSinceLastActivity >= 7) { risk += 15; riskEvents.push('Sem interação há 7+ dias (+15)'); }

    if (!opp.valor_previsto || opp.valor_previsto <= 0) { risk += 25; riskEvents.push('Sem valor definido (+25)'); }
    if (expiredProposal) { risk += 25; riskEvents.push('Proposta vencida (+25)'); }

    if (daysSinceUpdate > 30) { risk += 60; riskEvents.push('Parada há 30+ dias (+60)'); }
    else if (daysSinceUpdate > 14) { risk += 30; riskEvents.push('Parada há 14+ dias (+30)'); }

    risk = clamp(risk);
    const riskLevel = risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low';

    // ============================================================
    // NRHS (0-100): Data + Contact + Deal + Activity + Timeline - Blockers
    // ============================================================
    const blockers: string[] = [];
    if (!opp.owner_user_id) blockers.push('no_owner');
    if (!primaryContact) blockers.push('no_primary_contact');
    if (!hasDecisor) blockers.push('no_decisor');
    if (futureActivities.length === 0) blockers.push('no_next_activity');
    if (!opp.valor_previsto) blockers.push('no_amount');
    if (overdueActivities.length > 0) blockers.push('overdue_activity');
    if (daysSinceUpdate > 14) blockers.push('stale_stage');

    const dataCompleteness =
      (opp.valor_previsto ? 8 : 0) +
      (opp.stage_id ? 5 : 0) +
      (opp.account_id ? 6 : 0) +
      (opp.contact_id ? 6 : 0); // /25
    const contactQuality =
      (primaryContact ? 10 : 0) + (hasDecisor ? 10 : 0); // /20
    const dealHygiene =
      (opp.owner_user_id ? 10 : 0) +
      (opp.valor_previsto ? 10 : 0) +
      (opp.prob ? 5 : 0); // /25
    const activityHygiene =
      (futureActivities.length > 0 ? 12 : 0) +
      (completedActivities.length > 0 ? 5 : 0) +
      (overdueActivities.length === 0 ? 3 : 0); // /20
    const timelineHygiene =
      (daysSinceUpdate <= 7 ? 10 : daysSinceUpdate <= 14 ? 5 : 0); // /10

    const nrhsRaw = dataCompleteness + contactQuality + dealHygiene + activityHygiene + timelineHygiene
      - blockers.length * 3;
    const nrhs = clamp(nrhsRaw);
    // Canonical NRHS tier vocabulary (must match src/services/crm/nrhs-calculator.ts):
    // elite >= 90, healthy >= 75, risk >= 60, critical >= 40, insalubrious < 40.
    const nrhsTier =
      nrhs >= 90 ? 'elite'
      : nrhs >= 75 ? 'healthy'
      : nrhs >= 60 ? 'risk'
      : nrhs >= 40 ? 'critical'
      : 'insalubrious';

    // ============================================================
    // DEAL HEALTH (categorical)
    // ============================================================
    let dealHealth = 'attention';
    let dealHealthScore = 50;
    let dealHealthReason = '';

    const oppScore = opp.opportunity_score ?? 0;
    const hasCriticalBlocker = blockers.some((b) => ['no_owner','no_next_activity'].includes(b));

    if (isWon) { dealHealth = 'healthy'; dealHealthScore = 100; dealHealthReason = 'Ganha'; }
    else if (isLost) { dealHealth = 'stalled'; dealHealthScore = 0; dealHealthReason = 'Perdida'; }
    else if (daysSinceUpdate > 30 || oppScore < 20) {
      dealHealth = 'stalled'; dealHealthScore = 15; dealHealthReason = 'Sem movimento há 30+ dias';
    } else if (futureActivities.length === 0 || daysSinceUpdate > 14 || engagement < 20 || expiredProposal) {
      dealHealth = 'risk'; dealHealthScore = 30;
      dealHealthReason = futureActivities.length === 0 ? 'Sem próxima atividade'
        : expiredProposal ? 'Proposta vencida'
        : daysSinceUpdate > 14 ? 'Parada há 14+ dias' : 'Engagement baixo';
    } else if (oppScore >= 80 && nrhs >= 75 && !hasCriticalBlocker) {
      dealHealth = 'hot'; dealHealthScore = 90; dealHealthReason = 'Score alto + dados saudáveis';
    } else if (oppScore >= 60 && nrhs >= 70 && futureActivities.length > 0 && !hasCriticalBlocker) {
      dealHealth = 'healthy'; dealHealthScore = 75; dealHealthReason = 'Score bom + atividades em dia';
    } else {
      dealHealth = 'attention'; dealHealthScore = 50;
      dealHealthReason = oppScore < 40 ? 'Score baixo' : 'Sinais mistos';
    }

    // ============================================================
    // AI WIN PROBABILITY (0-100) — explainable, with caps
    // Components: Opp Score 45% + Probability 25% + Lead 15% + NRHS 10% + History 5%
    // ============================================================
    const probability = Number(opp.prob ?? 0);
    const leadScore = Number(account?.lead_score ?? 50);
    const history = 50; // neutral until real history model exists

    const cOpp = oppScore * 0.45;
    const cProb = probability * 0.25;
    const cLead = leadScore * 0.15;
    const cNrhs = nrhs * 0.10;
    const cHist = history * 0.05;

    let aiWinRaw = cOpp + cProb + cLead + cNrhs + cHist;
    let aiWin = clamp(aiWinRaw);

    const capsApplied: string[] = [];

    // Mandatory caps
    if (isWon) { aiWin = 100; capsApplied.push('won=100'); }
    else if (isLost) { aiWin = 0; capsApplied.push('lost=0'); }
    else {
      // Open opportunities can never reach 100 automatically
      if (aiWin > 95) { aiWin = 95; capsApplied.push('open_max=95'); }
      if (futureActivities.length === 0 && aiWin > 59) { aiWin = 59; capsApplied.push('no_next_activity_max=59'); }
      if (!opp.owner_user_id && aiWin > 49) { aiWin = 49; capsApplied.push('no_owner_max=49'); }
      if (daysSinceUpdate > 14 && aiWin > 49) { aiWin = 49; capsApplied.push('stale_14d_max=49'); }
      if (!hasDecisor && aiWin > 69) { aiWin = 69; capsApplied.push('no_decisor_max=69'); }
      if (engagement < 20 && aiWin > 69) { aiWin = 69; capsApplied.push('low_engagement_max=69'); }
      if (!primaryContact && aiWin > 69) { aiWin = 69; capsApplied.push('no_primary_contact_max=69'); }
      if (!opp.valor_previsto && aiWin > 59) { aiWin = 59; capsApplied.push('no_amount_max=59'); }
    }

    // ============================================================
    // PERSIST
    // ============================================================
    const aiWinMetadata = {
      formula_version: FORMULA_VERSION,
      components: {
        opportunity_score: { value: oppScore, weight: 0.45, contribution: Math.round(cOpp) },
        probability: { value: probability, weight: 0.25, contribution: Math.round(cProb) },
        lead_score: { value: leadScore, weight: 0.15, contribution: Math.round(cLead) },
        nrhs: { value: nrhs, weight: 0.10, contribution: Math.round(cNrhs) },
        history: { value: history, weight: 0.05, contribution: Math.round(cHist) },
      },
      raw_score: Math.round(aiWinRaw),
      caps_applied: capsApplied,
      computed_at: now.toISOString(),
    };

    const updatePayload: Record<string, unknown> = {
      engagement_score: engagement,
      engagement_updated_at: now.toISOString(),
      engagement_metadata: { events: engagementEvents, formula_version: FORMULA_VERSION },
      velocity_score: velocity,
      velocity_updated_at: now.toISOString(),
      velocity_metadata: { events: velocityEvents, days_since_update: daysSinceUpdate, formula_version: FORMULA_VERSION },
      risk_score: risk,
      risk_level: riskLevel,
      risk_updated_at: now.toISOString(),
      risk_metadata: { events: riskEvents, formula_version: FORMULA_VERSION },
      deal_health: dealHealth,
      deal_health_score: dealHealthScore,
      deal_health_updated_at: now.toISOString(),
      deal_health_metadata: { reason: dealHealthReason, blockers, formula_version: FORMULA_VERSION },
      win_probability_ai: aiWin,
      ai_win_probability_updated_at: now.toISOString(),
      ai_win_probability_metadata: aiWinMetadata,
      indicators_updated_at: now.toISOString(),
    };

    const { error: updErr } = await supabase
      .from('opportunities')
      .update(updatePayload)
      .eq('id', opp.id);
    if (updErr) throw updErr;

    // History (best-effort, do not fail the run)
    try {
      await supabase.from('score_history').insert([
        { organization_id: orgId, entity_type: 'opportunity', entity_id: opp.id, score_type: 'ai_win', score_value: aiWin, metadata: aiWinMetadata },
        { organization_id: orgId, entity_type: 'opportunity', entity_id: opp.id, score_type: 'engagement', score_value: engagement, metadata: { events: engagementEvents } },
        { organization_id: orgId, entity_type: 'opportunity', entity_id: opp.id, score_type: 'velocity', score_value: velocity, metadata: { events: velocityEvents } },
        { organization_id: orgId, entity_type: 'opportunity', entity_id: opp.id, score_type: 'risk', score_value: risk, metadata: { level: riskLevel, events: riskEvents } },
      ]);
    } catch (e) {
      console.warn('score_history insert failed:', e);
    }

    return new Response(JSON.stringify({
      ok: true,
      opportunity_id: opp.id,
      indicators: { engagement, velocity, risk, risk_level: riskLevel, nrhs, nrhs_tier: nrhsTier, deal_health: dealHealth, ai_win: aiWin },
      caps_applied: capsApplied,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('calculate-opportunity-indicators error', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
