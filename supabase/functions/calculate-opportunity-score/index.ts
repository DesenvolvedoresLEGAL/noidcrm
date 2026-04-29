// Sprint Scoring 1.2 — deterministic Opportunity Score (singular).
// Formula: Stage Strength + Deal Signals + Velocity + Engagement + Risk Adjustment
// Persists score, grade, health, score_updated_at, opportunity_score_metadata
// on `opportunities` and writes a snapshot to `score_history`.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Health = 'hot' | 'healthy' | 'attention' | 'risk' | 'stalled';
type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

const STAGE_NAME_MAP: Record<string, number> = {
  'lead captado': 5,
  '1ª tentativa': 8,
  '1a tentativa': 8,
  '2ª tentativa': 10,
  '2a tentativa': 10,
  '3ª tentativa': 12,
  '3a tentativa': 12,
  '4ª tentativa': 13,
  '4a tentativa': 13,
  '5ª tentativa': 14,
  '5a tentativa': 14,
  '6ª tentativa': 15,
  '6a tentativa': 15,
  '7ª tentativa': 16,
  '7a tentativa': 16,
  'em qualificação': 18,
  'em qualificacao': 18,
  qualificado: 22,
  qualificada: 22,
  'proposta na mesa': 24,
  negociação: 25,
  negociacao: 25,
  'pre aprovação': 25,
  'pre aprovacao': 25,
  'pré-aprovação': 25,
  'pré aprovação': 25,
};

const ADVANCED_STAGES = new Set([
  'qualificado',
  'qualificada',
  'proposta na mesa',
  'negociação',
  'negociacao',
  'pre aprovação',
  'pre aprovacao',
  'pré-aprovação',
  'pré aprovação',
]);

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function gradeFor(score: number): Grade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function healthFor(score: number, stalled: boolean): Health {
  if (stalled) return 'stalled';
  if (score >= 80) return 'hot';
  if (score >= 60) return 'healthy';
  if (score >= 40) return 'attention';
  if (score >= 20) return 'risk';
  return 'stalled';
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const opportunityId: string | undefined =
      body.opportunity_id ?? body.opportunityId;
    const triggerSource: string = body.trigger_source ?? 'manual';
    const triggerAction: string = body.trigger_action ?? 'manual';

    if (!opportunityId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'opportunity_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Load opportunity + linked entities
    const { data: opp, error: oppErr } = await supabase
      .from('opportunities')
      .select(
        `id, organization_id, account_id, contact_id, owner_user_id,
         stage_id, status, valor_previsto, prob, close_date_prevista,
         next_followup_date, last_contact_date, days_since_contact,
         closed_at, won_at, lost_at, loss_reason_id, origem, fonte,
         opportunity_score, opportunity_grade, opportunity_health,
         scoring_factors, deleted_at, created_at, updated_at`,
      )
      .eq('id', opportunityId)
      .maybeSingle();
    if (oppErr) throw oppErr;
    if (!opp) {
      return new Response(
        JSON.stringify({ ok: false, error: 'opportunity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const organizationId = opp.organization_id;
    const previousScore: number | null = opp.opportunity_score ?? null;
    const previousGrade: string | null = opp.opportunity_grade ?? null;

    // Stage info
    let stage: any = null;
    if (opp.stage_id) {
      const { data: s } = await supabase
        .from('stages')
        .select('id, name, order_index, pipeline_id, stagnation_alert_days')
        .eq('id', opp.stage_id)
        .maybeSingle();
      stage = s ?? null;
    }
    const stageNameRaw = (stage?.name ?? '').toString().trim().toLowerCase();
    const isWonStage = stageNameRaw.includes('ganho') || stageNameRaw.includes('won');
    const isLostStage =
      stageNameRaw.includes('perd') ||
      stageNameRaw.includes('lost') ||
      stageNameRaw.includes('desqual');

    // Account (for lead_score signal)
    let account: any = null;
    if (opp.account_id) {
      const { data: a } = await supabase
        .from('accounts')
        .select('id, lead_score, lead_grade')
        .eq('id', opp.account_id)
        .maybeSingle();
      account = a ?? null;
    }

    // Activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, status, completed_at, scheduled_date, deleted_at')
      .eq('opportunity_id', opportunityId)
      .is('deleted_at', null)
      .limit(500);
    const acts = activities ?? [];

    // Proposals
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, status, sent_at, viewed_at, accepted_at, expires_at, total_amount')
      .eq('opportunity_id', opportunityId)
      .limit(50);
    const props = proposals ?? [];

    // Emails (communications)
    const { data: emails } = await supabase
      .from('opportunity_emails')
      .select('id, direction, sent_at, opened_at, clicked_at, created_at')
      .eq('opportunity_id', opportunityId)
      .limit(200);
    const mails = emails ?? [];

    // Stage change history (audit_log)
    const { data: stageChanges } = await supabase
      .from('audit_log')
      .select('created_at, action')
      .eq('entity_id', opportunityId)
      .eq('action', 'stage_moved')
      .order('created_at', { ascending: false })
      .limit(20);
    const sChanges = stageChanges ?? [];

    const now = new Date();
    const D = (d: string | null | undefined) => (d ? new Date(d) : null);

    // ---------- Terminal states ----------
    let terminal: { score: number; grade: Grade; health: Health } | null = null;
    if (opp.status === 'won' || isWonStage) {
      terminal = { score: 100, grade: 'A', health: 'hot' };
    } else if (
      opp.status === 'lost' ||
      opp.status === 'disqualified' ||
      isLostStage
    ) {
      terminal = { score: 0, grade: 'F', health: 'stalled' };
    }

    // ---------- Stage Strength (0..25) ----------
    let stageStrength = 0;
    if (stageNameRaw && STAGE_NAME_MAP[stageNameRaw] !== undefined) {
      stageStrength = STAGE_NAME_MAP[stageNameRaw];
    } else if (stage?.order_index !== undefined && stage?.order_index !== null) {
      // Fallback: normalize order_index to 0..25 against pipeline max order
      const { data: maxRow } = await supabase
        .from('stages')
        .select('order_index')
        .eq('pipeline_id', stage.pipeline_id)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxOrder = (maxRow?.order_index ?? 0) || 1;
      stageStrength = clamp(
        Math.round(((stage.order_index || 0) / maxOrder) * 25),
        0,
        25,
      );
    }
    stageStrength = clamp(stageStrength, 0, 25);

    // ---------- Deal Signals (0..25) ----------
    let dealSignals = 0;
    const dealSignalsBreakdown: Record<string, number> = {};
    const addSig = (k: string, v: number) => {
      dealSignals += v;
      dealSignalsBreakdown[k] = v;
    };
    if ((opp.valor_previsto ?? 0) > 0) addSig('amount', 4);
    if (opp.owner_user_id) addSig('owner', 3);
    if (opp.contact_id) addSig('primary_contact', 3);
    if (opp.next_followup_date) addSig('next_step', 5);
    if (opp.close_date_prevista) addSig('expected_close', 3);
    const proposalSent = props.some(
      (p: any) => p.sent_at || ['sent', 'viewed', 'accepted'].includes(p.status),
    );
    if (proposalSent) addSig('proposal_sent', 4);
    if (opp.origem || opp.fonte) addSig('origin', 2);
    dealSignals = clamp(dealSignals, 0, 25);

    // ---------- Velocity (0..20) ----------
    let velocity = 10;
    const velocityBreakdown: Record<string, number> = { base: 10 };
    const created = D(opp.created_at);
    if (created && daysBetween(now, created) < 1) {
      velocity += 5;
      velocityBreakdown.created_recent = 5;
    }
    const lastStageChange = D(sChanges[0]?.created_at ?? null);
    if (lastStageChange) {
      const dsc = daysBetween(now, lastStageChange);
      if (dsc <= 1) {
        velocity += 8;
        velocityBreakdown.stage_change_24h = 8;
      } else if (dsc <= 3) {
        velocity += 6;
        velocityBreakdown.stage_change_3d = 6;
      } else if (dsc > 30) {
        velocity -= 20;
        velocityBreakdown.stalled_30d = -20;
      } else if (dsc > 14) {
        velocity -= 15;
        velocityBreakdown.stalled_14d = -15;
      } else if (dsc > 7) {
        velocity -= 8;
        velocityBreakdown.stalled_7d = -8;
      }
    }
    const recentCompleted = acts.filter((a: any) => {
      const c = D(a.completed_at);
      return c && daysBetween(now, c) <= 1;
    }).length;
    const completed3d = acts.filter((a: any) => {
      const c = D(a.completed_at);
      return c && daysBetween(now, c) <= 3;
    }).length;
    if (recentCompleted > 0) {
      velocity += 6;
      velocityBreakdown.activity_24h = 6;
    } else if (completed3d > 0) {
      velocity += 4;
      velocityBreakdown.activity_3d = 4;
    }
    const futureActivity = acts.some((a: any) => {
      const sd = D(a.scheduled_date);
      return sd && sd > now && a.status !== 'completed';
    });
    if (futureActivity) {
      velocity += 6;
      velocityBreakdown.future_activity = 6;
    }
    velocity = clamp(velocity, 0, 20);

    // ---------- Engagement (0..20) ----------
    let engagement = 0;
    const engagementBreakdown: Record<string, number> = {};
    const addEng = (k: string, v: number) => {
      engagement += v;
      engagementBreakdown[k] = (engagementBreakdown[k] ?? 0) + v;
    };
    const meetingDone = acts.some(
      (a: any) => a.type === 'meeting' && a.status === 'completed',
    );
    if (meetingDone) addEng('meeting_done', 8);
    const callDone = acts.some(
      (a: any) => a.type === 'call' && a.status === 'completed',
    );
    if (callDone) addEng('call_done', 6);
    if (mails.some((m: any) => m.direction === 'inbound')) addEng('email_replied', 4);
    if (
      acts.some(
        (a: any) =>
          (a.type === 'whatsapp' || a.type === 'wpp') && a.status === 'completed',
      )
    )
      addEng('wpp_replied', 5);
    if (props.some((p: any) => p.viewed_at)) addEng('proposal_viewed', 8);
    if (mails.some((m: any) => m.clicked_at)) addEng('link_clicked', 4);
    const inboundRecent = mails.some((m: any) => {
      const dt = D(m.opened_at) || D(m.clicked_at) ||
        (m.direction === 'inbound' ? D(m.created_at) : null);
      return dt && daysBetween(now, dt) <= 1;
    });
    const inbound3d = mails.some((m: any) => {
      const dt = D(m.opened_at) || D(m.clicked_at) ||
        (m.direction === 'inbound' ? D(m.created_at) : null);
      return dt && daysBetween(now, dt) <= 3;
    });
    if (inboundRecent) addEng('client_reply_24h', 6);
    else if (inbound3d) addEng('client_reply_3d', 4);
    // Negative if no contact
    const dsc = opp.days_since_contact ?? 0;
    if (dsc > 30) addEng('no_contact_30d', -20);
    else if (dsc > 14) addEng('no_contact_14d', -12);
    else if (dsc > 7) addEng('no_contact_7d', -6);
    engagement = clamp(engagement, 0, 20);

    // ---------- Risk Adjustment (-20..+10) ----------
    let risk = 0;
    const riskBreakdown: Record<string, number> = {};
    const addRisk = (k: string, v: number) => {
      risk += v;
      riskBreakdown[k] = (riskBreakdown[k] ?? 0) + v;
    };
    const overdueActs = acts.filter((a: any) => {
      const sd = D(a.scheduled_date);
      return (
        sd &&
        sd < now &&
        a.status !== 'completed' &&
        a.status !== 'cancelled'
      );
    });
    if (overdueActs.length > 2) addRisk('overdue_2plus', -10);
    else if (overdueActs.length >= 1) addRisk('overdue_activity', -5);
    if (!opp.next_followup_date) addRisk('no_next_step', -10);
    if (!opp.contact_id) addRisk('no_valid_contact', -10);
    if (dsc >= 7) addRisk('no_recent_interaction', -8);
    if (dsc >= 14) addRisk('ghosting', -15);
    // Advanced stage without proposal
    if (ADVANCED_STAGES.has(stageNameRaw) && !proposalSent)
      addRisk('advanced_without_proposal', -10);
    // Expired proposal
    const expiredProposal = props.some((p: any) => {
      const exp = D(p.expires_at);
      return exp && exp < now && !p.accepted_at;
    });
    if (expiredProposal) addRisk('proposal_expired', -10);
    // Positive signals
    if ((account?.lead_score ?? 0) >= 80) addRisk('account_lead_score_hot', 5);
    if (opp.fonte === 'indicacao' || opp.origem === 'indicacao')
      addRisk('referral', 5);
    risk = clamp(risk, -20, 10);

    // ---------- Raw + caps ----------
    const rawScore =
      stageStrength + dealSignals + velocity + engagement + risk;
    let score = clamp(rawScore, 0, 100);
    const capsApplied: string[] = [];
    const isOpen = !['won', 'lost', 'disqualified'].includes(opp.status ?? '');

    if (isOpen) {
      if (!opp.next_followup_date && score > 59) {
        score = 59;
        capsApplied.push('no_next_step:59');
      }
      if (!opp.contact_id && score > 69) {
        score = 69;
        capsApplied.push('no_primary_contact:69');
      }
      if (!opp.owner_user_id && score > 49) {
        score = 49;
        capsApplied.push('no_owner:49');
      }
      if (lastStageChange && daysBetween(now, lastStageChange) > 14 && score > 49) {
        score = 49;
        capsApplied.push('stalled_14d:49');
      }
      // Proposta sem retorno: viewed_at > 5 dias e sem aceite
      const staleProposal = props.some((p: any) => {
        const v = D(p.viewed_at);
        return v && daysBetween(now, v) > 5 && !p.accepted_at;
      });
      if (staleProposal && score > 59) {
        score = 59;
        capsApplied.push('proposal_stale:59');
      }
      if (
        ADVANCED_STAGES.has(stageNameRaw) &&
        (!opp.valor_previsto || Number(opp.valor_previsto) <= 0) &&
        score > 59
      ) {
        score = 59;
        capsApplied.push('advanced_without_amount:59');
      }
      if (overdueActs.length > 3 && score > 49) {
        score = 49;
        capsApplied.push('many_overdue:49');
      }
    }

    let stalledFlag = false;
    if (
      isOpen &&
      lastStageChange &&
      daysBetween(now, lastStageChange) > 14 &&
      !opp.next_followup_date
    ) {
      stalledFlag = true;
    }

    let grade: Grade = gradeFor(score);
    let health: Health = healthFor(score, stalledFlag);

    if (terminal) {
      score = terminal.score;
      grade = terminal.grade;
      health = terminal.health;
    }

    const metadata = {
      stage_strength: stageStrength,
      deal_signals: dealSignals,
      deal_signals_breakdown: dealSignalsBreakdown,
      velocity,
      velocity_breakdown: velocityBreakdown,
      engagement,
      engagement_breakdown: engagementBreakdown,
      risk_adjustment: risk,
      risk_breakdown: riskBreakdown,
      raw_score: rawScore,
      caps_applied: capsApplied,
      terminal: terminal ? { applied: true, status: opp.status } : null,
      trigger_source: triggerSource,
      trigger_action: triggerAction,
      calculated_at: now.toISOString(),
      stage_name: stage?.name ?? null,
    };

    // Persist to opportunities
    const { error: updErr } = await supabase
      .from('opportunities')
      .update({
        opportunity_score: score,
        opportunity_grade: grade,
        opportunity_health: health,
        opportunity_score_metadata: metadata,
        score_updated_at: now.toISOString(),
        // Keep legacy columns in sync for backwards-compat consumers
        engagement_score: engagement * 5, // 0..100 scale
        velocity_score: clamp(velocity * 5, 0, 100),
        risk_score: clamp(Math.abs(Math.min(0, risk)) * 5, 0, 100),
      })
      .eq('id', opportunityId);
    if (updErr) throw updErr;

    // Score history snapshot (best-effort)
    await supabase.from('score_history').insert({
      organization_id: organizationId,
      entity_type: 'opportunity',
      entity_id: opportunityId,
      score_type: 'opportunity',
      old_value: previousScore,
      new_value: score,
      change_reason: triggerSource,
      factors: {
        ...metadata,
        previous_grade: previousGrade,
        new_grade: grade,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        opportunity_id: opportunityId,
        score,
        grade,
        health,
        metadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('calculate-opportunity-score error:', msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
