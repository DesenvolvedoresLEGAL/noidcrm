// Edge Function: calculate-nrhs (Sprint NRHS 1.5.1 — formula v1.1)
// Pesos:
//   Integridade do Deal:        0–30
//   Cadência e Próximo Passo:   0–25
//   Mapeamento de Stakeholders: 0–20
//   Qualidade Win/Loss:         0–15
//   Aderência Operacional:      0–10
//
// Regras chave:
//   - Blockers (críticos/altos) penalizam após a soma dos pilares.
//   - Gaps (médios/baixos) NÃO derrubam o score sozinhos — registram maturidade.
//   - Falha em activities NUNCA zera o pilar inteiro (fallback updated_at).
//   - Sem decisor em estágio inicial = gap; em estágio avançado = blocker.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type NRHSStatus = 'healthy' | 'risk' | 'critical' | 'unhealthy';

interface PillarItem {
  code: string;
  label: string;
  points: number;
  achieved: boolean;
}
interface Pillar { score: number; max: number; items: PillarItem[]; passed: string[]; issues: string[]; }

interface Blocker {
  code: string;
  severity: 'high' | 'critical';
  label: string;
  description: string;
  how_to_fix: string;
  penalty: number;
}
interface Gap {
  code: string;
  severity: 'low' | 'medium';
  label: string;
  description: string;
  recommended_action: string;
}
interface Recommendation {
  priority: 'low' | 'medium' | 'high';
  action: string;
  reason: string;
  expected_impact: string;
  target: string;
}

const ADVANCED_STAGE_KEYWORDS = [
  'proposta', 'negocia', 'contrato', 'pré-aprov', 'pre-aprov', 'fechamento', 'closing',
];

function isAdvancedStage(stageName?: string | null): boolean {
  if (!stageName) return false;
  const n = stageName.toLowerCase();
  return ADVANCED_STAGE_KEYWORDS.some((k) => n.includes(k));
}
function statusFromScore(score: number): NRHSStatus {
  if (score >= 75) return 'healthy';
  if (score >= 50) return 'risk';
  if (score >= 25) return 'critical';
  return 'unhealthy';
}
function tierFromScore(score: number): string {
  if (score >= 90) return 'elite';
  if (score >= 75) return 'healthy';
  if (score >= 50) return 'risk';
  if (score >= 25) return 'critical';
  return 'insalubrious';
}
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function daysBetween(a: Date, b: Date) { return Math.floor((a.getTime() - b.getTime()) / 86400000); }

function add(p: Pillar, code: string, label: string, points: number, achieved: boolean) {
  p.items.push({ code, label, points, achieved });
  if (achieved) { p.score += points; p.passed.push(code); }
  else { p.issues.push(code); }
}

// ---------- PILLARS v1.1 ----------

function pillarIntegrity(opp: any): Pillar {
  const p: Pillar = { score: 0, max: 30, items: [], passed: [], issues: [] };
  add(p, 'amount', 'Valor previsto preenchido', 6, !!opp.valor_previsto && Number(opp.valor_previsto) > 0);
  add(p, 'account', 'Conta vinculada', 5, !!opp.account_id);
  add(p, 'stage', 'Estágio definido', 5, !!opp.stage_id);
  add(p, 'pipeline', 'Pipeline definido', 4, !!opp.pipeline_id);
  add(p, 'owner', 'Responsável definido', 5, !!opp.owner_user_id);
  add(p, 'expected_close_date', 'Data prevista de fechamento', 3, !!opp.close_date_prevista);
  add(p, 'source', 'Origem preenchida', 2, !!(opp.origem || opp.fonte || opp.lead_type));
  p.score = clamp(p.score, 0, 30);
  return p;
}

function pillarCadence(opp: any, activities: any[] | null, now: Date, activitiesError: boolean): Pillar {
  const p: Pillar = { score: 0, max: 25, items: [], passed: [], issues: [] };

  if (activitiesError || !Array.isArray(activities)) {
    // Fallback mínimo: usa updated_at da oportunidade. NÃO zerar.
    const updated = opp.updated_at ? new Date(opp.updated_at) : null;
    const recent = !!updated && daysBetween(now, updated) <= 7;
    add(p, 'opportunity_recent_update', 'Oportunidade atualizada nos últimos 7 dias', 8, recent);
    p.score = clamp(p.score, 0, 25);
    return p;
  }

  const open = activities.filter((a) => a.status !== 'completed' && a.status !== 'cancelled' && !a.deleted_at);
  const overdue = open.filter((a) => a.scheduled_date && new Date(a.scheduled_date) < now);
  const next = open
    .filter((a) => a.scheduled_date && new Date(a.scheduled_date) >= now)
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0];

  const lastInteractionAt = activities
    .map((a) => new Date(a.completed_at || a.updated_at || 0))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const daysSinceLast = lastInteractionAt ? daysBetween(now, lastInteractionAt) : 999;

  add(p, 'has_next_activity', 'Tem próxima atividade futura', 10, !!next);
  add(p, 'recent_interaction_7d', 'Interação nos últimos 7 dias', 7, daysSinceLast <= 7);
  add(p, 'no_overdue', 'Sem atividade vencida', 5, overdue.length === 0);
  const updated = opp.updated_at ? new Date(opp.updated_at) : null;
  add(p, 'opportunity_recent_update', 'Oportunidade atualizada (≤7d)', 3, !!updated && daysBetween(now, updated) <= 7);

  p.score = clamp(p.score, 0, 25);
  return p;
}

interface StakeholderSignals {
  hasExplicitDecisionMaker: boolean;
  hasDealParticipantDecisionMaker: boolean;
}

function pillarStakeholders(
  contacts: any[],
  opp: any,
  stageName: string,
  signals: StakeholderSignals,
): { pillar: Pillar; advancedNoDecisor: boolean; missingDecisorSignal: boolean } {
  const p: Pillar = { score: 0, max: 20, items: [], passed: [], issues: [] };
  const primary = contacts.find((c) => c.id === opp.contact_id) ?? contacts[0];

  const hasContact = !!opp.contact_id || contacts.length > 0;
  const hasContactInfo = !!primary && (
    (Array.isArray(primary.emails) && primary.emails.length > 0) ||
    (Array.isArray(primary.telefones) && primary.telefones.length > 0) ||
    !!primary.email || !!primary.phone
  );
  const cargoDecisor = contacts.find((c) => {
    const cargo = (c.cargo || '').toLowerCase();
    return /diretor|ceo|cfo|coo|cto|presidente|s[oó]cio|founder|owner|chefe|head|decis/.test(cargo);
  });
  const hasDecisor = signals.hasExplicitDecisionMaker || signals.hasDealParticipantDecisionMaker || !!cargoDecisor;

  add(p, 'has_contact', 'Contato vinculado', 5, hasContact);
  add(p, 'contact_info', 'Contato com email/telefone', 5, !!hasContactInfo);
  add(p, 'decisor', 'Decisor identificado', 7, hasDecisor);
  add(p, 'multiple_stakeholders', 'Mais de um stakeholder', 3, contacts.length >= 2);

  p.score = clamp(p.score, 0, 20);
  const advanced = isAdvancedStage(stageName);
  return { pillar: p, advancedNoDecisor: advanced && !hasDecisor, missingDecisorSignal: !hasDecisor };
}

function pillarWinLoss(opp: any): { pillar: Pillar; winLossGapCodes: string[] } {
  const p: Pillar = { score: 0, max: 15, items: [], passed: [], issues: [] };
  const meta = (opp.nrhs_metadata && typeof opp.nrhs_metadata === 'object' ? opp.nrhs_metadata : {}) as any;
  const sm = (opp.source_metadata && typeof opp.source_metadata === 'object' ? opp.source_metadata : {}) as any;
  const allMeta = { ...meta, ...sm };

  const hasPain = !!(allMeta.pain || opp.pain || opp.dor);
  const hasObjection = !!(allMeta.objection || opp.objection);
  const hasNextAction = !!(allMeta.next_action || allMeta.next_step || opp.next_followup_date);
  const hasContext = !!(allMeta.advance_reason || allMeta.win_loss_context || opp.loss_comment);

  add(p, 'pain', 'Dor registrada', 4, hasPain);
  add(p, 'objection', 'Objeção registrada', 4, hasObjection);
  add(p, 'next_action', 'Próxima ação clara', 4, hasNextAction);
  add(p, 'wl_context', 'Contexto de avanço/perda', 3, hasContext);

  const gaps: string[] = [];
  if (!hasPain) gaps.push('missing_pain');
  if (!hasObjection) gaps.push('missing_objection');
  if (!allMeta.competitor && !opp.competitor) gaps.push('missing_competitor');
  if (!hasContext) gaps.push('missing_win_loss_context');
  if (!hasNextAction) gaps.push('missing_next_action_context');

  p.score = clamp(p.score, 0, 15);
  return { pillar: p, winLossGapCodes: gaps };
}

function pillarAdherence(opp: any, stageName: string, pipelineType: string | null): Pillar {
  const p: Pillar = { score: 0, max: 10, items: [], passed: [], issues: [] };
  const statusOk = !!opp.status && opp.status !== 'lost' && opp.status !== 'won';
  add(p, 'status_coherent', 'Status coerente', 3, statusOk);
  add(p, 'stage_coherent', 'Estágio coerente', 3, !!opp.stage_id);

  const prob = opp.prob ?? opp.probability ?? null;
  let probOk = true;
  if (prob != null) {
    const advanced = isAdvancedStage(stageName);
    if (advanced && prob < 30) probOk = false;
    if (!advanced && prob > 80) probOk = false;
  }
  add(p, 'probability_coherent', 'Probabilidade coerente', 2, probOk);

  const noGrave = !((isAdvancedStage(stageName) && !(opp.valor_previsto > 0)));
  add(p, 'no_grave_inconsistency', 'Sem inconsistência grave', 2,
    noGrave && (pipelineType === null || pipelineType === 'sales' || pipelineType === 'qualification'));

  p.score = clamp(p.score, 0, 10);
  return p;
}

// ---------- BLOCKERS / GAPS / RECOMMENDATIONS ----------

function buildBlockersAndGaps(
  opp: any,
  stageName: string,
  contacts: any[],
  activities: any[] | null,
  now: Date,
  advancedNoDecisor: boolean,
  missingDecisorSignal: boolean,
  winLossGapCodes: string[],
  activitiesError: boolean,
): { blockers: Blocker[]; gaps: Gap[] } {
  const blockers: Blocker[] = [];
  const gaps: Gap[] = [];
  const advanced = isAdvancedStage(stageName);

  const pushB = (code: string, severity: Blocker['severity'], label: string, description: string, how_to_fix: string, penalty: number) =>
    blockers.push({ code, severity, label, description, how_to_fix, penalty });
  const pushG = (code: string, severity: Gap['severity'], label: string, description: string, recommended_action: string) =>
    gaps.push({ code, severity, label, description, recommended_action });

  // BLOCKERS críticos
  if (!opp.owner_user_id) pushB('no_owner', 'critical', 'Sem responsável', 'A oportunidade não possui responsável comercial.', 'Defina um responsável.', 20);
  if (!opp.account_id) pushB('no_account', 'critical', 'Sem conta vinculada', 'A oportunidade não está vinculada a uma conta.', 'Vincule uma conta.', 15);
  if (!opp.stage_id) pushB('no_stage', 'high', 'Sem estágio', 'A oportunidade não está em nenhum estágio.', 'Coloque a oportunidade em um estágio.', 10);
  if (!opp.pipeline_id) pushB('no_pipeline', 'high', 'Sem pipeline', 'A oportunidade não está em nenhum pipeline.', 'Vincule a um pipeline.', 10);

  // Activities (pulam se erro)
  if (!activitiesError && Array.isArray(activities)) {
    const open = activities.filter((a) => a.status !== 'completed' && a.status !== 'cancelled' && !a.deleted_at);
    const overdue = open.filter((a) => a.scheduled_date && new Date(a.scheduled_date) < now);
    const next = open.find((a) => a.scheduled_date && new Date(a.scheduled_date) >= now);
    const lastInteractionAt = activities
      .map((a) => new Date(a.completed_at || a.updated_at || 0))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const daysStale = lastInteractionAt ? daysBetween(now, lastInteractionAt) : 999;

    if (advanced && !next) pushB('no_next_activity_advanced_stage', 'high', 'Sem próximo passo (estágio avançado)', 'Estágio avançado sem próxima atividade agendada.', 'Agende a próxima atividade.', 15);
    if (overdue.length === 1) pushB('overdue_activity', 'high', 'Atividade vencida', '1 atividade está vencida.', 'Conclua ou reagende a atividade.', 10);
    if (overdue.length >= 2) pushB('multiple_overdue_activities', 'critical', 'Múltiplas atividades vencidas', `${overdue.length} atividades vencidas.`, 'Conclua ou reagende as atividades.', 20);
    if (daysStale >= 14 && daysStale < 30) pushB('stale_14d', 'high', 'Sem movimento há 14d+', `Sem movimento há ${daysStale} dias.`, 'Registre uma interação.', 10);
    if (daysStale >= 30) pushB('stale_30d', 'critical', 'Sem movimento há 30d+', `Sem movimento há ${daysStale} dias.`, 'Reative ou desqualifique.', 20);
  }

  if (advanced && !(opp.valor_previsto > 0)) pushB('no_amount_advanced_stage', 'high', 'Sem valor (estágio avançado)', 'Estágio avançado sem valor previsto.', 'Preencha o valor da oportunidade.', 10);
  if (advancedNoDecisor) pushB('no_decisor_advanced_stage', 'high', 'Sem decisor (estágio avançado)', 'Estágio avançado sem decisor identificado.', 'Identifique o decisor.', 10);

  // Coerência operacional
  if (opp.status === 'won' || opp.status === 'lost') {
    if (!opp.closed_at) pushB('status_incoherent', 'high', 'Status incoerente', 'Status fechado sem closed_at coerente.', 'Verifique o fechamento.', 5);
  }

  // GAPS — não derrubam sozinhos
  if (missingDecisorSignal && !advancedNoDecisor)
    pushG('missing_decision_maker_signal', 'medium', 'Decisor não sinalizado', 'Nenhum contato marcado como decisor.', 'Identifique o decisor (mesmo em estágio inicial).');
  if (!opp.close_date_prevista)
    pushG('missing_expected_close_date', 'medium', 'Sem data prevista', 'Data prevista de fechamento ausente.', 'Defina a data prevista.');
  if (!(opp.origem || opp.fonte))
    pushG('missing_source', 'low', 'Origem ausente', 'Origem do lead não preenchida.', 'Preencha a origem.');
  if (contacts.length > 0 && !contacts.some((c) => c.cargo))
    pushG('missing_contact_role', 'low', 'Cargo do contato ausente', 'Nenhum contato com cargo preenchido.', 'Preencha o cargo dos contatos.');
  if (contacts.length < 2)
    pushG('missing_second_stakeholder', 'low', 'Único stakeholder', 'Apenas um stakeholder mapeado.', 'Mapeie influenciadores e usuários.');

  for (const c of winLossGapCodes) {
    const labels: Record<string, [string, string, string]> = {
      missing_pain: ['Dor não registrada', 'A dor comercial ainda não foi documentada.', 'Registrar a dor principal do cliente.'],
      missing_objection: ['Objeção não registrada', 'Objeções identificadas não foram registradas.', 'Registrar objeções identificadas.'],
      missing_competitor: ['Concorrente não identificado', 'Concorrência não foi mapeada.', 'Identificar o(s) concorrente(s).'],
      missing_win_loss_context: ['Contexto comercial ausente', 'Faltam motivos de avanço/perda.', 'Registrar contexto win/loss.'],
      missing_next_action_context: ['Próxima ação contextual ausente', 'Próxima ação clara não foi descrita.', 'Descrever próxima ação concreta.'],
    };
    const [label, description, action] = labels[c] || [c, c, c];
    pushG(c, 'medium', label, description, action);
  }

  return { blockers, gaps };
}

function buildRecommendations(blockers: Blocker[], gaps: Gap[]): Recommendation[] {
  const recs: Recommendation[] = [];
  const targetMap: Record<string, string> = {
    no_owner: 'owner_user_id',
    no_account: 'account_id',
    no_stage: 'stage_id',
    no_pipeline: 'pipeline_id',
    no_next_activity_advanced_stage: 'next_activity',
    overdue_activity: 'activities',
    multiple_overdue_activities: 'activities',
    stale_14d: 'next_activity',
    stale_30d: 'next_activity',
    no_amount_advanced_stage: 'valor_previsto',
    no_decisor_advanced_stage: 'decision_maker',
    status_incoherent: 'status',
  };
  for (const b of blockers) {
    recs.push({
      priority: 'high',
      action: b.how_to_fix,
      reason: b.description,
      expected_impact: `+${b.penalty} NRHS`,
      target: targetMap[b.code] ?? b.code,
    });
  }
  for (const g of gaps) {
    recs.push({
      priority: g.severity === 'medium' ? 'medium' : 'low',
      action: g.recommended_action,
      reason: g.description,
      expected_impact: g.severity === 'medium' ? '+2-4 NRHS' : '+1-2 NRHS',
      target: g.code,
    });
  }
  return recs;
}

// ---------- MAIN ----------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const opportunityId: string | undefined = body.opportunity_id;
    const orgIdInput: string | undefined = body.organization_id || body.org_id;
    const triggerSource: string = body.trigger_source ?? 'manual';
    const triggerAction: string = body.trigger_action ?? 'recalculate';

    if (!opportunityId) {
      return new Response(JSON.stringify({ error: 'opportunity_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: opportunity, error: oppErr } = await supabase
      .from('opportunities').select('*').eq('id', opportunityId).maybeSingle();
    if (oppErr || !opportunity) {
      return new Response(JSON.stringify({ error: 'opportunity not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (orgIdInput && opportunity.organization_id !== orgIdInput) {
      return new Response(JSON.stringify({ error: 'org mismatch' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stage (text id), Pipeline (text id), Account, Activities, Contacts — todos blindados
    const [stageRes, accountRes, contactsRes, pipelineRes] = await Promise.all([
      opportunity.stage_id
        ? supabase.from('stages').select('id, name').eq('id', opportunity.stage_id).maybeSingle()
        : Promise.resolve({ data: null }),
      opportunity.account_id
        ? supabase.from('accounts').select('id, segmento, porte, nome_fantasia, razao_social').eq('id', opportunity.account_id).maybeSingle()
        : Promise.resolve({ data: null }),
      opportunity.account_id
        ? supabase.from('contacts').select('*').eq('account_id', opportunity.account_id).is('deleted_at', null)
        : Promise.resolve({ data: [] }),
      opportunity.pipeline_id
        ? supabase.from('pipelines').select('id, pipeline_type').eq('id', opportunity.pipeline_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Activities — blindado: erro vira fallback, NUNCA derruba o pilar.
    let activities: any[] | null = null;
    let activitiesError = false;
    try {
      const { data: actData, error: actErr } = await supabase
        .from('activities')
        .select('id, type, status, scheduled_date, completed_at, updated_at, deleted_at')
        .eq('opportunity_id', opportunityId)
        .is('deleted_at', null);
      if (actErr) {
        activitiesError = true;
        console.warn('[calculate-nrhs] activities query failed (fallback):', actErr.message);
      } else {
        activities = actData ?? [];
      }
    } catch (e: any) {
      activitiesError = true;
      console.warn('[calculate-nrhs] activities exception (fallback):', e?.message);
    }

    const stageName = (stageRes.data as any)?.name ?? '';
    const contacts = (contactsRes.data as any[]) ?? [];
    const pipelineType = (pipelineRes.data as any)?.pipeline_type ?? null;
    const now = new Date();

    const integrity = pillarIntegrity(opportunity);
    const cadence = pillarCadence(opportunity, activities, now, activitiesError);
    const stk = pillarStakeholders(contacts, opportunity, stageName);
    const stakeholders = stk.pillar;
    const winLossRes = pillarWinLoss(opportunity);
    const winLoss = winLossRes.pillar;
    const adherence = pillarAdherence(opportunity, stageName, pipelineType);

    const { blockers, gaps } = buildBlockersAndGaps(
      opportunity, stageName, contacts, activities, now,
      stk.advancedNoDecisor, stk.missingDecisorSignal, winLossRes.winLossGapCodes,
      activitiesError,
    );
    const recommendations = buildRecommendations(blockers, gaps);

    const pillarsTotal = integrity.score + cadence.score + stakeholders.score + winLoss.score + adherence.score;
    const penaltiesTotal = blockers.reduce((s, b) => s + b.penalty, 0);
    const finalScore = clamp(Math.round(pillarsTotal - penaltiesTotal), 0, 100);
    const status = statusFromScore(finalScore);
    const tier = tierFromScore(finalScore);

    const pillarPayload = (p: Pillar) => ({ score: p.score, max: p.max, items: p.items, passed: p.passed, issues: p.issues });
    const metadata = {
      formula_version: 'nrhs_v1.1',
      pillars: {
        integrity: pillarPayload(integrity),
        cadence: pillarPayload(cadence),
        stakeholders: pillarPayload(stakeholders),
        winloss: pillarPayload(winLoss),
        adherence: pillarPayload(adherence),
      },
      // Backwards-compat keys (legacy normalizer):
      data_integrity: pillarPayload(integrity),
      win_loss: pillarPayload(winLoss),
      process_adherence: pillarPayload(adherence),
      penalties: blockers.map((b) => ({ code: b.code, penalty: b.penalty })),
      blockers,
      gaps,
      recommendations,
      activities_error: activitiesError,
      calculated_at: now.toISOString(),
    };

    const previousScore = opportunity.nrhs_score ?? null;
    const previousStatus = opportunity.nrhs_status ?? null;

    const { error: updErr } = await supabase
      .from('opportunities')
      .update({
        nrhs_score: finalScore,
        nrhs_status: status,
        nrhs_tier: tier,
        nrhs_data_integrity_score: integrity.score,
        nrhs_cadence_score: cadence.score,
        nrhs_stakeholders_score: stakeholders.score,
        nrhs_win_loss_score: winLoss.score,
        nrhs_process_adherence_score: adherence.score,
        nrhs_evidence_score: 0,
        nrhs_blockers: blockers,
        nrhs_gaps: gaps,
        nrhs_recommendations: recommendations,
        nrhs_metadata: metadata,
        nrhs_breakdown: metadata,
        nrhs_issues_count: blockers.length + gaps.length,
        nrhs_last_calculated_at: now.toISOString(),
        nrhs_updated_at: now.toISOString(),
        forecast_hygiene_eligible: finalScore >= 70,
        ote_hygiene_eligible: finalScore >= 75,
      })
      .eq('id', opportunityId);

    if (updErr) {
      console.error('[calculate-nrhs] update error:', updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // History (best-effort)
    try {
      await supabase.from('score_history').insert({
        organization_id: opportunity.organization_id,
        entity_type: 'opportunity',
        entity_id: opportunityId,
        score_type: 'nrhs',
        old_value: previousScore,
        new_value: finalScore,
        change_reason: triggerSource,
        factors: {
          previous_status: previousStatus,
          new_status: status,
          components: {
            integrity: integrity.score,
            cadence: cadence.score,
            stakeholders: stakeholders.score,
            winloss: winLoss.score,
            adherence: adherence.score,
          },
          blockers: blockers.map((b) => b.code),
          gaps: gaps.map((g) => g.code),
          formula_version: 'nrhs_v1.1',
          trigger_action: triggerAction,
        },
      });
    } catch (e) { console.warn('[calculate-nrhs] score_history insert skipped:', (e as any)?.message); }

    try {
      await supabase.from('nrhs_learning_signals').insert({
        organization_id: opportunity.organization_id,
        opportunity_id: opportunityId,
        account_id: opportunity.account_id,
        event_type: 'nrhs_recalculated',
        nrhs_score_at_event: finalScore,
        outcome: status,
        event_value: { previous_score: previousScore, blockers: blockers.length, gaps: gaps.length, trigger_source: triggerSource },
      });
    } catch (e) { console.warn('[calculate-nrhs] learning_signal insert skipped:', (e as any)?.message); }

    return new Response(
      JSON.stringify({
        success: true,
        score: finalScore,
        status,
        tier,
        pillars: {
          integrity: integrity.score,
          cadence: cadence.score,
          stakeholders: stakeholders.score,
          winloss: winLoss.score,
          adherence: adherence.score,
        },
        blockers,
        gaps,
        recommendations,
        metadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[calculate-nrhs] error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
